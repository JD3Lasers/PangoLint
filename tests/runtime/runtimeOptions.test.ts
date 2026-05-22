import { describe, expect, it } from "vitest";
import type { BeyondRuntimeConfig } from "../../src/runtime/runtimeConfig";
import {
  describeConfiguredTalkTarget,
  readbackOptionsFromRuntimeConfig,
  runScriptWithOscCaptureOptionsFromRuntimeConfig,
} from "../../src/runtime/runtimeOptions";

describe("runtime option builders", () => {
  it("maps the full BEYOND runtime config into readback options", () => {
    expect(readbackOptionsFromRuntimeConfig(runtimeConfig())).toEqual({
      talkHost: "192.0.2.20",
      talkPort: 17062,
      talkTransport: "tcp",
      talkTcpHost: "192.0.2.21",
      talkTcpPort: 17063,
      talkUdpHost: "192.0.2.20",
      talkUdpPort: 17062,
      talkUdpFallbackAllowed: true,
      talkTcpPassword: "secret",
      commandTimeoutMs: 4500,
      listenHost: "127.0.0.1",
      listenPort: 9000,
      timeoutMs: 4500,
    });
  });

  it("maps the full BEYOND runtime config into command batch options", () => {
    expect(runScriptWithOscCaptureOptionsFromRuntimeConfig(runtimeConfig())).toEqual({
      talkHost: "192.0.2.20",
      talkPort: 17062,
      talkTransport: "tcp",
      talkTcpHost: "192.0.2.21",
      talkTcpPort: 17063,
      talkUdpHost: "192.0.2.20",
      talkUdpPort: 17062,
      talkUdpFallbackAllowed: true,
      talkTcpPassword: "secret",
      commandTimeoutMs: 4500,
      listenHost: "127.0.0.1",
      listenPort: 9000,
      timeoutMs: 4500,
    });
  });

  it("describes the configured BEYOND Talk target for operator prompts", () => {
    expect(describeConfiguredTalkTarget(runtimeConfig({ talkTransport: "tcp" }))).toBe("Talk TCP at 192.0.2.21:17063");
    expect(describeConfiguredTalkTarget(runtimeConfig({ talkTransport: "udp" }))).toBe("Talk UDP at 192.0.2.20:17062");
    expect(describeConfiguredTalkTarget(runtimeConfig({ talkTransport: "auto" }))).toBe(
      "Talk TCP at 192.0.2.21:17063 with UDP fallback allowed",
    );
  });
});

function runtimeConfig(overrides: Partial<BeyondRuntimeConfig> = {}): BeyondRuntimeConfig {
  return {
    talkTransport: "tcp",
    talkHost: "192.0.2.20",
    talkPort: 17062,
    talkTcpHost: "192.0.2.21",
    talkTcpPort: 17063,
    talkUdpHost: "192.0.2.20",
    talkUdpPort: 17062,
    talkUdpFallbackAllowed: true,
    talkTcpPassword: "secret",
    listenHost: "127.0.0.1",
    listenPort: 9000,
    timeoutMs: 4500,
    ...overrides,
  };
}
