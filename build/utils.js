export function unicodeSafeTruncate(s, maxChars) {
    if (s.length <= maxChars)
        return s;
    let end = maxChars;
    // Don't split a surrogate pair at the boundary
    const code = s.charCodeAt(end - 1);
    if (code >= 0xD800 && code <= 0xDBFF)
        end--; // high surrogate stranded → drop it
    else if (code >= 0xDC00 && code <= 0xDFFF)
        end -= 2; // low surrogate → drop the whole pair
    return s.slice(0, end);
}
export function decodeHtmlEntities(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}
/**
 * Noise class/id patterns that strongly indicate non-content elements.
 * Conservative: only match when the pattern is a clear indicator of noise.
 */
const NOISE_ATTR_PATTERN = /\b(cookie[-_]?banner|cookie[-_]?consent|cookie[-_]?notice|popup|modal|overlay|sidebar|nav[-_]?bar|navigation|footer|header|advertisement|ad[-_]?banner|social[-_]?share|share[-_]?buttons|comments?[-_]?section|menu[-_]?toggle|skip[-_]?nav|breadcrumb)\b/i;
/**
 * Remove noise elements from HTML BEFORE markdown conversion.
 * Conservative — only strips elements where the tag name or class/id strongly indicates noise.
 */
export function stripNoiseElements(html) {
    let result = html;
    // 1. Strip structural noise tags and their content: nav, header, footer, aside, form
    result = result.replace(/<nav[\s>][\s\S]*?<\/nav>/gi, "");
    result = result.replace(/<header[\s>][\s\S]*?<\/header>/gi, "");
    result = result.replace(/<footer[\s>][\s\S]*?<\/footer>/gi, "");
    result = result.replace(/<aside[\s>][\s\S]*?<\/aside>/gi, "");
    result = result.replace(/<form[\s>][\s\S]*?<\/form>/gi, "");
    // 2. Strip elements with noise class/id patterns
    //    Match opening tags with class="..." or id="..." containing noise keywords,
    //    then remove through the matching closing tag.
    //    We handle <div>, <section>, <span>, <ul>, <ol> with noise attributes.
    const noiseTagNames = ["div", "section", "span", "ul", "ol", "p"];
    for (const tag of noiseTagNames) {
        // Match opening tag with class or id containing noise pattern
        const openTagRe = new RegExp(`<${tag}\\s[^>]*(?:class|id)\\s*=\\s*["'][^"']*${NOISE_ATTR_PATTERN.source}[^"']*["'][^>]*>`, "gi");
        // For each match, find the corresponding closing tag and remove everything
        let match;
        while ((match = openTagRe.exec(result)) !== null) {
            const startIdx = match.index;
            // Simple depth-based closing tag finder
            const closeTag = `</${tag}>`;
            let depth = 1;
            let searchPos = startIdx + match[0].length;
            const openRe = new RegExp(`<${tag}[\\s>]`, "gi");
            const closeRe = new RegExp(`</${tag}>`, "gi");
            let endIdx = -1;
            while (depth > 0 && searchPos < result.length) {
                openRe.lastIndex = searchPos;
                closeRe.lastIndex = searchPos;
                const nextOpen = openRe.exec(result);
                const nextClose = closeRe.exec(result);
                if (!nextClose)
                    break; // malformed HTML, bail
                if (nextOpen && nextOpen.index < nextClose.index) {
                    depth++;
                    searchPos = nextOpen.index + nextOpen[0].length;
                }
                else {
                    depth--;
                    if (depth === 0) {
                        endIdx = nextClose.index + closeTag.length;
                    }
                    searchPos = nextClose.index + nextClose[0].length;
                }
            }
            if (endIdx !== -1) {
                result = result.slice(0, startIdx) + result.slice(endIdx);
                openTagRe.lastIndex = startIdx; // re-scan from same position
            }
        }
    }
    // 3. Strip hidden elements
    result = result.replace(/<[^>]+style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, "");
    result = result.replace(/<[^>]+style\s*=\s*["'][^"']*visibility\s*:\s*hidden[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, "");
    result = result.replace(/<[^>]+aria-hidden\s*=\s*["']true["'][^>]*>[\s\S]*?<\/[^>]+>/gi, "");
    // 4. Strip empty divs and spans (only whitespace content)
    result = result.replace(/<div[^>]*>\s*<\/div>/gi, "");
    result = result.replace(/<span[^>]*>\s*<\/span>/gi, "");
    return result;
}
export function htmlToMarkdown(html) {
    // Step 1: Strip noise elements before conversion
    const cleaned = stripNoiseElements(html);
    let md = cleaned
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "- ")
        .replace(/<h([1-6])[^>]*>/gi, (_, n) => "#".repeat(Number(n)) + " ")
        .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, (_, href, text) => {
        const decoded = decodeHtmlEntities(href);
        if (decoded.startsWith("data:") || decoded.startsWith("javascript:"))
            return text;
        return `[${text}](${decoded})`;
    })
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
    // Step 2: Post-conversion cleanup
    // Collapse 3+ consecutive newlines to 2
    md = md.replace(/\n{3,}/g, "\n\n");
    // Remove lines that are only dashes or underscores (visual separators)
    md = md.replace(/^\s*[-_]{3,}\s*$/gm, "");
    // Trim trailing whitespace per line
    md = md.replace(/[^\S\n]+$/gm, "");
    // Final collapse after separator removal
    md = md.replace(/\n{3,}/g, "\n\n");
    return md.trim();
}
/**
 * Count rough number of HTML tags in a string.
 */
export function countHtmlTags(html) {
    const matches = html.match(/<[a-zA-Z][^>]*>/g);
    return matches ? matches.length : 0;
}
/**
 * Compute content density score: ratio of text content to total content + tag overhead.
 * Higher = cleaner content. Range: 0.0 to 1.0.
 */
export function contentDensity(markdownLength, tagCount) {
    if (markdownLength === 0 && tagCount === 0)
        return 0;
    return parseFloat((markdownLength / (markdownLength + tagCount * 10)).toFixed(2));
}
export function htmlToText(html) {
    return htmlToMarkdown(html)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip link URLs, keep text
        .replace(/#+\s/g, "") // strip heading markers
        .replace(/^-\s/gm, "") // strip list bullets
        .trim();
}
