import { agentproxyFetch } from "./fetch.js";
import { SAFE_COUNTRY, QUOTA_NOTE } from "../validation.js";
// ─── Link extraction (reused from map.ts pattern) ──────────────────────────────
/**
 * Extract internal links from HTML. Resolves relative URLs against origin,
 * deduplicates, and filters to same domain + subdomains.
 */
function extractInternalLinks(html, origin, hostname, seen) {
    const hrefRe = /<a[^>]+href=["']([^"'#?][^"']*)["']/gi;
    const found = [];
    let match;
    while ((match = hrefRe.exec(html)) !== null) {
        const raw = match[1]?.trim();
        if (!raw)
            continue;
        let resolved;
        try {
            resolved = new URL(raw, origin).toString();
        }
        catch {
            continue; // skip malformed hrefs
        }
        // Normalise: strip trailing slash
        resolved = resolved.replace(/\/$/, "");
        if (seen.has(resolved))
            continue;
        // Must be same domain or subdomain
        let resolvedHostname;
        try {
            resolvedHostname = new URL(resolved).hostname;
        }
        catch {
            continue;
        }
        if (resolvedHostname === hostname || resolvedHostname.endsWith(`.${hostname}`)) {
            // Skip non-page resources (images, stylesheets, scripts, etc.)
            const path = new URL(resolved).pathname.toLowerCase();
            if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|pdf|zip|tar|gz)$/.test(path)) {
                continue;
            }
            found.push(resolved);
        }
    }
    return found;
}
// ─── Concurrency helper ────────────────────────────────────────────────────────
/**
 * Process an array of items with bounded concurrency. Returns results in the
 * same order as the input array.
 */
