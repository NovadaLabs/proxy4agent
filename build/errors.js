import axios from "axios";
export function classifyError(err) {
    const ax = axios.isAxiosError(err);
    const status = ax ? err.response?.status : undefined;
    const msg = err instanceof Error ? err.message : String(err);
    if (ax && status === 429)
        return { ok: false, error: {
                code: "RATE_LIMITED", message: "HTTP 429 — rate limited",
                recoverable: true,
                agent_instruction: "Wait 5 seconds and retry. Consider reducing request frequency.",
                retry_after_seconds: 5
            } };
    if (ax && status === 404)
        return { ok: false, error: {
                code: "PAGE_NOT_FOUND",
                message: "HTTP 404 — page not found",
                recoverable: false,
                agent_instruction: "The page does not exist at this URL. Verify the URL is correct. Do not retry."
            } };
    if (ax && status && status >= 400 && status < 500)
        return { ok: false, error: {
                code: "BOT_DETECTION_SUSPECTED",
                message: `HTTP ${status} — request blocked by target`,
                recoverable: true,
                agent_instruction: "Try agentproxy_render (real browser). Or retry with a different country/session_id."
            } };
    if (msg.includes("timeout") || msg.includes("ECONNABORTED"))
        return { ok: false, error: {
                code: "TIMEOUT", message: "Request timed out",
                recoverable: true,
                agent_instruction: "Increase the timeout parameter or retry. For JS-heavy pages, use agentproxy_render.",
                retry_after_seconds: 2
            } };
    if (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN") || msg.includes("getaddrinfo"))
        return { ok: false, error: {
                code: "NETWORK_ERROR", message: "DNS resolution failed — hostname not found",
                recoverable: false,
                agent_instruction: "The hostname could not be resolved. Verify the URL is correct and the domain exists.",
            } };
    if (msg.includes("TLS") || msg.includes("SSL") || msg.includes("socket disconnect") || msg.includes("secure TLS") || msg.includes("certificate") || msg.includes("issuer cert"))
        return { ok: false, error: {
                code: "TLS_ERROR", message: "TLS/SSL connection failed",
                recoverable: true,
                agent_instruction: "The target rejected the proxy connection. Retry with a different country parameter or use agentproxy_render.",
                retry_after_seconds: 2
            } };
    if (msg.includes("No proxy provider") || msg.includes("not configured"))
        return { ok: false, error: {
                code: "PROVIDER_NOT_CONFIGURED", message: msg,
                recoverable: false,
                agent_instruction: "Set NOVADA_PROXY_USER and NOVADA_PROXY_PASS env vars and restart the MCP server."
            } };
    const INPUT_ERROR_PHRASES = ["is required", "must be", "must start with", "must contain", "letters, numbers", "max 64", "max 50", "between 1 and"];
    if (INPUT_ERROR_PHRASES.some(p => msg.includes(p)))
        return { ok: false, error: {
                code: "INVALID_INPUT", message: msg,
                recoverable: false,
                agent_instruction: "Fix the input parameters and retry. Check the tool's inputSchema for valid values."
            } };
    return { ok: false, error: {
            code: "UNKNOWN_ERROR", message: msg,
            recoverable: true,
            agent_instruction: "Retry the request. Check agentproxy_status for network health."
        } };
}
