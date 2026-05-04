import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
export interface SessionParams {
    session_id: string;
    url: string;
    country?: string;
    city?: string;
    format?: "raw" | "markdown";
    timeout?: number;
    verify_sticky?: boolean;
}
export declare function novadaProxySession(params: SessionParams, adapter: ProxyAdapter, credentials: ProxyCredentials): Promise<string>;
export declare function validateSessionParams(raw: Record<string, unknown>): SessionParams;
