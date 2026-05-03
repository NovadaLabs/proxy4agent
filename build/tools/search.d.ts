export interface SearchParams {
    query: string;
    engine?: "google";
    num?: number;
    country?: string;
    language?: string;
}
export declare function novadaProxySearch(params: SearchParams, novadaApiKey: string): Promise<string>;
export declare function validateSearchParams(raw: Record<string, unknown>): SearchParams;
