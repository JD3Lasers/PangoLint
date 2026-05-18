import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_BEYOND_RUNTIME_CONFIG, getBeyondRuntimeConfig } from "../../src/runtime/runtimeConfig";

describe("BEYOND runtime configuration defaults", () => {
  it("matches the VS Code manifest defaults", () => {
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const properties = packageJson.contributes.configuration.properties;

    expect(DEFAULT_BEYOND_RUNTIME_CONFIG).toEqual({
      talkHost: properties["pangolint.beyond.talkHost"].default,
      talkPort: properties["pangolint.beyond.talkPort"].default,
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
      talkHost: "127.0.0.1",
      talkPort: 16062,
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 3000,
    });
  });

  it("respects workspace overrides", () => {
    const overrides = new Map<string, string | number>([
      ["talkHost", "192.0.2.10"],
      ["talkPort", 17000],
      ["oscListenHost", "127.0.0.1"],
      ["oscListenPort", 9000],
      ["readbackTimeoutMs", 5000],
    ]);

    const config = getBeyondRuntimeConfig({
      get: (key, fallback) => (overrides.get(key) ?? fallback) as typeof fallback,
    });

    expect(config).toEqual({
      talkHost: "192.0.2.10",
      talkPort: 17000,
      listenHost: "127.0.0.1",
      listenPort: 9000,
      timeoutMs: 5000,
    });
  });
});
