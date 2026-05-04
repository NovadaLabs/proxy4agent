export declare function unicodeSafeTruncate(s: string, maxChars: number): string;
export declare function decodeHtmlEntities(s: string): string;
/**
 * Remove noise elements from HTML BEFORE markdown conversion.
 * Conservative — only strips elements where the tag name or class/id strongly indicates noise.
 */
export declare function stripNoiseElements(html: string): string;
export declare function htmlToMarkdown(html: string): string;
/**
 * Count rough number of HTML tags in a string.
 */
export declare function countHtmlTags(html: string): number;
/**
 * Compute content density score: ratio of text content to total content + tag overhead.
 * Higher = cleaner content. Range: 0.0 to 1.0.
 */
export declare function contentDensity(markdownLength: number, tagCount: number): number;
export declare function htmlToText(html: string): string;
