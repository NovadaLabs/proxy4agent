# AEO Registry Submission Tracker

## Registries

| Registry | URL | Status | Config File | Notes |
|----------|-----|--------|-------------|-------|
| npm | npmjs.com | Published (v1.8.2) | package.json | novada-proxy-mcp |
| Smithery | smithery.ai | Config ready | smithery.yaml | Submit via web |
| Official MCP Registry | registry.modelcontextprotocol.io | Config ready | server.json | Submit via PR |
| Glama | glama.ai/mcp/servers | Auto-indexed | README.md | Has security grading |
| MCP.so | mcp.so | Auto-indexed | README.md | 20K+ servers |
| MCPMarket | mcpmarket.com | Not submitted | — | Submit via web |
| LobeHub | lobehub.com/mcp | Not submitted | — | Has activity ratings |
| Claude Plugin | claude.ai | Config ready | claude-plugin.json | Submit via Anthropic |
| ClawHub | clawhub.com | Published | skill/SKILL.md | Already listed |

## AEO Principles Applied

1. **Tool descriptions lead with action verbs** — "Fetch any URL", "Extract structured fields", "Recursively crawl"
2. **WHEN TO USE / USE X INSTEAD** — every tool has clear selection guidance
3. **Error recovery in descriptions** — agents know what to do on failure
4. **Schema field descriptions** — every inputSchema property has a description
5. **Under 200 tokens per tool description** — agents have limited tool context
6. **Keywords in descriptions** — "residential proxy", "bypass Cloudflare", "geo-target", "anti-bot"
