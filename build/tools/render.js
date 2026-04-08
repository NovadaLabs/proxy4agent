import axios from "axios";
import { NOVADA_BROWSER_URL } from "../config.js";
function unicodeSafeTruncate(s, maxChars) {
    if (s.length <= maxChars)
        return s;
    return [...s].slice(0, maxChars).join("");
}
export async function agentproxyRender(params, novadaApiKey) {
    const { url, format = "markdown", wait_for, timeout = 60 } = params;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("URL must start with http:// or https://");
    }
    const payload = { url, format, timeout };
    if (wait_for)
        payload.wait_for = wait_for;
    const response = await axios.post(NOVADA_BROWSER_URL, payload, {
        headers: {
            "Content-Type": "application/json",
            "X-Api-Key": novadaApiKey,
        },
        timeout: (timeout + 10) * 1000,
    });
    const data = response.data;
    if (data.code && data.code !== 200 && data.code !== 0) {
        throw new Error(`Novada Browser API error (${data.code}): ${String(data.msg || "unknown")}`);
    }
    const content = data.data?.content || data.content || data.data || "";
    const title = data.data?.title || data.title || "";
    const truncated = content.length > 100_000;
    const finalContent = truncated
        ? unicodeSafeTruncate(content, 100_000) + "\n\n[... truncated — rendered page is large]"
        : content;
    const size = (content.length / 1024).toFixed(0);
    const meta = [
        `URL: ${url}`,
        `Title: ${title}`,
        `Size: ${size} KB`,
        "Rendered: yes (Browser API)",
        truncated ? "Truncated: yes" : "",
    ]
        .filter(Boolean)
        .join(" | ");
    return `[${meta}]\n\n${finalContent}`;
}
export function validateRenderParams(raw) {
    if (!raw.url || typeof raw.url !== "string") {
        throw new Error("url is required");
    }
    const validFormats = ["markdown", "html", "text"];
    if (raw.format && !validFormats.includes(raw.format)) {
        throw new Error("format must be markdown, html, or text");
    }
    const timeout = raw.timeout ? Number(raw.timeout) : 60;
    if (timeout < 5 || timeout > 120)
        throw new Error("timeout must be 5-120 seconds");
    return {
        url: raw.url,
        format: raw.format || "markdown",
        wait_for: raw.wait_for,
        timeout,
    };
}
//# sourceMappingURL=render.js.map