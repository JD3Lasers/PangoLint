import type { ReadbackOptions } from "../../src/runtime/beyondReadback";
import type { RunScriptOptions } from "../../src/runtime/runScript";
import type { McpConfig } from "./config";

export interface RuntimeToolTalkTarget {
  talkHost: string;
  talkPort: number;
}

export function readbackOptionsFromMcpConfig(config: McpConfig): Omit<ReadbackOptions, "logger" | "requestId"> {
  return {
    talkHost: config.beyondTalkHost,
    talkPort: config.beyondTalkPort,
    talkTransport: config.beyondTalkTransport,
    talkTcpHost: config.beyondTalkTcpHost,
    talkTcpPort: config.beyondTalkTcpPort,
    talkUdpHost: config.beyondTalkUdpHost,
    talkUdpPort: config.beyondTalkUdpPort,
    talkUdpFallbackAllowed: config.beyondTalkUdpFallbackAllowed,
    talkTcpPassword: config.beyondTalkTcpPassword,
    commandTimeoutMs: config.readbackTimeoutMs,
    listenHost: config.oscListenHost,
    listenPort: config.oscListenPort,
    timeoutMs: config.readbackTimeoutMs,
  };
}

export function runScriptOptionsFromMcpConfig(config: McpConfig): RunScriptOptions {
  return {
    talkHost: config.beyondTalkHost,
    talkPort: config.beyondTalkPort,
    talkTransport: config.beyondTalkTransport,
    talkTcpHost: config.beyondTalkTcpHost,
    talkTcpPort: config.beyondTalkTcpPort,
    talkUdpHost: config.beyondTalkUdpHost,
    talkUdpPort: config.beyondTalkUdpPort,
    talkUdpFallbackAllowed: config.beyondTalkUdpFallbackAllowed,
    talkTcpPassword: config.beyondTalkTcpPassword,
    commandTimeoutMs: config.readbackTimeoutMs,
  };
}

export function talkTargetFromMcpConfig(
  config: McpConfig,
  transport: "tcp" | "udp" | undefined,
): RuntimeToolTalkTarget | undefined {
  if (transport === "tcp") {
    return { talkHost: config.beyondTalkTcpHost, talkPort: config.beyondTalkTcpPort };
  }
  if (transport === "udp") {
    return { talkHost: config.beyondTalkUdpHost, talkPort: config.beyondTalkUdpPort };
  }
  return undefined;
}
