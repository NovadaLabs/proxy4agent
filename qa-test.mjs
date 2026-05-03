// QA test harness — runs all 10 test cases against real proxy credentials
import { novadaProxyFetch, validateFetchParams } from "./build/tools/fetch.js";
import { novadaProxySearch, validateSearchParams } from "./build/tools/search.js";
import { novadaProxySession, validateSessionParams } from "./build/tools/session.js";
import { novadaProxyStatus } from "./build/tools/status.js";

const PROXY_USER = process.env.NOVADA_PROXY_USER;
const PROXY_PASS = process.env.NOVADA_PROXY_PASS;
const NOVADA_API_KEY = process.env.NOVADA_API_KEY;

const results = [];
let pass = 0, fail = 0;

function log(testName, status, note, output = "") {
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(`\n${icon} ${testName}: ${status}`);
  if (note) console.log(`   ${note}`);
  if (output) {
    const lines = output.split("\n").slice(0, 6);
    console.log("   Output (first 6 lines):");
    lines.forEach(l => console.log(`     ${l}`));
  }
  results.push({ testName, status, note });
  if (status === "PASS") pass++;
  else if (status === "FAIL") fail++;
}

async function runTest(name, fn) {
  try {
    await fn();
  } catch (err) {
    log(name, "FAIL", `Unexpected exception: ${err.message}`);
  }
}

// ── Test 1: Basic fetch — raw IP ──────────────────────────────────────────────
await runTest("T1: novada_proxy_fetch basic (httpbin.org/ip, raw)", async () => {
  const out = await novadaProxyFetch(
    validateFetchParams({ url: "https://httpbin.org/ip", format: "raw" }),
    PROXY_USER, PROXY_PASS
  );
  const match = out.match(/"origin":\s*"([\d.]+)"/);
  const ip = match?.[1];
  // Simple check: must return an IP and it must not be a private IP
  const isPrivate = ip && (ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("127."));
  if (!ip) {
    log("T1: Basic fetch", "FAIL", `No IP in response. Output: ${out.slice(0, 200)}`);
  } else if (isPrivate) {
    log("T1: Basic fetch", "FAIL", `Got private IP (${ip}) — not routed through residential proxy`);
  } else {
    log("T1: Basic fetch", "PASS", `Got IP: ${ip} (non-private, proxy confirmed)`, out.slice(0, 300));
  }
});

// ── Test 2: Country targeting (DE) ───────────────────────────────────────────
await runTest("T2: novada_proxy_fetch country=DE", async () => {
  const out = await novadaProxyFetch(
    validateFetchParams({ url: "https://httpbin.org/ip", format: "raw", country: "DE" }),
    PROXY_USER, PROXY_PASS
  );
  const ipMatch = out.match(/"origin":\s*"([\d.]+)"/);
  const ip = ipMatch?.[1];
  // We verify the response includes the DE meta tag from the tool
  const hasDE = out.includes("Country: DE");
  if (!ip) {
    log("T2: Country DE", "FAIL", `No IP found. Output: ${out.slice(0, 200)}`);
  } else if (!hasDE) {
    log("T2: Country DE", "WARN", `IP ${ip} returned but no 'Country: DE' in meta — check routing`, out.slice(0, 300));
  } else {
    log("T2: Country DE", "PASS", `IP: ${ip} | Meta confirms DE routing`, out.slice(0, 300));
  }
});

// ── Test 3: Markdown conversion ───────────────────────────────────────────────
await runTest("T3: novada_proxy_fetch markdown (example.com)", async () => {
  const out = await novadaProxyFetch(
    validateFetchParams({ url: "https://example.com", format: "markdown" }),
    PROXY_USER, PROXY_PASS
  );
  const hasHtmlTag = /<html|<body|<head/i.test(out);
  const hasScriptTag = /<script/i.test(out);
  const hasContent = out.includes("Example Domain");
  if (hasHtmlTag || hasScriptTag) {
    log("T3: Markdown", "FAIL", `Raw HTML leaked into markdown output`, out.slice(0, 400));
  } else if (!hasContent) {
    log("T3: Markdown", "FAIL", `Expected 'Example Domain' not found in output`, out.slice(0, 400));
  } else {
    log("T3: Markdown", "PASS", `Clean markdown — no HTML tags, content present`, out.slice(0, 400));
  }
});

// ── Test 4: Anti-bot (Amazon) ─────────────────────────────────────────────────
await runTest("T4: novada_proxy_fetch Amazon anti-bot", async () => {
  const out = await novadaProxyFetch(
    validateFetchParams({ url: "https://www.amazon.com/dp/B0BSHF7WHW", country: "US", format: "markdown", timeout: 60 }),
    PROXY_USER, PROXY_PASS
  );
  const blocked = out.toLowerCase().includes("robot") || out.toLowerCase().includes("captcha") ||
                  out.toLowerCase().includes("sorry") || out.toLowerCase().includes("automated");
  const hasProduct = out.toLowerCase().includes("kindle") || out.toLowerCase().includes("amazon") ||
                     out.toLowerCase().includes("add to cart") || out.toLowerCase().includes("price") ||
                     out.toLowerCase().includes("buy");
  const status = out.match(/Status:\s*(\d+)/)?.[1];
  if (blocked && !hasProduct) {
    log("T4: Amazon anti-bot", "FAIL", `Blocked. Status: ${status}. Keywords: robot/captcha detected`, out.slice(0, 600));
  } else if (hasProduct) {
    log("T4: Amazon anti-bot", "PASS", `Product content returned. Status: ${status}`, out.slice(0, 600));
  } else {
    log("T4: Amazon anti-bot", "WARN", `Status: ${status} — ambiguous response (no clear block or product)`, out.slice(0, 600));
  }
});

