import type { ProxyAdapter, ProxyCredentials } from "../adapters/index.js";
export declare function agentproxyStatus(adapter?: ProxyAdapter, credentials?: ProxyCredentials): Promise<string>;
