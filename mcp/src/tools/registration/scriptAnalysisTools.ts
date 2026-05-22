import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PANGO_ANALYSIS_LIMITS } from "../../../../src/language/mcpLanguageExports";
import { explainDiagnostic } from "../explainDiagnostic";
import { getServerConfig } from "../getServerConfig";
import { lintScript } from "../lintScript";
import { KNOWLEDGE_TOOL_ANNOTATIONS, MCP_TOOL_IDS } from "../toolDefinitions";
import { asTextResult } from "./toolRegistrationResult";
import type { RegisterToolsContext } from "./toolRegistrationTypes";

export function registerScriptAnalysisTools(server: McpServer, ctx: RegisterToolsContext): void {
  server.registerTool(
    MCP_TOOL_IDS.lintScript,
    {
      description:
        "Run PangoLint over the supplied script text and return the structured diagnostic list. Codes match the published diagnostic doc (use explainDiagnostic to look one up). The MCP linter has no workspace, so user-defined universes don't resolve; canonical bundled schemas plus the Object Tree index inform property-path hints.",
      inputSchema: {
        text: z.string().max(PANGO_ANALYSIS_LIMITS.maxMcpTextChars).describe("PangoScript source text to lint."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({ text }) =>
      asTextResult(
        lintScript(
          { text },
          ctx.knowledge.catalog,
          ctx.knowledge.byName,
          ctx.knowledge.propertyIndex,
          ctx.knowledge.objectPropertyIndex,
        ),
      ),
  );

  server.registerTool(
    MCP_TOOL_IDS.explainDiagnostic,
    {
      description:
        "Return the markdown documentation for a PangoLint diagnostic code. Useful when lintScript reports a code you want explained to the user.",
      inputSchema: {
        code: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .describe("Diagnostic code (e.g. 'unused-variable')."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({ code }) => asTextResult(explainDiagnostic({ code })),
  );

  server.registerTool(
    MCP_TOOL_IDS.getServerConfig,
    {
      description:
        "Return the server's current configuration: read/write runtime tools enabled? talk host/port? Use this BEFORE calling runtime tools so you can tell the user what's actually available.",
      inputSchema: {},
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async () => asTextResult(getServerConfig(ctx.version, ctx.config)),
  );
}
