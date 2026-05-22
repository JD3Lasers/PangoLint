import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PANGO_ANALYSIS_LIMITS } from "../../../../src/language/analysisLimits";
import { listObjects } from "../listObjects";
import { lookupObject } from "../lookupObject";
import { lookupObjectProperty } from "../lookupObjectProperty";
import { searchObjectProperties } from "../searchObjectProperties";
import { KNOWLEDGE_TOOL_ANNOTATIONS, MCP_TOOL_IDS } from "../toolDefinitions";
import { asTextResult } from "./toolRegistrationResult";
import type { RegisterToolsContext } from "./toolRegistrationTypes";

export function registerObjectTreeKnowledgeTools(server: McpServer, ctx: RegisterToolsContext): void {
  server.registerTool(
    MCP_TOOL_IDS.lookupObject,
    {
      description:
        "Return compact object knowledge for a BEYOND object root or exact Object Tree path. Root lookups return paged property summaries by default; set includePaths true only when a capped path page is needed. Exact Object Tree paths return a compact matched property card.",
      inputSchema: {
        name: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .describe("Object root or property path to look up. Case-insensitive."),
        propertyOffset: z.number().int().nonnegative().optional().describe("Offset for the returned property page."),
        propertyLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum properties to return in this page (default 25, max 100)."),
        includePaths: z.boolean().optional().describe("Return a capped page of Object Tree paths. Defaults to false."),
        pathOffset: z.number().int().nonnegative().optional().describe("Offset for the returned path page."),
        pathLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum paths to return in this page (default 25, max 100)."),
        includeDetails: z
          .boolean()
          .optional()
          .describe("Include capped variants, probe contexts, and context value metadata for an exact path match."),
        variantLimit: z.number().int().positive().optional().describe("Maximum variants when includeDetails is true."),
        probeContextLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum probe contexts when includeDetails is true."),
        contextValueLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum context value metadata rows when includeDetails is true."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({
      name,
      propertyOffset,
      propertyLimit,
      includePaths,
      pathOffset,
      pathLimit,
      includeDetails,
      variantLimit,
      probeContextLimit,
      contextValueLimit,
    }) =>
      asTextResult(
        lookupObject(
          {
            name,
            propertyOffset,
            propertyLimit,
            includePaths,
            pathOffset,
            pathLimit,
            includeDetails,
            variantLimit,
            probeContextLimit,
            contextValueLimit,
          },
          ctx.knowledge.propertyIndex,
          ctx.knowledge.objectPropertyIndex,
        ),
      ),
  );

  server.registerTool(
    MCP_TOOL_IDS.listObjects,
    {
      description:
        "List every object family known to the MCP server, combining canonical schemas with Object Tree roots such as WS, FX, DmxOutput, and workspace-safe aliases. Use this before lookupObject when discovering available object roots.",
      inputSchema: {},
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async () => asTextResult(listObjects(ctx.knowledge.propertyIndex, ctx.knowledge.objectPropertyIndex)),
  );

  server.registerTool(
    MCP_TOOL_IDS.searchObjectProperties,
    {
      description:
        "Compact ranked search over BEYOND Object Tree property paths (Master.ShowSpeed, DmxOutput.N, WS.N.N.Caption, FX.N.N.N.Oscillator.Period, ...). Defaults omit full variants and probe contexts. Set includeDetails true with explicit limits only when deep detail is needed.",
      inputSchema: {
        query: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpQueryChars)
          .describe("Search terms, e.g. 'show speed', 'oscillator period', or 'dmx output'."),
        root: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .optional()
          .describe("Optional root filter, e.g. Master, Zone, FX, DmxOutput."),
        kind: z.enum(["object", "fx"]).optional().describe("Optional property family filter."),
        limit: z.number().int().positive().optional().describe("Maximum hits to return (default 10, max 50)."),
        includeDetails: z
          .boolean()
          .optional()
          .describe("Include capped variants, probe contexts, and context value metadata. Defaults to false."),
        variantLimit: z.number().int().positive().optional().describe("Maximum variants when includeDetails is true."),
        probeContextLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum probe contexts when includeDetails is true."),
        contextValueLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum context value metadata rows when includeDetails is true."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({ query, root, kind, limit, includeDetails, variantLimit, probeContextLimit, contextValueLimit }) =>
      asTextResult(
        searchObjectProperties(
          { query, root, kind, limit, includeDetails, variantLimit, probeContextLimit, contextValueLimit },
          ctx.knowledge.objectPropertyIndex,
        ),
      ),
  );

  server.registerTool(
    MCP_TOOL_IDS.lookupObjectProperty,
    {
      description:
        "Exact lookup for a BEYOND Object Tree property path. Returns a compact property card by default. Concrete indexed paths resolve to the normalized entry and return the matched concrete variant when known. Set includeDetails true with explicit limits only when variants or probe contexts are needed.",
      inputSchema: {
        path: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .describe("Property path or normalized path, e.g. Master.ShowSpeed or FX.0.0.0.Oscillator.Period."),
        includeDetails: z
          .boolean()
          .optional()
          .describe("Include capped variants, probe contexts, and context value metadata. Defaults to false."),
        variantLimit: z.number().int().positive().optional().describe("Maximum variants when includeDetails is true."),
        probeContextLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum probe contexts when includeDetails is true."),
        contextValueLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum context value metadata rows when includeDetails is true."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({ path, includeDetails, variantLimit, probeContextLimit, contextValueLimit }) =>
      asTextResult(
        lookupObjectProperty(
          { path, includeDetails, variantLimit, probeContextLimit, contextValueLimit },
          ctx.knowledge.objectPropertyIndex,
        ),
      ),
  );
}
