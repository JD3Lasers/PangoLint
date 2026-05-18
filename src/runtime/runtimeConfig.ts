export interface BeyondRuntimeConfig {
  talkHost: string;
  talkPort: number;
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
}

export interface RuntimeWorkspaceConfiguration {
  get<T>(key: string, fallback: T): T;
}

export const DEFAULT_BEYOND_RUNTIME_CONFIG: BeyondRuntimeConfig = {
  talkHost: "127.0.0.1",
  talkPort: 16062,
  listenHost: "0.0.0.0",
  listenPort: 7000,
  timeoutMs: 3000,
};

export function getBeyondRuntimeConfig(config: RuntimeWorkspaceConfiguration): BeyondRuntimeConfig {
  return {
    talkHost: config.get("talkHost", DEFAULT_BEYOND_RUNTIME_CONFIG.talkHost),
    talkPort: config.get("talkPort", DEFAULT_BEYOND_RUNTIME_CONFIG.talkPort),
    listenHost: config.get("oscListenHost", DEFAULT_BEYOND_RUNTIME_CONFIG.listenHost),
    listenPort: config.get("oscListenPort", DEFAULT_BEYOND_RUNTIME_CONFIG.listenPort),
    timeoutMs: config.get("readbackTimeoutMs", DEFAULT_BEYOND_RUNTIME_CONFIG.timeoutMs),
  };
}
