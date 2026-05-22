// Registers every PangoLint MCP tool onto an McpServer instance.
// Product-area registration modules own the SDK adapter layer for each tool family.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCommandKnowledgeTools } from "./registration/commandKnowledgeTools";
import { registerObjectTreeKnowledgeTools } from "./registration/objectTreeKnowledgeTools";
import { registerPropertyControlTools } from "./registration/propertyControlTools";
import { registerRuntimeReadTools } from "./registration/runtimeReadTools";
import { registerRuntimeWriteTools } from "./registration/runtimeWriteTools";
import { registerScriptAnalysisTools } from "./registration/scriptAnalysisTools";
import type { RegisterToolsContext } from "./registration/toolRegistrationTypes";
import {
  KNOWLEDGE_TOOL_ANNOTATIONS,
  RUNTIME_READ_TOOL_ANNOTATIONS,
  RUNTIME_WRITE_TOOL_ANNOTATIONS,
} from "./toolDefinitions";

export { KNOWLEDGE_TOOL_ANNOTATIONS, RUNTIME_READ_TOOL_ANNOTATIONS, RUNTIME_WRITE_TOOL_ANNOTATIONS };

export function registerKnowledgeTools(server: McpServer, ctx: RegisterToolsContext): void {
  registerCommandKnowledgeTools(server, ctx);
  registerObjectTreeKnowledgeTools(server, ctx);
  registerPropertyControlTools(server, ctx);
  registerScriptAnalysisTools(server, ctx);
  registerRuntimeReadTools(server, ctx);
  registerRuntimeWriteTools(server, ctx);
}
