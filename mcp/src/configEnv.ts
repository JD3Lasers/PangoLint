import { DEFAULT_BEYOND_RUNTIME_CONFIG } from "../../src/runtime/runtimeConfig";

export const MCP_ENV_VARS = {
  runtimeRead: "PANGOLINT_MCP_RUNTIME_READ",
  runtimeLegacy: "PANGOLINT_MCP_RUNTIME",
  runtimeWrite: "PANGOLINT_MCP_RUNTIME_WRITE",
  dataDir: "PANGOLINT_MCP_DATA_DIR",
  talkHost: "PANGOLINT_MCP_BEYOND_TALK_HOST",
  talkPort: "PANGOLINT_MCP_BEYOND_TALK_PORT",
  talkTransport: "PANGOLINT_MCP_BEYOND_TALK_TRANSPORT",
  talkTcpHost: "PANGOLINT_MCP_BEYOND_TALK_TCP_HOST",
  talkTcpPort: "PANGOLINT_MCP_BEYOND_TALK_TCP_PORT",
  talkUdpHost: "PANGOLINT_MCP_BEYOND_TALK_UDP_HOST",
  talkUdpPort: "PANGOLINT_MCP_BEYOND_TALK_UDP_PORT",
  talkUdpFallbackAllowed: "PANGOLINT_MCP_BEYOND_TALK_UDP_FALLBACK_ALLOWED",
  talkTcpPassword: "PANGOLINT_MCP_BEYOND_TALK_TCP_PASSWORD",
  oscListenHost: "PANGOLINT_MCP_BEYOND_OSC_LISTEN_HOST",
  oscListenPort: "PANGOLINT_MCP_BEYOND_OSC_LISTEN_PORT",
  readbackTimeoutMs: "PANGOLINT_MCP_READBACK_TIMEOUT_MS",
} as const;

export function parseMcpBoolean(raw: string | undefined): boolean {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "enabled" || value === "1" || value === "true";
}

export function parseMcpPort(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`${name}=${raw} is not a valid port (1-65535)`);
  }
  return n;
}

export function parseMcpPositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name}=${raw} must be a positive number`);
  }
  return n;
}

export function parseMcpTalkTransport(
  raw: string | undefined,
): (typeof DEFAULT_BEYOND_RUNTIME_CONFIG)["talkTransport"] {
  if (raw === undefined || raw === "") return DEFAULT_BEYOND_RUNTIME_CONFIG.talkTransport;
  const value = raw.trim().toLowerCase();
  if (value === "auto" || value === "tcp" || value === "udp") {
    return value;
  }
  throw new Error(`${raw} is not a valid BEYOND Talk transport (auto, tcp, udp)`);
}
