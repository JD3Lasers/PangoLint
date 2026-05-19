import type { BeyondTalkTransport } from "./runScript";

export interface BeyondRuntimeConfig {
  talkTransport: BeyondTalkTransport;
  talkHost: string;
  talkPort: number;
  talkTcpHost: string;
  talkTcpPort: number;
  talkUdpHost: string;
  talkUdpPort: number;
  talkUdpFallbackAllowed: boolean;
  talkTcpPassword: string;
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
}

export interface RuntimeWorkspaceConfiguration {
  get<T>(key: string, fallback: T): T;
}

export const DEFAULT_BEYOND_RUNTIME_CONFIG: BeyondRuntimeConfig = {
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
};

export function getBeyondRuntimeConfig(config: RuntimeWorkspaceConfiguration): BeyondRuntimeConfig {
  const legacyTalkHost = config.get("talkHost", DEFAULT_BEYOND_RUNTIME_CONFIG.talkHost);
  const legacyTalkPort = config.get("talkPort", DEFAULT_BEYOND_RUNTIME_CONFIG.talkPort);
  const talkUdpHost = config.get("talkUdpHost", legacyTalkHost);
  const talkUdpPort = config.get("talkUdpPort", legacyTalkPort);
  return {
    talkTransport: config.get("talkTransport", DEFAULT_BEYOND_RUNTIME_CONFIG.talkTransport),
    talkHost: talkUdpHost,
    talkPort: talkUdpPort,
    talkTcpHost: config.get("talkTcpHost", DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpHost),
    talkTcpPort: config.get("talkTcpPort", DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPort),
    talkUdpHost,
    talkUdpPort,
    talkUdpFallbackAllowed: config.get("talkUdpFallbackAllowed", DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpFallbackAllowed),
    talkTcpPassword: config.get("talkTcpPassword", DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPassword),
    listenHost: config.get("oscListenHost", DEFAULT_BEYOND_RUNTIME_CONFIG.listenHost),
    listenPort: config.get("oscListenPort", DEFAULT_BEYOND_RUNTIME_CONFIG.listenPort),
    timeoutMs: config.get("readbackTimeoutMs", DEFAULT_BEYOND_RUNTIME_CONFIG.timeoutMs),
  };
}
