import { describe, expect, it } from "vitest";
import type { McpConfig } from "../src/config";
import {
  readbackOptionsFromMcpConfig,
  runScriptOptionsFromMcpConfig,
  talkTargetFromMcpConfig,
} from "../src/runtimeToolOptions";

describe("MCP runtime option builders", () => {
  it("maps MCP config into readback options", () => {
    expect(readbackOptionsFromMcpConfig(config())).toEqual({
      talkHost: "192.0.2.30",
      talkPort: 18062,
      talkTransport: "auto",
      talkTcpHost: "192.0.2.31",
      talkTcpPort: 18063,
      talkUdpHost: "192.0.2.30",
      talkUdpPort: 18062,
      talkUdpFallbackAllowed: true,
      talkTcpPassword: "secret",
      commandTimeoutMs: 5500,
      listenHost: "127.0.0.1",
      listenPort: 9100,
      timeoutMs: 5500,
    });
  });

  it("maps MCP config into command batch options", () => {
    expect(runScriptOptionsFromMcpConfig(config())).toEqual({
      talkHost: "192.0.2.30",
      talkPort: 18062,
      talkTransport: "auto",
      talkTcpHost: "192.0.2.31",
      talkTcpPort: 18063,
      talkUdpHost: "192.0.2.30",
      talkUdpPort: 18062,
      talkUdpFallbackAllowed: true,
      talkTcpPassword: "secret",
      commandTimeoutMs: 5500,
    });
  });

  it("returns the target that matches the transport used by the runtime result", () => {
    expect(talkTargetFromMcpConfig(config(), "tcp")).toEqual({
      talkHost: "192.0.2.31",
      talkPort: 18063,
    });
    expect(talkTargetFromMcpConfig(config(), "udp")).toEqual({
      talkHost: "192.0.2.30",
      talkPort: 18062,
    });
    expect(talkTargetFromMcpConfig(config(), undefined)).toBeUndefined();
  });
});

function config(): McpConfig {
  return {
    runtimeReadEnabled: true,
    runtimeWriteEnabled: true,
    beyondTalkTransport: "auto",
    beyondTalkHost: "192.0.2.30",
    beyondTalkPort: 18062,
    beyondTalkTcpHost: "192.0.2.31",
    beyondTalkTcpPort: 18063,
    beyondTalkUdpHost: "192.0.2.30",
    beyondTalkUdpPort: 18062,
    beyondTalkUdpFallbackAllowed: true,
    beyondTalkTcpPassword: "secret",
    oscListenHost: "127.0.0.1",
    oscListenPort: 9100,
    readbackTimeoutMs: 5500,
  };
}
