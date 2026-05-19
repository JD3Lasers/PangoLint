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
  beyondTalkTransport: "auto",
  beyondTalkHost: "127.0.0.1",
  beyondTalkPort: 16062,
  beyondTalkTcpHost: "127.0.0.1",
  beyondTalkTcpPort: 16063,
  beyondTalkUdpHost: "127.0.0.1",
  beyondTalkUdpPort: 16062,
  beyondTalkUdpFallbackAllowed: false,
  beyondTalkTcpPassword: "",
  oscListenHost: "0.0.0.0",
  oscListenPort: 7000,
  readbackTimeoutMs: 3000,
};

function parseBool(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw.trim().toLowerCase() === "enabled" || raw.trim() === "1" || raw.trim().toLowerCase() === "true";
}

function parsePort(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`${name}=${raw} is not a valid port (1-65535)`);
  }
  return n;
}

function parsePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name}=${raw} must be a positive number`);
  }
  return n;
}

function parseTalkTransport(raw: string | undefined): McpConfig["beyondTalkTransport"] {
  if (raw === undefined || raw === "") return DEFAULT_CONFIG.beyondTalkTransport;
  const value = raw.trim().toLowerCase();
  if (value === "auto" || value === "tcp" || value === "udp") {
    return value;
  }
  throw new Error(`${raw} is not a valid BEYOND Talk transport (auto, tcp, udp)`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const runtimeWriteEnabled = parseBool(env.PANGOLINT_MCP_RUNTIME_WRITE);
  const runtimeReadEnabled =
    runtimeWriteEnabled || parseBool(env.PANGOLINT_MCP_RUNTIME_READ) || parseBool(env.PANGOLINT_MCP_RUNTIME);
  const legacyTalkHost = env.PANGOLINT_MCP_BEYOND_TALK_HOST?.trim() || DEFAULT_CONFIG.beyondTalkHost;
  const legacyTalkPort = parsePort(
    env.PANGOLINT_MCP_BEYOND_TALK_PORT,
    DEFAULT_CONFIG.beyondTalkPort,
    "PANGOLINT_MCP_BEYOND_TALK_PORT",
  );
  const beyondTalkUdpHost = env.PANGOLINT_MCP_BEYOND_TALK_UDP_HOST?.trim() || legacyTalkHost;
  const beyondTalkUdpPort = parsePort(
    env.PANGOLINT_MCP_BEYOND_TALK_UDP_PORT,
    legacyTalkPort,
    "PANGOLINT_MCP_BEYOND_TALK_UDP_PORT",
  );

  return {
    runtimeReadEnabled,
    runtimeWriteEnabled,
    beyondTalkTransport: parseTalkTransport(env.PANGOLINT_MCP_BEYOND_TALK_TRANSPORT),
    beyondTalkHost: beyondTalkUdpHost,
    beyondTalkPort: beyondTalkUdpPort,
    beyondTalkTcpHost: env.PANGOLINT_MCP_BEYOND_TALK_TCP_HOST?.trim() || DEFAULT_CONFIG.beyondTalkTcpHost,
    beyondTalkTcpPort: parsePort(
      env.PANGOLINT_MCP_BEYOND_TALK_TCP_PORT,
      DEFAULT_CONFIG.beyondTalkTcpPort,
      "PANGOLINT_MCP_BEYOND_TALK_TCP_PORT",
    ),
    beyondTalkUdpHost,
    beyondTalkUdpPort,
    beyondTalkUdpFallbackAllowed: parseBool(env.PANGOLINT_MCP_BEYOND_TALK_UDP_FALLBACK_ALLOWED),
    beyondTalkTcpPassword: env.PANGOLINT_MCP_BEYOND_TALK_TCP_PASSWORD ?? DEFAULT_CONFIG.beyondTalkTcpPassword,
    oscListenHost: env.PANGOLINT_MCP_BEYOND_OSC_LISTEN_HOST?.trim() || DEFAULT_CONFIG.oscListenHost,
    oscListenPort: parsePort(
      env.PANGOLINT_MCP_BEYOND_OSC_LISTEN_PORT,
      DEFAULT_CONFIG.oscListenPort,
      "PANGOLINT_MCP_BEYOND_OSC_LISTEN_PORT",
    ),
    readbackTimeoutMs: parsePositiveInt(
      env.PANGOLINT_MCP_READBACK_TIMEOUT_MS,
      DEFAULT_CONFIG.readbackTimeoutMs,
      "PANGOLINT_MCP_READBACK_TIMEOUT_MS",
    ),
  };
}

/**
 * Structured response shape used by every tool. Agents handle structured
 * errors more cleanly than thrown exceptions; the MCP protocol delivers
 * the JSON as a text content block.
 */
export interface ToolError {
  ok: false;
  error: string;
  blocked?: boolean;
}

export interface ToolSuccess<T> {
  ok: true;
  data: T;
}

export type ToolResult<T> = ToolSuccess<T> | ToolError;

export function ok<T>(data: T): ToolSuccess<T> {
  return { ok: true, data };
}

export function fail(error: string, blocked = false): ToolError {
  return blocked ? { ok: false, error, blocked: true } : { ok: false, error };
}
