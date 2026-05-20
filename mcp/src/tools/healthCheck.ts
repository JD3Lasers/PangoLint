// Tool: healthCheck - verifies the configured BEYOND target is reachable.
//
// Two-stage check:
//   1. Resolve the host via DNS (catches typos in PANGOLINT_MCP_BEYOND_TALK_HOST
//      before any socket creation).
//   2. Open + close a UDP socket bound to the target. UDP is connectionless
//      so this only proves the local end can address the remote - it cannot
//      detect whether BEYOND is actually listening on the other side.
//      That's the right tradeoff for a fast pre-flight check; deeper
//      verification belongs to readBeyondProperty (which actually waits for an
//      OSC callback).

import dgram from "node:dgram";
import { lookup } from "node:dns/promises";
import type { McpConfig } from "../config";
import { fail, ok, type ToolResult } from "../config";

export interface HealthCheckOutput {
  reachable: boolean;
  host: string;
  port: number;
  resolvedAddress?: string;
  family?: 4 | 6;
  elapsedMs: number;
  error?: string;
}

export type HealthCheckResult = ToolResult<HealthCheckOutput>;

export interface HealthCheckDeps {
  /** Resolves a hostname to an address; defaults to node:dns/promises.lookup. */
  resolve?: (host: string) => Promise<{ address: string; family: 4 | 6 }>;
  /** Creates + binds a UDP socket; defaults to node:dgram. Test socket check. */
  socketCheck?: (address: string, port: number, family: 4 | 6) => Promise<void>;
  /** Clock for elapsed-time measurement. Test clock. */
  now?: () => number;
}

const defaultResolve = async (host: string): Promise<{ address: string; family: 4 | 6 }> => {
  const result = await lookup(host);
  return { address: result.address, family: result.family as 4 | 6 };
};

const defaultSocketCheck = (address: string, port: number, family: 4 | 6): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const socket = dgram.createSocket(family === 6 ? "udp6" : "udp4");
    socket.on("error", (err) => {
      socket.close();
      reject(err);
    });
    try {
      // connect() on a UDP socket binds the remote endpoint and validates the
      // address - no packet is sent.
      socket.connect(port, address, () => {
        socket.close();
        resolve();
      });
    } catch (err) {
      socket.close();
      reject(err);
    }
  });

export async function healthCheck(config: McpConfig, deps: HealthCheckDeps = {}): Promise<HealthCheckResult> {
  if (!config.runtimeReadEnabled) {
    return fail("runtime read disabled - set PANGOLINT_MCP_RUNTIME_READ=enabled to enable read runtime tools", true);
  }

  const now = deps.now ?? (() => Date.now());
  const resolve = deps.resolve ?? defaultResolve;
  const socketCheck = deps.socketCheck ?? defaultSocketCheck;

  const start = now();
  let resolved: { address: string; family: 4 | 6 };
  try {
    resolved = await resolve(config.beyondTalkHost);
  } catch (err) {
    return ok({
      reachable: false,
      host: config.beyondTalkHost,
      port: config.beyondTalkPort,
      elapsedMs: now() - start,
      error: `dns lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  try {
    await socketCheck(resolved.address, config.beyondTalkPort, resolved.family);
  } catch (err) {
    return ok({
      reachable: false,
      host: config.beyondTalkHost,
      port: config.beyondTalkPort,
      resolvedAddress: resolved.address,
      family: resolved.family,
      elapsedMs: now() - start,
      error: `udp connect failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return ok({
    reachable: true,
    host: config.beyondTalkHost,
    port: config.beyondTalkPort,
    resolvedAddress: resolved.address,
    family: resolved.family,
    elapsedMs: now() - start,
  });
}
