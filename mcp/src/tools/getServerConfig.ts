// Tool: getServerConfig: returns the server's current configuration so
// the agent knows what's available before attempting runtime tools.
// Only flags relevant to tool gating are exposed; secrets are never
// returned (the env vars themselves don't carry any).

import type { McpConfig } from "../config";
import { ok, type ToolResult } from "../config";

export interface ServerConfigSnapshot {
  version: string;
  /** True when either read or write runtime is enabled. Kept as a coarse summary for older agents. */
  runtimeEnabled: boolean;
  runtimeReadEnabled: boolean;
  runtimeWriteEnabled: boolean;
  beyondTalkHost: string;
  beyondTalkPort: number;
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

const ALWAYS_ON_TOOLS = [
  "lookupCommand",
  "searchCommands",
  "lookupObject",
  "listObjects",
  "searchObjectProperties",
  "lookupObjectProperty",
  "lookupPropertyControls",
  "searchPropertyControls",
  "lintScript",
  "explainDiagnostic",
  "getServerConfig",
];

const RUNTIME_READ_TOOLS = ["healthCheck", "readBeyondProperty"];
const RUNTIME_WRITE_TOOLS = ["runScript"];

export function getServerConfig(version: string, config: McpConfig): GetServerConfigResult {
  const availableTools = [
    ...ALWAYS_ON_TOOLS,
    ...(config.runtimeReadEnabled ? RUNTIME_READ_TOOLS : []),
    ...(config.runtimeWriteEnabled ? RUNTIME_WRITE_TOOLS : []),
  ];
  return ok({
    version,
    runtimeEnabled: config.runtimeReadEnabled || config.runtimeWriteEnabled,
    runtimeReadEnabled: config.runtimeReadEnabled,
    runtimeWriteEnabled: config.runtimeWriteEnabled,
    beyondTalkHost: config.beyondTalkHost,
    beyondTalkPort: config.beyondTalkPort,
    oscListenHost: config.oscListenHost,
    oscListenPort: config.oscListenPort,
    readbackTimeoutMs: config.readbackTimeoutMs,
    availableTools,
    responseGuidance: {
      objectLookups:
        "searchObjectProperties, lookupObjectProperty, lookupObject, lookupPropertyControls, and searchPropertyControls return compact results by default. Use includeDetails, includePaths, and explicit limits only for follow-up detail pages.",
    },
  });
}
