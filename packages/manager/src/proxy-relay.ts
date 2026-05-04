import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { novadaProxyFetch, novadaProxyStatus, resolveAdapter, validateFetchParams } from "@novada/proxy-core";

function resolveRequestUrl(req: IncomingMessage): string | null {
  if (!req.url) return null;
  if (req.url.startsWith("http://") || req.url.startsWith("https://")) return req.url;

  const host = req.headers.host;
  if (!host) return null;
  return `http://${host}${req.url}`;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function createProxyRelay(env: NodeJS.ProcessEnv = process.env) {
  return createServer(async (req, res) => {
    if (req.method === "CONNECT") {
      res.writeHead(501, { "content-type": "text/plain; charset=utf-8" });
      res.end("CONNECT tunneling is not supported by this relay");
      return;
    }

    const runtime = resolveAdapter(env);
    if (!runtime) {
      sendJson(res, 400, { ok: false, error: "proxy credentials are not configured" });
      return;
    }

    const targetUrl = resolveRequestUrl(req);
    if (!targetUrl) {
      sendJson(res, 400, { ok: false, error: "unable to resolve request URL" });
      return;
    }

    try {
      const params = validateFetchParams({
        url: targetUrl,
        country: firstHeader(req.headers["x-novada-country"]),
        session_id: firstHeader(req.headers["x-novada-session"]),
        format: "raw",
      });
      const raw = await novadaProxyFetch(params, runtime.adapter, runtime.credentials);
      const parsed = JSON.parse(raw) as { data?: { content?: string; status_code?: number } };
      res.writeHead(parsed.data?.status_code || 200, { "content-type": "text/html; charset=utf-8" });
      res.end(parsed.data?.content || "");
    } catch (error) {
      sendJson(res, 502, { ok: false, error: error instanceof Error ? error.message : "relay request failed" });
    }
  });
}

export async function proxyRelayStatus(env: NodeJS.ProcessEnv = process.env): Promise<unknown> {
  const runtime = resolveAdapter(env);
  if (!runtime) return { ok: false, error: "proxy credentials are not configured" };
  return JSON.parse(await novadaProxyStatus(runtime.adapter, runtime.credentials)) as unknown;
}
