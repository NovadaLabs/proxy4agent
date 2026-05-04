import { NovadaAdapter } from "./novada.js";
import { GenericHttpAdapter } from "./generic.js";
import { BrightDataAdapter } from "./brightdata.js";
import { SmartproxyAdapter } from "./smartproxy.js";
import { OxylabsAdapter } from "./oxylabs.js";
/**
 * Registered proxy adapters in priority order.
 *
 * Resolution: the first adapter whose loadCredentials() returns non-null wins.
 * Novada is always first — it's our default and priority provider.
 *
 * To add a provider:
 *   1. Create src/adapters/<provider>.ts implementing ProxyAdapter
 *   2. Import it here and add it to the array below
 *   3. Nothing else changes
 */
const ADAPTERS = [
    NovadaAdapter, // Always first — default, deepest integration
    BrightDataAdapter, // BRIGHTDATA_USER + BRIGHTDATA_PASS
    SmartproxyAdapter, // SMARTPROXY_USER + SMARTPROXY_PASS
    OxylabsAdapter, // OXYLABS_USER + OXYLABS_PASS
    GenericHttpAdapter, // Always last — PROXY_URL fallback (no auto-targeting)
];
/**
 * Resolve which proxy adapter to use based on available environment variables.
 * Returns the first configured adapter (Novada wins if multiple are set).
 * Returns null if no proxy provider is configured.
 */
export function resolveAdapter(env) {
    for (const adapter of ADAPTERS) {
        const credentials = adapter.loadCredentials(env);
        if (credentials)
            return { adapter, credentials };
    }
    return null;
}
/**
 * List all registered adapters (for --help and status output).
 */
export function listAdapters() {
    return [...ADAPTERS];
}
