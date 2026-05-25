import type { RunScriptOptions } from "./commandBatch/runScript";
import type { RunScriptWithOscCaptureOptions } from "./commandBatch/runScriptWithOscCapture";
import type { ReadbackOptions } from "./readback/readbackTypes";
import type { BeyondRuntimeConfig } from "./runtimeConfig";

export function readbackOptionsFromRuntimeConfig(
  config: BeyondRuntimeConfig,
): Omit<ReadbackOptions, "logger" | "requestId"> {
  return {
    talkHost: config.talkHost,
    talkPort: config.talkPort,
    talkTransport: config.talkTransport,
    talkTcpHost: config.talkTcpHost,
    talkTcpPort: config.talkTcpPort,
    talkUdpHost: config.talkUdpHost,
    talkUdpPort: config.talkUdpPort,
    talkUdpFallbackAllowed: config.talkUdpFallbackAllowed,
    talkTcpPassword: config.talkTcpPassword,
    talkTcpEchoMode: config.talkTcpEchoMode,
    commandTimeoutMs: config.timeoutMs,
    listenHost: config.listenHost,
    listenPort: config.listenPort,
    timeoutMs: config.timeoutMs,
  };
}

function runScriptOptionsFromRuntimeConfig(config: BeyondRuntimeConfig): RunScriptOptions {
  return {
    talkHost: config.talkHost,
    talkPort: config.talkPort,
    talkTransport: config.talkTransport,
    talkTcpHost: config.talkTcpHost,
    talkTcpPort: config.talkTcpPort,
    talkUdpHost: config.talkUdpHost,
    talkUdpPort: config.talkUdpPort,
    talkUdpFallbackAllowed: config.talkUdpFallbackAllowed,
    talkTcpPassword: config.talkTcpPassword,
    talkTcpEchoMode: config.talkTcpEchoMode,
    commandTimeoutMs: config.timeoutMs,
  };
}

export function runScriptWithOscCaptureOptionsFromRuntimeConfig(
  config: BeyondRuntimeConfig,
): Omit<RunScriptWithOscCaptureOptions, "capturePrefix" | "maxCallbackMessages" | "startCapture"> {
  return {
    ...runScriptOptionsFromRuntimeConfig(config),
    listenHost: config.listenHost,
    listenPort: config.listenPort,
    timeoutMs: config.timeoutMs,
  };
}

export function describeConfiguredTalkTarget(config: BeyondRuntimeConfig): string {
  if (config.talkTransport === "tcp") {
    return `Talk TCP at ${config.talkTcpHost}:${config.talkTcpPort}`;
  }
  if (config.talkTransport === "udp") {
    return `Talk UDP at ${config.talkUdpHost}:${config.talkUdpPort}`;
  }
  return `Talk TCP at ${config.talkTcpHost}:${config.talkTcpPort} with UDP fallback ${
    config.talkUdpFallbackAllowed ? "allowed" : "disabled"
  }`;
}
