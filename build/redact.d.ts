import type { ProxyAdapter, ProxyCredentials } from "./adapters/index.js";
export declare function redactCredentials(message: string, adapter: ProxyAdapter, credentials: ProxyCredentials): string;
