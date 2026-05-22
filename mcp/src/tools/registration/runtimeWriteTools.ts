import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PANGO_ANALYSIS_LIMITS } from "../../../../src/language/mcpLanguageExports";
import { runScript } from "../runScript";
import { MCP_TOOL_IDS, RUNTIME_WRITE_TOOL_ANNOTATIONS } from "../toolDefinitions";
import { asTextResult } from "./toolRegistrationResult";
import type { RegisterToolsContext } from "./toolRegistrationTypes";

export function registerRuntimeWriteTools(server: McpServer, ctx: RegisterToolsContext): void {
  server.registerTool(
    MCP_TOOL_IDS.runScript,
    {
      description:
        "Lint the supplied PangoScript text; if any error-severity diagnostic fires, refuse to send and return the diagnostics. Otherwise transmit via configured BEYOND Talk transport. WRITE RUNTIME ONLY: returns blocked unless PANGOLINT_MCP_RUNTIME_WRITE is enabled. Hint and warning diagnostics are reported but do not block. Surface them to the user.",
      inputSchema: {
        text: z.string().max(PANGO_ANALYSIS_LIMITS.maxMcpTextChars).describe("PangoScript source text to send."),
      },
      annotations: RUNTIME_WRITE_TOOL_ANNOTATIONS,
    },
    async ({ text }) =>
      asTextResult(
        await runScript({ text }, ctx.config, {
          catalog: ctx.knowledge.catalog,
          knowledgeByName: ctx.knowledge.byName,
          propertyIndex: ctx.knowledge.propertyIndex,
          objectPropertyIndex: ctx.knowledge.objectPropertyIndex,
        }),
      ),
  );
}