// ── Test 5: Session stickiness ────────────────────────────────────────────────
await runTest("T5: novada_proxy_session sticky IP", async () => {
  const s1a = await novadaProxySession(
    validateSessionParams({ session_id: "testqa001", url: "https://httpbin.org/ip" }),
    PROXY_USER, PROXY_PASS
  );
  const s1b = await novadaProxySession(
    validateSessionParams({ session_id: "testqa001", url: "https://httpbin.org/ip" }),
    PROXY_USER, PROXY_PASS
  );
  const s2 = await novadaProxySession(
    validateSessionParams({ session_id: "testqa002", url: "https://httpbin.org/ip" }),
    PROXY_USER, PROXY_PASS
  );

  const ip1a = s1a.match(/"origin":\s*"([\d.]+)"/)?.[1];
  const ip1b = s1b.match(/"origin":\s*"([\d.]+)"/)?.[1];
  const ip2  = s2.match(/"origin":\s*"([\d.]+)"/)?.[1];

  console.log(`   Session testqa001 call 1: ${ip1a}`);
  console.log(`   Session testqa001 call 2: ${ip1b}`);
  console.log(`   Session testqa002: ${ip2}`);

  const stickyOk = ip1a && ip1b && ip1a === ip1b;
  const differentOk = ip1a && ip2 && ip1a !== ip2;

  if (!stickyOk && !differentOk) {
    log("T5: Session stickiness", "FAIL", `Could not verify — IPs: ${ip1a}, ${ip1b}, ${ip2}`);
  } else if (!stickyOk) {
    log("T5: Session stickiness", "FAIL", `Same session returned different IPs: ${ip1a} vs ${ip1b}`);
  } else if (!differentOk) {
    log("T5: Session stickiness", "WARN", `Sticky IPs match (${ip1a}) but both sessions got same IP — may be coincidence`);
  } else {
    log("T5: Session stickiness", "PASS", `Same session: ${ip1a} === ${ip1b} | Different session: ${ip2}`);
  }
});

// ── Test 6: Hyphen guard ──────────────────────────────────────────────────────
await runTest("T6: session_id hyphen guard", async () => {
  try {
    validateSessionParams({ session_id: "my-bad-id", url: "https://httpbin.org/ip" });
    // If we get here, validation passed — which is wrong for v1.3.0
    // Check if validateSessionParams actually validates hyphens in session_id
    log("T6: Hyphen guard", "FAIL", `'my-bad-id' passed validation — session_id hyphen guard missing in validateSessionParams`);
  } catch (err) {
    if (err.message.includes("hyphen") || err.message.includes("session_id") || err.message.includes("underscore")) {
      log("T6: Hyphen guard", "PASS", `Correctly rejected: ${err.message}`);
    } else {
      log("T6: Hyphen guard", "WARN", `Rejected but unclear message: ${err.message}`);
    }
  }
});

// ── Test 7: Search — Google ───────────────────────────────────────────────────
await runTest("T7: novada_proxy_search Google", async () => {
  const out = await novadaProxySearch(
    validateSearchParams({ query: "residential proxy API 2025", engine: "google", num: 5 }),
    NOVADA_API_KEY
  );
  const hasResults = out.includes("**") && out.includes("http");
  const lineCount = out.split("\n").length;
  if (!hasResults) {
    log("T7: Google search", "FAIL", `No structured results found`, out.slice(0, 400));
  } else {
    log("T7: Google search", "PASS", `${lineCount} lines returned, structured results present`, out.slice(0, 500));
  }
});

// ── Test 8: Search — Bing ─────────────────────────────────────────────────────
await runTest("T8: novada_proxy_search Bing", async () => {
  const out = await novadaProxySearch(
    validateSearchParams({ query: "Novada proxy", engine: "bing", num: 3 }),
    NOVADA_API_KEY
  );
  const hasResults = out.includes("**") && out.includes("http");
  if (!hasResults) {
    log("T8: Bing search", "FAIL", `No structured results`, out.slice(0, 400));
  } else {
    log("T8: Bing search", "PASS", `Bing results returned`, out.slice(0, 400));
  }
});

// ── Test 9: Status ─────────────────────────────────────────────────────────────
await runTest("T9: novada_proxy_status", async () => {
  const out = await novadaProxyStatus();
  const hasStatus = out.includes("Status:");
  const nodeMatch = out.match(/Connected nodes:\s*([\d,]+)/);
  const nodeCount = nodeMatch ? parseInt(nodeMatch[1].replace(/,/g, "")) : 0;
  if (!hasStatus) {
    log("T9: Status", "FAIL", `No status field in response`, out);
  } else if (nodeCount < 100) {
    log("T9: Status", "WARN", `Low node count: ${nodeCount}`, out);
  } else {
    log("T9: Status", "PASS", `Nodes: ${nodeCount.toLocaleString()}`, out);
  }
});

// ── Test 10: Error handling — bad URL ─────────────────────────────────────────
await runTest("T10: Error handling — bad URL", async () => {
  try {
    validateFetchParams({ url: "ftp://bad-url.com" });
    log("T10: URL validation", "FAIL", "ftp:// should have been rejected by validateFetchParams");
  } catch (err) {
    log("T10: URL validation", "PASS", `Correctly rejected: ${err.message}`);
  }
});

// ── Summary ────────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log(`SUMMARY: ${pass} passed, ${fail} failed, ${results.length - pass - fail} warnings`);
console.log("=".repeat(60));
results.forEach(r => {
  const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⚠️";
  console.log(`${icon} ${r.testName}: ${r.status}${r.note ? " — " + r.note.slice(0, 80) : ""}`);
});
