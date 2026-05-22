import { EXTENSION_SETTING_KEYS } from "../extensionHost/extensionIds";
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
  const legacyTalkHost = config.get(EXTENSION_SETTING_KEYS.talkHost, DEFAULT_BEYOND_RUNTIME_CONFIG.talkHost);
  const legacyTalkPort = config.get(EXTENSION_SETTING_KEYS.talkPort, DEFAULT_BEYOND_RUNTIME_CONFIG.talkPort);
  const talkUdpHost = config.get(EXTENSION_SETTING_KEYS.talkUdpHost, legacyTalkHost);
  const talkUdpPort = config.get(EXTENSION_SETTING_KEYS.talkUdpPort, legacyTalkPort);
  return {
    talkTransport: config.get(EXTENSION_SETTING_KEYS.talkTransport, DEFAULT_BEYOND_RUNTIME_CONFIG.talkTransport),
    talkHost: talkUdpHost,
    talkPort: talkUdpPort,
    talkTcpHost: config.get(EXTENSION_SETTING_KEYS.talkTcpHost, DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpHost),
    talkTcpPort: config.get(EXTENSION_SETTING_KEYS.talkTcpPort, DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPort),
    talkUdpHost,
    talkUdpPort,
    talkUdpFallbackAllowed: config.get(
      EXTENSION_SETTING_KEYS.talkUdpFallbackAllowed,
      DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpFallbackAllowed,
    ),
    talkTcpPassword: config.get(EXTENSION_SETTING_KEYS.talkTcpPassword, DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPassword),
    listenHost: config.get(EXTENSION_SETTING_KEYS.oscListenHost, DEFAULT_BEYOND_RUNTIME_CONFIG.listenHost),
    listenPort: config.get(EXTENSION_SETTING_KEYS.oscListenPort, DEFAULT_BEYOND_RUNTIME_CONFIG.listenPort),
    timeoutMs: config.get(EXTENSION_SETTING_KEYS.readbackTimeoutMs, DEFAULT_BEYOND_RUNTIME_CONFIG.timeoutMs),
  };
}
