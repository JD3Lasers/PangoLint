import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_BEYOND_RUNTIME_CONFIG, getBeyondRuntimeConfig } from "../../src/runtime/runtimeConfig";

describe("BEYOND runtime configuration defaults", () => {
  it("matches the VS Code manifest defaults", () => {
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const properties = packageJson.contributes.configuration.properties;

    expect(DEFAULT_BEYOND_RUNTIME_CONFIG).toEqual({
      talkTransport: properties["pangolint.beyond.talkTransport"].default,
      talkHost: properties["pangolint.beyond.talkHost"].default,
      talkPort: properties["pangolint.beyond.talkPort"].default,
      talkTcpHost: properties["pangolint.beyond.talkTcpHost"].default,
      talkTcpPort: properties["pangolint.beyond.talkTcpPort"].default,
      talkUdpHost: properties["pangolint.beyond.talkUdpHost"].default,
      talkUdpPort: properties["pangolint.beyond.talkUdpPort"].default,
      talkUdpFallbackAllowed: properties["pangolint.beyond.talkUdpFallbackAllowed"].default,
      talkTcpPassword: properties["pangolint.beyond.talkTcpPassword"].default,
      listenHost: properties["pangolint.beyond.oscListenHost"].default,
      listenPort: properties["pangolint.beyond.oscListenPort"].default,
      timeoutMs: properties["pangolint.beyond.readbackTimeoutMs"].default,
    });
  });

  it("uses the production-safe localhost target when settings are unset", () => {
    const config = getBeyondRuntimeConfig({
      get: (_key, fallback) => fallback,
    });

    expect(config).toEqual({
      talkTransport: "auto",
      talkHost: "127.0.0.1",
      talkPort: 16062,
      talkTcpHost: "127.0.0.1",
      talkTcpPort: 16063,
      talkUdpHost: "127.0.0.1",
      talkUdpPort: 16062,
      talkUdpFallbackAllowed: false,
      talkTcpPassword: "",
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 3000,
    });
  });

  it("respects workspace overrides", () => {
    const overrides = new Map<string, string | number | boolean>([
      ["talkTransport", "tcp"],
      ["talkHost", "192.0.2.10"],
      ["talkPort", 17000],
      ["talkTcpHost", "192.0.2.11"],
      ["talkTcpPort", 17001],
      ["talkUdpHost", "192.0.2.12"],
      ["talkUdpPort", 17002],
      ["talkUdpFallbackAllowed", true],
      ["talkTcpPassword", "secret"],
      ["oscListenHost", "127.0.0.1"],
      ["oscListenPort", 9000],
      ["readbackTimeoutMs", 5000],
    ]);

    const config = getBeyondRuntimeConfig({
      get: (key, fallback) => (overrides.get(key) ?? fallback) as typeof fallback,
    });

    expect(config).toEqual({
      talkTransport: "tcp",
      talkHost: "192.0.2.12",
      talkPort: 17002,
      talkTcpHost: "192.0.2.11",
      talkTcpPort: 17001,
      talkUdpHost: "192.0.2.12",
      talkUdpPort: 17002,
      talkUdpFallbackAllowed: true,
      talkTcpPassword: "secret",
      listenHost: "127.0.0.1",
      listenPort: 9000,
      timeoutMs: 5000,
    });
  });

  it("uses legacy talkHost and talkPort as UDP fallbacks when UDP settings are unset", () => {
    const overrides = new Map<string, string | number>([
      ["talkHost", "192.0.2.10"],
      ["talkPort", 17000],
    ]);

    const config = getBeyondRuntimeConfig({
      get: (key, fallback) => (overrides.get(key) ?? fallback) as typeof fallback,
    });

    expect(config.talkUdpHost).toBe("192.0.2.10");
    expect(config.talkUdpPort).toBe(17000);
    expect(config.talkHost).toBe("192.0.2.10");
    expect(config.talkPort).toBe(17000);
  });
});
