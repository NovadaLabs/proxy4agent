import type { IncomingMessage, ServerResponse } from "node:http";
import { novadaProxyFetch, novadaProxyStatus, resolveAdapter, validateFetchParams } from "@novada/proxy-core";

type JsonRecord = Record<string, unknown>;

interface ManagerConfig {
  provider: string;
  user?: string;
  pass?: string;
  host?: string;
  port?: string;
  zone?: string;
  proxy_url?: string;
  api_key?: string;
  browser_ws?: string;
}

interface RequestLog {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  latency_ms: number;
  country?: string;
  proxy_ip?: string;
}

const startedAt = Date.now();
let managerConfig: ManagerConfig = {
  provider: process.env.NOVADA_PROXY_PROVIDER || "novada",
};
let lastProxyIp: string | undefined;
const logs: RequestLog[] = [];

export function resetManagerStateForTests(): void {
  managerConfig = { provider: "novada" };
  lastProxyIp = undefined;
  logs.length = 0;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<JsonRecord> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(new Error("JSON body must be an object"));
          return;
        }
        resolve(parsed as JsonRecord);
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function buildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const provider = managerConfig.provider.toLowerCase();

  if (provider === "novada") {
    if (managerConfig.user) env.NOVADA_PROXY_USER = managerConfig.user;
    if (managerConfig.pass) env.NOVADA_PROXY_PASS = managerConfig.pass;
    if (managerConfig.host) env.NOVADA_PROXY_HOST = managerConfig.host;
    if (managerConfig.port) env.NOVADA_PROXY_PORT = managerConfig.port;
    if (managerConfig.zone) env.NOVADA_PROXY_ZONE = managerConfig.zone;
  } else if (provider === "brightdata") {
    if (managerConfig.user) env.BRIGHTDATA_USER = managerConfig.user;
    if (managerConfig.pass) env.BRIGHTDATA_PASS = managerConfig.pass;
    if (managerConfig.host) env.BRIGHTDATA_HOST = managerConfig.host;
    if (managerConfig.port) env.BRIGHTDATA_PORT = managerConfig.port;
  } else if (provider === "smartproxy") {
    if (managerConfig.user) env.SMARTPROXY_USER = managerConfig.user;
    if (managerConfig.pass) env.SMARTPROXY_PASS = managerConfig.pass;
    if (managerConfig.host) env.SMARTPROXY_HOST = managerConfig.host;
    if (managerConfig.port) env.SMARTPROXY_PORT = managerConfig.port;
  } else if (provider === "oxylabs") {
    if (managerConfig.user) env.OXYLABS_USER = managerConfig.user;
    if (managerConfig.pass) env.OXYLABS_PASS = managerConfig.pass;
    if (managerConfig.host) env.OXYLABS_HOST = managerConfig.host;
    if (managerConfig.port) env.OXYLABS_PORT = managerConfig.port;
  } else if (provider === "generic" && managerConfig.proxy_url) {
    env.PROXY_URL = managerConfig.proxy_url;
  }

  return env;
}

export function getProxyRuntime(): ReturnType<typeof resolveAdapter> {
  return resolveAdapter(buildEnv());
}

function credentialsSet(): boolean {
  return Boolean(managerConfig.proxy_url || (managerConfig.user && managerConfig.pass) || getProxyRuntime());
}

function pushLog(entry: RequestLog): void {
  logs.push(entry);
  if (logs.length > 100) logs.splice(0, logs.length - 100);
}

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url || "/", "http://localhost");
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = requestUrl(req);
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    if (req.method === "GET" && url.pathname === "/api/status") {
      const runtime = getProxyRuntime();
      let provider = runtime?.adapter.displayName || managerConfig.provider || "none configured";
      let connected = Boolean(runtime);

      if (runtime) {
        try {
          const raw = await novadaProxyStatus(runtime.adapter, runtime.credentials);
          const parsed = JSON.parse(raw) as { data?: { provider?: string; connectivity?: { status?: string; proxy_ip?: string } } };
          provider = parsed.data?.provider || provider;
          connected = parsed.data?.connectivity?.status === "HEALTHY";
          lastProxyIp = parsed.data?.connectivity?.proxy_ip || lastProxyIp;
        } catch {
          connected = false;
        }
      }

      sendJson(res, 200, {
        ok: true,
        provider,
        country: null,
        connected,
        proxy_ip: lastProxyIp || null,
        uptime_ms: Date.now() - startedAt,
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        provider: managerConfig.provider,
        credentials_set: credentialsSet(),
        api_key_set: Boolean(managerConfig.api_key),
        browser_ws_set: Boolean(managerConfig.browser_ws),
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/config") {
      const body = await readBody(req);
      managerConfig = {
        provider: typeof body.provider === "string" && body.provider ? body.provider : managerConfig.provider,
        user: typeof body.user === "string" ? body.user : undefined,
        pass: typeof body.pass === "string" ? body.pass : undefined,
        host: typeof body.host === "string" ? body.host : undefined,
        port: typeof body.port === "string" || typeof body.port === "number" ? String(body.port) : undefined,
        zone: typeof body.zone === "string" ? body.zone : undefined,
        proxy_url: typeof body.proxy_url === "string" ? body.proxy_url : undefined,
        api_key: typeof body.api_key === "string" ? body.api_key : undefined,
        browser_ws: typeof body.browser_ws === "string" ? body.browser_ws : undefined,
      };
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/test") {
      const started = Date.now();
      let body: JsonRecord;
      try {
        body = await readBody(req);
        validateFetchParams(body);
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "invalid request" });
        return true;
      }

      const params = validateFetchParams({ ...body, format: body.format || "markdown" });
      const runtime = getProxyRuntime();
      if (!runtime) {
        sendJson(res, 400, { ok: false, error: "proxy credentials are not configured" });
        return true;
      }

      try {
        const raw = await novadaProxyFetch(params, runtime.adapter, runtime.credentials);
        const parsed = JSON.parse(raw) as {
          ok?: boolean;
          data?: { content?: string; status_code?: number };
          meta?: { latency_ms?: number; proxy_ip?: string };
        };
        const latency = parsed.meta?.latency_ms ?? Date.now() - started;
        lastProxyIp = parsed.meta?.proxy_ip || lastProxyIp;
        const responsePayload = {
          ok: parsed.ok === true,
          data: {
            content: parsed.data?.content || "",
            status_code: parsed.data?.status_code || 0,
          },
          meta: {
            latency_ms: latency,
            proxy_ip: lastProxyIp,
          },
        };
        pushLog({
          timestamp: new Date().toISOString(),
          method: "GET",
          url: params.url,
          status: responsePayload.data.status_code,
          latency_ms: latency,
          country: params.country,
          proxy_ip: lastProxyIp,
        });
        sendJson(res, 200, responsePayload);
        return true;
      } catch (error) {
        const latency = Date.now() - started;
        pushLog({
          timestamp: new Date().toISOString(),
          method: "GET",
          url: params.url,
          status: 502,
          latency_ms: latency,
          country: params.country,
          proxy_ip: lastProxyIp,
        });
        sendJson(res, 502, { ok: false, error: error instanceof Error ? error.message : "proxy test failed" });
        return true;
      }
    }

    if (req.method === "GET" && url.pathname === "/api/logs") {
      sendJson(res, 200, { logs: logs.slice().reverse() });
      return true;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
    return true;
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "internal server error" });
    return true;
  }
}
