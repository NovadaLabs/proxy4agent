# A/B Test Round 2 — Content Quality Improvement

## Task
Improve the markdown output quality of novada-proxy-mcp. Currently scored 5/10 for content quality vs competitors at 9/10. The main issue: our `htmlToMarkdown` does basic tag stripping but no noise removal or readability optimization.

## What to improve

### 1. Noise removal in htmlToMarkdown (src/utils.ts)
Before converting HTML to markdown, strip these noise elements:
- `<nav>`, `<header>`, `<footer>` elements (site navigation, not content)
- `<aside>` elements (sidebars)
- Elements with common noise class/id patterns: `cookie`, `banner`, `popup`, `modal`, `overlay`, `sidebar`, `nav`, `menu`, `footer`, `header`, `ad`, `advertisement`, `social-share`, `comments`
- `<form>` elements (login forms, search boxes)
- Hidden elements: `style="display:none"`, `style="visibility:hidden"`, `aria-hidden="true"`
- Empty `<div>` and `<span>` elements with no text content

### 2. Better heading hierarchy
- Preserve heading levels (h1-h6) with proper markdown (#, ##, ###)
- Add blank lines before and after headings for readability
- Strip heading numbering artifacts (like "1.1.2")

### 3. Content density scoring
Add a simple content density check to the fetch response:
- In the response `meta`, add `content_density: number` (0-1)
- Formula: `text_length / (text_length + tag_count * 10)`
- This helps agents know if the page is content-rich or mostly navigation/ads

### 4. Inline link preservation
Current implementation strips some links. Ensure:
- Inline links are preserved as `[text](url)` in markdown
- Image alt text is preserved
- List items maintain proper indentation

### 5. Whitespace cleanup
- Collapse 3+ consecutive newlines to 2
- Remove leading/trailing whitespace per line
- Remove lines that are only whitespace or dashes/underscores (visual separators)

## Implementation approach
1. Read `src/utils.ts` — understand current `htmlToMarkdown` function
2. Create a `stripNoiseElements(html: string): string` function that removes noise before markdown conversion
3. Update `htmlToMarkdown` to call `stripNoiseElements` first
4. Add content density calculation
5. Update `src/tools/fetch.ts` to include `meta.content_density`
6. Add tests for noise removal and content density
7. Run `npm run build && npm test` — all tests must pass

## Rules
- Do NOT change tool names, response structure (keep ok/tool/data/meta envelope)
- Do NOT modify any tool besides fetch (content quality improvement is in the shared utils)
- The noise removal must be conservative — better to keep some noise than strip real content
- Add tests for new functionality
- Import paths use `.js` extension (ESM)