async function mapWithConcurrency(items, concurrency, fn) {
    const results = new Array(items.length);
    let activeCount = 0;
    const queue = [];
    function acquire() {
        return new Promise((resolve) => {
            if (activeCount < concurrency) {
                activeCount++;
                resolve();
            }
            else {
                queue.push(() => {
                    activeCount++;
                    resolve();
                });
            }
        });
    }
    function release() {
        activeCount--;
        const next = queue.shift();
        if (next)
            next();
    }
    await Promise.all(items.map(async (item, idx) => {
        await acquire();
        try {
            results[idx] = await fn(item);
        }
        finally {
            release();
        }
    }));
    return results;
}
// ─── Main crawl function ───────────────────────────────────────────────────────
const CRAWL_CONCURRENCY = 3;
export async function agentproxyCrawl(params, adapter, credentials) {
    const { url, depth: maxDepth = 2, limit = 50, include_content = false, country, timeout = 60, format = "markdown", } = params;
    const startTime = Date.now();
    // Parse origin for relative-URL resolution and same-domain filtering
    let origin;
    let hostname;
    try {
        const parsed = new URL(url);
        origin = parsed.origin;
        hostname = parsed.hostname;
    }
    catch {
        throw new Error(`Invalid URL: ${url}`);
    }
    const visited = new Set();
    const pages = [];
    let totalDiscovered = 0;
    let cachedPages = 0;
    let currentLevel = [{ url: url.replace(/\/$/, ""), depth: 0 }];
    visited.add(url.replace(/\/$/, ""));
    let deepestReached = 0;
    while (currentLevel.length > 0 && pages.length < limit) {
        // Cap this level to remaining budget
        const remaining = limit - pages.length;
        const batch = currentLevel.slice(0, remaining);
        const batchResults = await mapWithConcurrency(batch, CRAWL_CONCURRENCY, async (item) => {
            try {
                const fetchResultStr = await agentproxyFetch({ url: item.url, format: include_content ? format : "raw", country, timeout }, adapter, credentials);
                const fetchResult = JSON.parse(fetchResultStr);
                const html = fetchResult.data.content || "";
                const statusCode = fetchResult.data.status_code;
                const cacheHit = fetchResult.meta.cache_hit === true;
                // Extract links from raw HTML for link discovery
                // When include_content=true and format=markdown, we still need raw HTML for links.
                // But agentproxyFetch already converts to markdown. For link extraction we use
                // the fetched content as-is — markdown conversion preserves link text but strips
                // <a> tags. So we always fetch raw for link extraction, and optionally return
                // markdown content.
                let linksHtml = html;
                let contentForUser;
                if (include_content && format === "markdown") {
                    // We fetched as markdown for the user's content, but we need raw HTML for links.
                    // Re-fetch raw for link extraction only if this isn't a cache hit (cost-free).
                    // Actually, the cache deduplicates by format, so a raw fetch may already be cached
                    // from the link extraction. Fetch raw separately for links.
                    const rawResultStr = await agentproxyFetch({ url: item.url, format: "raw", country, timeout }, adapter, credentials);
                    const rawResult = JSON.parse(rawResultStr);
                    linksHtml = rawResult.data.content || "";
                    contentForUser = html; // markdown version
                    if (rawResult.meta.cache_hit !== true && !cacheHit) {
                        // Both fetches cost credits — but the raw one is likely cached from the markdown fetch.
                        // We'll count conservatively below.
                    }
                }
                else if (include_content) {
                    // format=raw — same content used for both links and user
                    contentForUser = html;
                }
                // else: no content for user, html is raw for link extraction
                if (cacheHit)
                    cachedPages++;
                const newLinks = extractInternalLinks(linksHtml, origin, hostname, visited);
                const page = {
                    url: item.url,
                    depth: item.depth,
                    status_code: statusCode,
                    links_found: newLinks.length,
                };
                if (include_content && contentForUser !== undefined) {
                    page.content = contentForUser;
                }
                return { page, newLinks };
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    page: {
                        url: item.url,
                        depth: item.depth,
                        links_found: 0,
                        error: msg,
                    },
                    newLinks: [],
                };
            }
        });
        // Collect results and build next level
        const nextLevel = [];
        for (const { page, newLinks } of batchResults) {
            pages.push(page);
            if (page.depth > deepestReached)
                deepestReached = page.depth;
            // Add newly discovered links to next level if within depth
            for (const link of newLinks) {
                totalDiscovered++;
                if (!visited.has(link) && page.depth + 1 <= maxDepth) {
                    visited.add(link);
                    nextLevel.push({ url: link, depth: page.depth + 1 });
                }
            }
        }
        // Move to next depth level
        currentLevel = nextLevel;
    }
    const latency_ms = Date.now() - startTime;
    // Check for sitemap.xml hint
    const sitemapUrl = `${origin}/sitemap.xml`;
    const sitemapHint = !visited.has(sitemapUrl)
        ? `${sitemapUrl} (not crawled — check manually for a complete URL list)`
        : undefined;
    const result = {
        ok: true,
        tool: "agentproxy_crawl",
        data: {
            start_url: url,
            domain: hostname,
            depth_reached: deepestReached,
            urls_crawled: pages.length,
            urls_discovered: totalDiscovered,
            pages: pages,
            ...(sitemapHint ? { sitemap_hint: sitemapHint } : {}),
        },
        meta: {
            latency_ms,
            country,
            quota: {
                credits_estimated: pages.length - cachedPages,
                note: QUOTA_NOTE,
            },
        },
    };
    if (!result.meta.country)
        delete result.meta.country;
    return JSON.stringify(result);
}
// ─── Validation ────────────────────────────────────────────────────────────────
export function validateCrawlParams(raw) {
    if (!raw.url || typeof raw.url !== "string") {
        throw new Error("url is required and must be a string");
    }
    if (!raw.url.startsWith("http://") && !raw.url.startsWith("https://")) {
        throw new Error("url must start with http:// or https://");
    }
    const depth = raw.depth !== undefined ? Number(raw.depth) : 2;
    if (!Number.isFinite(depth) || depth < 1 || depth > 5) {
        throw new Error("depth must be between 1 and 5");
    }
    const limit = raw.limit !== undefined ? Number(raw.limit) : 50;
    if (!Number.isFinite(limit) || limit < 10 || limit > 200) {
        throw new Error("limit must be between 10 and 200");
    }
    if (raw.country !== undefined) {
        if (typeof raw.country !== "string" || raw.country.length > 10 || !SAFE_COUNTRY.test(raw.country)) {
            throw new Error("country must be a 2-letter ISO code with no hyphens (e.g. US, DE, GB)");
        }
    }
    const timeout = raw.timeout !== undefined ? Number(raw.timeout) : 60;
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 120) {
        throw new Error("timeout must be between 1 and 120 seconds");
    }
    if (raw.format !== undefined && raw.format !== "raw" && raw.format !== "markdown") {
        throw new Error("format must be 'raw' or 'markdown'");
    }
    return {
        url: raw.url,
        depth,
        limit,
        include_content: raw.include_content === true,
        country: raw.country,
        timeout,
        format: raw.format || "markdown",
    };
}
