import { novadaProxySearch } from "./search.js";
import { novadaProxyBatchFetch } from "./batch.js";
import { novadaProxyFetch } from "./fetch.js";
import { SAFE_COUNTRY } from "../validation.js";
const DEPTH_MAP = { quick: 3, standard: 5, deep: 10 };
export async function novadaProxyResearch(params, adapter, credentials, novadaApiKey) {
    const { query, depth = "standard", country, timeout = 60 } = params;
    const numSources = DEPTH_MAP[depth];
    const wallStart = Date.now();
    // Step 1: Search
    const searchResult = await novadaProxySearch({ query, num: numSources, country }, novadaApiKey);
    const searchParsed = JSON.parse(searchResult);
    const searchResults = searchParsed.data.results || [];
    if (searchResults.length === 0) {
        return JSON.stringify({
            ok: true,
            tool: "novada_proxy_research",
            data: {
                query,
                depth,
                sources_searched: 0,
                sources_fetched: 0,
                sources_failed: 0,
                findings: [],
                urls: [],
                findings_summary: "No search results found for this query.",
            },
            meta: { latency_ms: Date.now() - wallStart, quota: { credits_estimated: 1 } },
        });
    }
    // Step 2: Fetch top results
    const urls = searchResults.slice(0, numSources).map(r => r.url);
    let batchResults = [];
    if (urls.length === 1) {
        // batch_fetch requires minimum 2 URLs — fetch single URL directly
        try {
            const fetchResult = await novadaProxyFetch({ url: urls[0], format: "markdown", country, timeout }, adapter, credentials);
            const parsed = JSON.parse(fetchResult);
            batchResults = [{ url: urls[0], ok: true, content: parsed.data.content }];
        }
        catch {
            batchResults = [{ url: urls[0], ok: false, error: { code: "FETCH_FAILED", message: "Failed to fetch" } }];
        }
    }
    else {
        const batchResult = await novadaProxyBatchFetch({ urls, format: "markdown", country, timeout, concurrency: 3 }, adapter, credentials);
        const batchParsed = JSON.parse(batchResult);
        batchResults = batchParsed.data.results || [];
    }
    // Step 3: Extract findings
    const findings = batchResults
        .filter(r => r.ok && r.content)
        .map(r => {
        const content = r.content || "";
        const titleMatch = content.match(/^#\s+(.+)/m);
        const firstLine = content.split("\n").find(l => l.trim().length > 0)?.trim() || r.url;
        const title = titleMatch ? titleMatch[1].trim() : firstLine;
        const contentPreview = content.slice(0, 500).trim();
        return {
            title,
            url: r.url,
            snippet: searchResults.find(s => s.url === r.url)?.snippet || "",
            content_preview: contentPreview,
        };
    });
    // Step 4: Build findings summary (concatenated source previews — agent should analyze findings[] for deeper synthesis)
    const summaryParts = findings.map(f => {
        // Skip heading lines to get actual content for the summary
        const paragraphs = f.content_preview.split("\n\n").filter(p => !p.trim().startsWith("#"));
        const firstParagraph = paragraphs[0]?.trim() || f.snippet;
        return `According to ${f.title} (${f.url}): ${firstParagraph}`;
    });
    const findings_summary = summaryParts.length > 0
        ? summaryParts.join("\n\n")
        : "Unable to build findings summary — all source fetches failed.";
    const latency_ms = Date.now() - wallStart;
    const sourcesFetched = batchResults.filter(r => r.ok).length;
    const sourcesFailed = batchResults.filter(r => !r.ok).length;
    return JSON.stringify({
        ok: true,
        tool: "novada_proxy_research",
        data: {
            query,
            depth,
            sources_searched: searchResults.length,
            sources_fetched: sourcesFetched,
            sources_failed: sourcesFailed,
            findings,
            urls: findings.map(f => f.url),
            findings_summary,
        },
        meta: {
            latency_ms,
            quota: { credits_estimated: 1 + urls.length },
        },
    });
}
export function validateResearchParams(raw) {
    if (!raw.query || typeof raw.query !== "string") {
        throw new Error("query is required and must be a string");
    }
    if (raw.query.trim().length === 0) {
        throw new Error("query must not be empty");
    }
    if (raw.query.length > 500) {
        throw new Error("query must be 500 characters or less");
    }
    if (raw.depth !== undefined && !["quick", "standard", "deep"].includes(raw.depth)) {
        throw new Error("depth must be 'quick', 'standard', or 'deep'");
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
    return {
        query: raw.query.trim(),
        depth: raw.depth || "standard",
        country: raw.country,
        timeout,
    };
}
