// Tool: getServerConfig: returns the server's current configuration so
// the agent knows what's available before attempting runtime tools.
// Only flags relevant to tool gating are exposed; secrets are never
// returned (the env vars themselves don't carry any).

import type { McpConfig } from "../config";
import { ok, type ToolResult } from "../toolResult";
import { availableToolIdsForConfig } from "./toolDefinitions";

export interface ServerConfigSnapshot {
  version: string;
  /** True when either read or write runtime is enabled. Kept as a coarse summary for older agents. */
  runtimeEnabled: boolean;
  runtimeReadEnabled: boolean;
  runtimeWriteEnabled: boolean;
  beyondTalkTransport: "auto" | "tcp" | "udp";
  beyondTalkHost: string;
  beyondTalkPort: number;
  beyondTalkTcpHost: string;
  beyondTalkTcpPort: number;
  beyondTalkUdpHost: string;
  beyondTalkUdpPort: number;
  beyondTalkUdpFallbackAllowed: boolean;
  oscListenHost: string;
  oscListenPort: number;
  readbackTimeoutMs: number;
  /** Tools available to the agent under the current configuration. */
  availableTools: string[];
  responseGuidance: {
    objectLookups: string;
  };
}

export type GetServerConfigResult = ToolResult<ServerConfigSnapshot>;

export function getServerConfig(version: string, config: McpConfig): GetServerConfigResult {
  return ok({
    version,
    runtimeEnabled: config.runtimeReadEnabled || config.runtimeWriteEnabled,
    runtimeReadEnabled: config.runtimeReadEnabled,
    runtimeWriteEnabled: config.runtimeWriteEnabled,
    beyondTalkTransport: config.beyondTalkTransport,
    beyondTalkHost: config.beyondTalkHost,
    beyondTalkPort: config.beyondTalkPort,
    beyondTalkTcpHost: config.beyondTalkTcpHost,
    beyondTalkTcpPort: config.beyondTalkTcpPort,
    beyondTalkUdpHost: config.beyondTalkUdpHost,
    beyondTalkUdpPort: config.beyondTalkUdpPort,
    beyondTalkUdpFallbackAllowed: config.beyondTalkUdpFallbackAllowed,
    oscListenHost: config.oscListenHost,
    oscListenPort: config.oscListenPort,
    readbackTimeoutMs: config.readbackTimeoutMs,
    availableTools: availableToolIdsForConfig(config),
    responseGuidance: {
      objectLookups:
        "searchObjectProperties, lookupObjectProperty, lookupObject, lookupPropertyControls, and searchPropertyControls return compact results by default. Use includeDetails, includePaths, and explicit limits only for follow-up detail pages.",
    },
  });
}
