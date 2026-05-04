export interface RenderParams {
    url: string;
    format?: "markdown" | "html" | "text";
    wait_for?: string;
    timeout?: number;
}
export declare function novadaProxyRender(params: RenderParams, browserWsEndpoint: string): Promise<string>;
export declare function validateRenderParams(raw: Record<string, unknown>): RenderParams;
