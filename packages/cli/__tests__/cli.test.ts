import { describe, it, expect } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import { resolve } from "node:path";

// Build output is at build/cli.js relative to project root
const PROJECT_ROOT = resolve(new URL(import.meta.url).pathname, "../..");
const CLI = resolve(PROJECT_ROOT, "build/cli.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function runCli(args: string[]): string {
  return execFileSync("node", [CLI, ...args], { encoding: "utf-8", stdio: "pipe" });
}

function runCliExpectError(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    execFileSync("node", [CLI, ...args], { encoding: "utf-8", stdio: "pipe" });
    return { stdout: "", stderr: "", status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      status: err.status ?? 1,
    };
  }
}

// ─── Help ─────────────────────────────────────────────────────────────────────

describe("CLI --help", () => {
  it("shows help with --help flag", () => {
    const out = runCli(["--help"]);
    expect(out).toContain("Usage:");
    expect(out).toContain("fetch");
    expect(out).toContain("search");
  });

  it("shows help with -h short flag", () => {
    const out = runCli(["-h"]);
    expect(out).toContain("Usage:");
    expect(out).toContain("Commands:");
  });

  it("lists all subcommands in help output", () => {
    const out = runCli(["--help"]);
    expect(out).toContain("batch");
    expect(out).toContain("extract");
    expect(out).toContain("map");
    expect(out).toContain("render");
    expect(out).toContain("session");
    expect(out).toContain("status");
  });
});

// ─── Version ──────────────────────────────────────────────────────────────────

describe("CLI --version", () => {
  it("shows version with --version flag", () => {
    const out = runCli(["--version"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("shows version with -v short flag", () => {
    const out = runCli(["-v"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ─── Status ──────────────────────────────────────────────────────────────────

describe("CLI status", () => {
  it("returns valid JSON with ok:true and correct tool name (no credentials)", () => {
    const out = runCli(["status"]);
    const json = JSON.parse(out);
    expect(json.ok).toBe(true);
    expect(json.tool).toBe("novada_proxy_status");
  });

  it("status output includes data and meta fields", () => {
    const out = runCli(["status"]);
    const json = JSON.parse(out);
    expect(json.data).toBeDefined();
    expect(json.meta).toBeDefined();
  });
});

// ─── Error handling ──────────────────────────────────────────────────────────

describe("CLI error handling", () => {
  it("exits 1 on unknown subcommand", () => {
    const { status } = runCliExpectError(["nonexistent"]);
    expect(status).toBe(1);
  });

  it("outputs JSON error on unknown subcommand", () => {
    const { stderr } = runCliExpectError(["nonexistent"]);
    const json = JSON.parse(stderr);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("exits with non-zero status for fetch without url", () => {
    const { status } = runCliExpectError(["fetch"]);
    expect(status).toBeGreaterThan(0);
  });

  it("outputs JSON error for fetch without url", () => {
    const { stderr } = runCliExpectError(["fetch"]);
    const json = JSON.parse(stderr);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("exits with non-zero status for extract without url", () => {
    const { status } = runCliExpectError(["extract"]);
    expect(status).toBeGreaterThan(0);
  });

  it("exits with non-zero status for search without query", () => {
    const { status } = runCliExpectError(["search"]);
    expect(status).toBeGreaterThan(0);
  });
});

// ─── Subcommand help ─────────────────────────────────────────────────────────

describe("CLI subcommand --help", () => {
  it("shows fetch subcommand help", () => {
    const out = runCli(["fetch", "--help"]);
    expect(out).toContain("Usage:");
    expect(out).toContain("fetch");
  });

  it("shows status subcommand help", () => {
    const out = runCli(["status", "--help"]);
    expect(out).toContain("Usage:");
    expect(out).toContain("status");
  });

  it("shows search subcommand help", () => {
    const out = runCli(["search", "--help"]);
    expect(out).toContain("Usage:");
    expect(out).toContain("search");
  });
});
