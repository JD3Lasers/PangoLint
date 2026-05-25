import { describe, expect, it } from "vitest";
import { DEFAULT_BEYOND_RUNTIME_CONFIG } from "../../src/runtime/runtimeConfig";
import { loadConfig } from "../src/config";
import { fail, ok } from "../src/toolResult";

describe("loadConfig", () => {
  it("returns defaults with runtime disabled when no env is set", () => {
    const cfg = loadConfig({});
    expect(cfg).toEqual({
      runtimeReadEnabled: false,
      runtimeWriteEnabled: false,
      beyondTalkTransport: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTransport,
      beyondTalkHost: DEFAULT_BEYOND_RUNTIME_CONFIG.talkHost,
      beyondTalkPort: DEFAULT_BEYOND_RUNTIME_CONFIG.talkPort,
      beyondTalkTcpHost: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpHost,
      beyondTalkTcpPort: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPort,
      beyondTalkTcpEchoMode: 2,
      beyondTalkUdpHost: DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpHost,
      beyondTalkUdpPort: DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpPort,
      beyondTalkUdpFallbackAllowed: DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpFallbackAllowed,
      beyondTalkTcpPassword: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPassword,
      oscListenHost: DEFAULT_BEYOND_RUNTIME_CONFIG.listenHost,
      oscListenPort: DEFAULT_BEYOND_RUNTIME_CONFIG.listenPort,
      readbackTimeoutMs: DEFAULT_BEYOND_RUNTIME_CONFIG.timeoutMs,
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
      PANGOLINT_MCP_BEYOND_TALK_TRANSPORT: "tcp",
      PANGOLINT_MCP_BEYOND_TALK_TCP_HOST: "192.0.2.148",
      PANGOLINT_MCP_BEYOND_TALK_TCP_PORT: "16063",
      PANGOLINT_MCP_BEYOND_TALK_TCP_ECHO_MODE: "3",
      PANGOLINT_MCP_BEYOND_TALK_UDP_HOST: "192.0.2.149",
      PANGOLINT_MCP_BEYOND_TALK_UDP_PORT: "16064",
      PANGOLINT_MCP_BEYOND_TALK_UDP_FALLBACK_ALLOWED: "true",
      PANGOLINT_MCP_BEYOND_TALK_TCP_PASSWORD: "secret",
    });
    expect(cfg.beyondTalkTransport).toBe("tcp");
    expect(cfg.beyondTalkHost).toBe("192.0.2.149");
    expect(cfg.beyondTalkPort).toBe(16064);
    expect(cfg.beyondTalkTcpHost).toBe("192.0.2.148");
    expect(cfg.beyondTalkTcpPort).toBe(16063);
    expect(cfg.beyondTalkTcpEchoMode).toBe(3);
    expect(cfg.beyondTalkUdpHost).toBe("192.0.2.149");
    expect(cfg.beyondTalkUdpPort).toBe(16064);
    expect(cfg.beyondTalkUdpFallbackAllowed).toBe(true);
    expect(cfg.beyondTalkTcpPassword).toBe("secret");
  });

  it("uses legacy talk host and port as UDP defaults when UDP env vars are unset", () => {
    const cfg = loadConfig({
      PANGOLINT_MCP_BEYOND_TALK_HOST: "192.0.2.147",
      PANGOLINT_MCP_BEYOND_TALK_PORT: "16062",
    });
    expect(cfg.beyondTalkHost).toBe("192.0.2.147");
    expect(cfg.beyondTalkPort).toBe(16062);
    expect(cfg.beyondTalkUdpHost).toBe("192.0.2.147");
    expect(cfg.beyondTalkUdpPort).toBe(16062);
  });

  it("rejects out-of-range ports", () => {
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_PORT: "0" })).toThrow(/valid port/);
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_PORT: "70000" })).toThrow(/valid port/);
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_TCP_PORT: "70000" })).toThrow(/valid port/);
  });

  it("rejects invalid talk transport values", () => {
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_TRANSPORT: "http" })).toThrow(/transport/);
  });

  it("rejects invalid Talk TCP echo modes", () => {
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_TCP_ECHO_MODE: "0" })).toThrow(/echo mode/);
    expect(() => loadConfig({ PANGOLINT_MCP_BEYOND_TALK_TCP_ECHO_MODE: "2.5" })).toThrow(/echo mode/);
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
