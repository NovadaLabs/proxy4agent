import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { gunzipSync, brotliDecompressSync, inflateSync } from "zlib";
import { PROXY_HOST, PROXY_PORT, DEFAULT_USER_AGENT } from "../config.js";
// Allowed characters for proxy auth suffix params — prevent URL injection
// e.g. session_id="abc@evil.com:99" would break the proxy URL auth delimiter
const SAFE_PARAM = /^[a-zA-Z0-9_-]+$/;
function buildProxyAuth(apiKey, params) {
    let suffix = "";
    if (params.country)
        suffix += `-country-${params.country.toUpperCase()}`;
    if (params.city)
        suffix += `-city-${params.city.toLowerCase()}`;
    if (params.session_id)
        suffix += `-session-${params.session_id}`;
    if (params.asn)
        suffix += `-asn-${params.asn}`;
    return `${apiKey}${suffix}`;
}
function decompress(buffer, encoding) {
    // Primary: decompress according to the Content-Encoding header
    if (encoding === "gzip") {
        try {
            return gunzipSync(buffer).toString("utf-8");
        }
        catch { /* fall through to raw */ }
    }
    else if (encoding === "br") {
        try {
            return brotliDecompressSync(buffer).toString("utf-8");
        }
        catch { /* fall through */ }
    }
    else if (encoding === "deflate") {
        try {
            return inflateSync(buffer).toString("utf-8");
        }
        catch { /* fall through */ }
    }
    else {
        // No encoding header or unknown — try gunzip as fallback
        // (some servers send gzip without declaring it)
        try {
            return gunzipSync(buffer).toString("utf-8");
        }
        catch { /* not compressed */ }
    }
    // Raw bytes — return as UTF-8 (may be uncompressed or failed decompression)
    return buffer.toString("utf-8");
}
function decodeHtmlEntities(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}
function htmlToMarkdown(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "- ")
        .replace(/<h([1-6])[^>]*>/gi, (_, n) => "#".repeat(Number(n)) + " ")
        // Decode entities in href before building markdown links (prevents &amp; in URLs)
        .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, (_, href, text) => `[${text}](${decodeHtmlEntities(href)})`)
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function unicodeSafeTruncate(s, maxChars) {
    if (s.length <= maxChars)
        return s;
    // Spread to handle surrogate pairs correctly, then rejoin
    return [...s].slice(0, maxChars).join("");
}
export async function agentproxyFetch(params, proxyApiKey) {
    const { url, format = "markdown", timeout = 60 } = params;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("URL must start with http:// or https://");
    }
    const proxyAuth = buildProxyAuth(proxyApiKey, params);
    const proxyUrl = `http://user:${proxyAuth}@${PROXY_HOST}:${PROXY_PORT}`;
    const agent = new HttpsProxyAgent(proxyUrl);
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await axios.get(url, {
                httpsAgent: agent,
                httpAgent: agent,
                proxy: false,
                // arraybuffer + decompress:false = we handle decompression ourselves.
                // axios built-in decompress conflicts with https-proxy-agent CONNECT tunnel
                // on large pages (Amazon 1.6MB returned ECONNABORTED with decompress:true).
                responseType: "arraybuffer",
                decompress: false,
                headers: {
                    "User-Agent": DEFAULT_USER_AGENT,
                    Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                },
                timeout: timeout * 1000,
                maxContentLength: 50 * 1024 * 1024,
                maxRedirects: 5,
            });
            const encoding = response.headers["content-encoding"];
            const contentType = response.headers["content-type"];
            const body = decompress(Buffer.from(response.data), encoding);
            const isHtml = contentType?.includes("text/html") || body.toLowerCase().includes("<html");
            const output = format === "markdown" && isHtml ? htmlToMarkdown(body) : body;
            const truncated = output.length > 100_000;
            const finalOutput = truncated
                ? unicodeSafeTruncate(output, 100_000) + "\n\n[... truncated — page is large]"
                : output;
            const meta = [
                `URL: ${url}`,
                `Status: ${response.status}`,
                `Size: ${(body.length / 1024).toFixed(0)} KB`,
                params.country ? `Country: ${params.country.toUpperCase()}` : "",
                params.session_id ? `Session: ${params.session_id}` : "",
                truncated ? "Truncated: yes" : "",
            ]
                .filter(Boolean)
                .join(" | ");
            return `[${meta}]\n\n${finalOutput}`;
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < 2)
                continue; // retry once with a fresh connection
        }
    }
    throw lastError;
}
export function validateFetchParams(raw) {
    if (!raw.url || typeof raw.url !== "string") {
        throw new Error("url is required and must be a string");
    }
    if (raw.country !== undefined) {
        if (typeof raw.country !== "string" || !SAFE_PARAM.test(raw.country)) {
            throw new Error("country must be a 2-letter ISO code (e.g. US, DE, GB)");
        }
    }
    if (raw.city !== undefined) {
        if (typeof raw.city !== "string" || !SAFE_PARAM.test(raw.city)) {
            throw new Error("city must contain only letters, numbers, hyphens, underscores");
        }
    }
    if (raw.session_id !== undefined) {
        if (typeof raw.session_id !== "string" || !SAFE_PARAM.test(raw.session_id)) {
            throw new Error("session_id must contain only letters, numbers, hyphens, underscores");
        }
    }
    if (raw.asn !== undefined) {
        if (typeof raw.asn !== "string" || !SAFE_PARAM.test(raw.asn)) {
            throw new Error("asn must contain only letters, numbers, hyphens, underscores");
        }
    }
    if (raw.format && raw.format !== "raw" && raw.format !== "markdown") {
        throw new Error("format must be 'raw' or 'markdown'");
    }
    const timeout = raw.timeout ? Number(raw.timeout) : 60;
    if (timeout < 1 || timeout > 120) {
        throw new Error("timeout must be between 1 and 120 seconds");
    }
    return {
        url: raw.url,
        country: raw.country,
        city: raw.city,
        session_id: raw.session_id,
        asn: raw.asn,
        format: raw.format || "markdown",
        timeout,
    };
}
//# sourceMappingURL=fetch.js.map