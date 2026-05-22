import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PANGO_ANALYSIS_LIMITS } from "../../../../src/language/mcpLanguageExports";
import { buildCommandReferenceSearchIndex } from "../../commandReference";
import { lookupCommand } from "../lookupCommand";
import { searchCommands } from "../searchCommands";
import { KNOWLEDGE_TOOL_ANNOTATIONS, MCP_TOOL_IDS } from "../toolDefinitions";
import { asTextResult } from "./toolRegistrationResult";
import type { RegisterToolsContext } from "./toolRegistrationTypes";

const SAFETY_TIER_VALUES = ["T0", "T1", "T2", "T3", "T4", "unknown"] as const;

export function registerCommandKnowledgeTools(server: McpServer, ctx: RegisterToolsContext): void {
  const commandReferenceIndex = buildCommandReferenceSearchIndex();

  server.registerTool(
    MCP_TOOL_IDS.lookupCommand,
    {
      description:
        "Return the curated knowledge entry for a single PangoScript command name (canonical or alias). Use this to verify spelling, check arity, and read documented forms / safety tier before generating code.",
      inputSchema: {
        name: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .describe("Command name to look up. Case-insensitive."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({ name }) => asTextResult(lookupCommand({ name }, ctx.knowledge.byName)),
  );

  server.registerTool(
    MCP_TOOL_IDS.searchCommands,
    {
      description:
        "Task-intent search over PangoScript command names, aliases, descriptions, categories, forms, parameters, notes, tags, and command-reference prose, with typo tolerance. Use this when you know a goal like 'popup message' or 'send osc string' but not the exact command. Optional safetyTier filter narrows to commands with that tier.",
      inputSchema: {
        query: z.string().max(PANGO_ANALYSIS_LIMITS.maxMcpQueryChars).describe("Search term."),
        safetyTier: z.enum(SAFETY_TIER_VALUES).optional().describe("Optional safetyTier filter (T0..T4 or 'unknown')."),
        limit: z.number().int().positive().optional().describe("Maximum hits to return (default 10, max 50)."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({ query, safetyTier, limit }) =>
      asTextResult(searchCommands({ query, safetyTier, limit }, ctx.knowledge.byName, commandReferenceIndex)),
  );
}
