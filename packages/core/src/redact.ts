import type { ProxyAdapter, ProxyCredentials } from "./adapters/index.js";

export function redactCredentials(
  message: string,
  adapter: ProxyAdapter,
  credentials: ProxyCredentials
): string {
  let redacted = message;
  for (const field of adapter.sensitiveFields) {
    const val = credentials[field];
    if (val) {
      redacted = redacted.replaceAll(val, "***");
      redacted = redacted.replaceAll(encodeURIComponent(val), "***");
    }
  }
  const user = credentials["user"];
  if (user) {
    redacted = redacted.replaceAll(user, "***");
    redacted = redacted.replaceAll(encodeURIComponent(user), "***");
  }
  // Also redact API keys that may appear in URLs
  for (const envKey of ["NOVADA_API_KEY", "NOVADA_BROWSER_WS"]) {
    const val = process.env[envKey];
    if (val) {
      redacted = redacted.replaceAll(val, "***");
      redacted = redacted.replaceAll(encodeURIComponent(val), "***");
    }
  }
  return redacted;
}
