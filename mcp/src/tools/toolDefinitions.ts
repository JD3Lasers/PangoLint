import type { McpConfig } from "../config";

export const KNOWLEDGE_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const RUNTIME_READ_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const RUNTIME_WRITE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const MCP_TOOL_IDS = {
  lookupCommand: "lookupCommand",
  searchCommands: "searchCommands",
  lookupObject: "lookupObject",
  listObjects: "listObjects",
  searchObjectProperties: "searchObjectProperties",
  lookupObjectProperty: "lookupObjectProperty",
  lookupPropertyControls: "lookupPropertyControls",
  searchPropertyControls: "searchPropertyControls",
  lintScript: "lintScript",
  explainDiagnostic: "explainDiagnostic",
  getServerConfig: "getServerConfig",
  healthCheck: "healthCheck",
  checkTalkConnection: "checkTalkConnection",
  readBeyondProperty: "readBeyondProperty",
  runScript: "runScript",
} as const;

type ToolAvailability = "always" | "runtimeRead" | "runtimeWrite";

export interface McpToolDefinition {
  id: (typeof MCP_TOOL_IDS)[keyof typeof MCP_TOOL_IDS];
  availability: ToolAvailability;
  annotations:
    | typeof KNOWLEDGE_TOOL_ANNOTATIONS
    | typeof RUNTIME_READ_TOOL_ANNOTATIONS
    | typeof RUNTIME_WRITE_TOOL_ANNOTATIONS;
}

export const MCP_TOOL_DEFINITIONS: readonly McpToolDefinition[] = [
  { id: MCP_TOOL_IDS.lookupCommand, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.searchCommands, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.lookupObject, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.listObjects, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.searchObjectProperties, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.lookupObjectProperty, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.lookupPropertyControls, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.searchPropertyControls, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.lintScript, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.explainDiagnostic, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.getServerConfig, availability: "always", annotations: KNOWLEDGE_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.healthCheck, availability: "runtimeRead", annotations: RUNTIME_READ_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.checkTalkConnection, availability: "runtimeRead", annotations: RUNTIME_READ_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.readBeyondProperty, availability: "runtimeRead", annotations: RUNTIME_READ_TOOL_ANNOTATIONS },
  { id: MCP_TOOL_IDS.runScript, availability: "runtimeWrite", annotations: RUNTIME_WRITE_TOOL_ANNOTATIONS },
] as const;

export function availableToolIdsForConfig(config: McpConfig): string[] {
  return MCP_TOOL_DEFINITIONS.filter((tool) => {
    if (tool.availability === "always") return true;
    if (tool.availability === "runtimeRead") return config.runtimeReadEnabled;
    return config.runtimeWriteEnabled;
  }).map((tool) => tool.id);
}
