import { describe, expect, it } from "vitest";
import { fail, loadConfig, ok } from "../src/config";

describe("loadConfig", () => {
  it("returns defaults with runtime disabled when no env is set", () => {
    const cfg = loadConfig({});
    expect(cfg).toEqual({
      runtimeReadEnabled: false,
      runtimeWriteEnabled: false,
      beyondTalkHost: "127.0.0.1",
      beyondTalkPort: 16062,
      oscListenHost: "0.0.0.0",
      oscListenPort: 7000,
      readbackTimeoutMs: 3000,
    });
  });

  it("enables read runtime when PANGOLINT_MCP_RUNTIME=enabled", () => {
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME_READ: "enabled" }).runtimeReadEnabled).toBe(true);
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME: "enabled" }).runtimeReadEnabled).toBe(true);
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME: "1" }).runtimeReadEnabled).toBe(true);
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME: "true" }).runtimeReadEnabled).toBe(true);
  });

  it("does not enable write runtime through the legacy runtime flag", () => {
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME: "enabled" }).runtimeWriteEnabled).toBe(false);
  });

  it("enables read and write runtime when PANGOLINT_MCP_RUNTIME_WRITE=enabled", () => {
    const cfg = loadConfig({ PANGOLINT_MCP_RUNTIME_WRITE: "enabled" });
    expect(cfg.runtimeReadEnabled).toBe(true);
    expect(cfg.runtimeWriteEnabled).toBe(true);
  });

  it("leaves runtime disabled for other values", () => {
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME: "no" }).runtimeReadEnabled).toBe(false);
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME: "" }).runtimeReadEnabled).toBe(false);
    expect(loadConfig({ PANGOLINT_MCP_RUNTIME_WRITE: "no" }).runtimeWriteEnabled).toBe(false);
  });

  it("overrides talk host / port via env", () => {
    const cfg = loadConfig({
      PANGOLINT_MCP_BEYOND_TALK_HOST: "192.0.2.147",
      PANGOLINT_MCP_BEYOND_TALK_PORT: "16062",
    });
    expect(cfg.beyondTalkHost).toBe("192.0.2.147");
    expect(cfg.beyondTalkPort).toBe(16062);
  });

  it("rejects out-of-range ports", () => {
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_PORT: "0" })).toThrow(/valid port/);
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_PORT: "70000" })).toThrow(/valid port/);
  });

  it("rejects non-positive readback timeouts", () => {
    expect(() => loadConfig({ PANGOLINT_MCP_READBACK_TIMEOUT_MS: "-5" })).toThrow(/positive/);
  });
});

describe("ok / fail helpers", () => {
  it("ok wraps the payload", () => {
    expect(ok({ x: 1 })).toEqual({ ok: true, data: { x: 1 } });
  });

  it("fail returns blocked when requested", () => {
    expect(fail("nope", true)).toEqual({ ok: false, error: "nope", blocked: true });
    expect(fail("nope")).toEqual({ ok: false, error: "nope" });
  });
});
