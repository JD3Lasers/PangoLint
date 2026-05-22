// Loads PangoLint MCP configuration from environment variables.
//
// Runtime layers:
//   1. Knowledge tools always work; they don't read this config.
//   2. Runtime read tools (healthCheck, readBeyondProperty) require
//      PANGOLINT_MCP_RUNTIME_READ=enabled. The legacy
//      PANGOLINT_MCP_RUNTIME=enabled flag also enables read tools only.
//   3. Runtime write tools (runScript) require
//      PANGOLINT_MCP_RUNTIME_WRITE=enabled. Write opt-in also enables read
//      tools so agents can inspect before sending.
//
// Network target (host/port) is fixed at startup; the agent cannot
// redirect runtime calls. This is the primary network-safety boundary.

import { DEFAULT_BEYOND_RUNTIME_CONFIG } from "../../src/runtime/runtimeConfig";
import { MCP_ENV_VARS, parseMcpBoolean, parseMcpPort, parseMcpPositiveInt, parseMcpTalkTransport } from "./configEnv";

export interface McpConfig {
  /** Whether read-only runtime tools (healthCheck, readBeyondProperty) are enabled. */
  runtimeReadEnabled: boolean;
  /** Whether write runtime tools (runScript) are enabled. */
  runtimeWriteEnabled: boolean;
  /** BEYOND Talk transport mode. */
  beyondTalkTransport: "auto" | "tcp" | "udp";
  /** Legacy BEYOND Talk UDP host alias. */
  beyondTalkHost: string;
  /** Legacy BEYOND Talk UDP port alias. */
  beyondTalkPort: number;
  /** BEYOND Talk TCP host. */
  beyondTalkTcpHost: string;
  /** BEYOND Talk TCP port. */
  beyondTalkTcpPort: number;
  /** BEYOND Talk UDP host. */
  beyondTalkUdpHost: string;
  /** BEYOND Talk UDP port. */
  beyondTalkUdpPort: number;
  /** Whether auto transport may fall back to unauthenticated Talk UDP. */
  beyondTalkUdpFallbackAllowed: boolean;
  /** Optional BEYOND TCP Talk Server password. Never return this from getServerConfig. */
  beyondTalkTcpPassword: string;
  /** Local interface for OSC callbacks. */
  oscListenHost: string;
  /** Local UDP port for OSC callbacks. */
  oscListenPort: number;
  /** Readback timeout in milliseconds. */
  readbackTimeoutMs: number;
}

const DEFAULT_CONFIG: McpConfig = {
  runtimeReadEnabled: false,
  runtimeWriteEnabled: false,
  beyondTalkTransport: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTransport,
  beyondTalkHost: DEFAULT_BEYOND_RUNTIME_CONFIG.talkHost,
  beyondTalkPort: DEFAULT_BEYOND_RUNTIME_CONFIG.talkPort,
  beyondTalkTcpHost: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpHost,
  beyondTalkTcpPort: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPort,
  beyondTalkUdpHost: DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpHost,
  beyondTalkUdpPort: DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpPort,
  beyondTalkUdpFallbackAllowed: DEFAULT_BEYOND_RUNTIME_CONFIG.talkUdpFallbackAllowed,
  beyondTalkTcpPassword: DEFAULT_BEYOND_RUNTIME_CONFIG.talkTcpPassword,
  oscListenHost: DEFAULT_BEYOND_RUNTIME_CONFIG.listenHost,
  oscListenPort: DEFAULT_BEYOND_RUNTIME_CONFIG.listenPort,
  readbackTimeoutMs: DEFAULT_BEYOND_RUNTIME_CONFIG.timeoutMs,
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const runtimeWriteEnabled = parseMcpBoolean(env[MCP_ENV_VARS.runtimeWrite]);
  const runtimeReadEnabled =
    runtimeWriteEnabled ||
    parseMcpBoolean(env[MCP_ENV_VARS.runtimeRead]) ||
    parseMcpBoolean(env[MCP_ENV_VARS.runtimeLegacy]);
  const legacyTalkHost = env[MCP_ENV_VARS.talkHost]?.trim() || DEFAULT_CONFIG.beyondTalkHost;
  const legacyTalkPort = parseMcpPort(env[MCP_ENV_VARS.talkPort], DEFAULT_CONFIG.beyondTalkPort, MCP_ENV_VARS.talkPort);
  const beyondTalkUdpHost = env[MCP_ENV_VARS.talkUdpHost]?.trim() || legacyTalkHost;
  const beyondTalkUdpPort = parseMcpPort(env[MCP_ENV_VARS.talkUdpPort], legacyTalkPort, MCP_ENV_VARS.talkUdpPort);

  return {
    runtimeReadEnabled,
    runtimeWriteEnabled,
    beyondTalkTransport: parseMcpTalkTransport(env[MCP_ENV_VARS.talkTransport]),
    beyondTalkHost: beyondTalkUdpHost,
    beyondTalkPort: beyondTalkUdpPort,
    beyondTalkTcpHost: env[MCP_ENV_VARS.talkTcpHost]?.trim() || DEFAULT_CONFIG.beyondTalkTcpHost,
    beyondTalkTcpPort: parseMcpPort(
      env[MCP_ENV_VARS.talkTcpPort],
      DEFAULT_CONFIG.beyondTalkTcpPort,
      MCP_ENV_VARS.talkTcpPort,
    ),
    beyondTalkUdpHost,
    beyondTalkUdpPort,
    beyondTalkUdpFallbackAllowed: parseMcpBoolean(env[MCP_ENV_VARS.talkUdpFallbackAllowed]),
    beyondTalkTcpPassword: env[MCP_ENV_VARS.talkTcpPassword] ?? DEFAULT_CONFIG.beyondTalkTcpPassword,
    oscListenHost: env[MCP_ENV_VARS.oscListenHost]?.trim() || DEFAULT_CONFIG.oscListenHost,
    oscListenPort: parseMcpPort(
      env[MCP_ENV_VARS.oscListenPort],
      DEFAULT_CONFIG.oscListenPort,
      MCP_ENV_VARS.oscListenPort,
    ),
    readbackTimeoutMs: parseMcpPositiveInt(
      env[MCP_ENV_VARS.readbackTimeoutMs],
      DEFAULT_CONFIG.readbackTimeoutMs,
      MCP_ENV_VARS.readbackTimeoutMs,
    ),
  };
}
