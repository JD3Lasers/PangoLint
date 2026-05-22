import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PANGO_ANALYSIS_LIMITS } from "../../../../src/language/analysisLimits";
import { lookupPropertyControls } from "../lookupPropertyControls";
import { searchPropertyControls } from "../searchPropertyControls";
import { KNOWLEDGE_TOOL_ANNOTATIONS, MCP_TOOL_IDS } from "../toolDefinitions";
import { asTextResult } from "./toolRegistrationResult";
import type { RegisterToolsContext } from "./toolRegistrationTypes";

export function registerPropertyControlTools(server: McpServer, ctx: RegisterToolsContext): void {
  server.registerTool(
    MCP_TOOL_IDS.lookupPropertyControls,
    {
      description:
        "Exact lookup for how to control a BEYOND Object Tree property. Returns compact PangoScript command links, OSC route links, Object Tree path examples, value range, readback, and behavior information. Set includeDetails true with explicit limits only when more examples are needed.",
      inputSchema: {
        path: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .describe("Property path, e.g. DmxOutput.N, DmxOutput.5, Master.Brightness, or FX.3.0.0.Chase.Manual."),
        includeDetails: z.boolean().optional().describe("Use larger capped example limits. Defaults to false."),
        commandLimit: z.number().int().positive().optional().describe("Maximum PangoScript commands to return."),
        oscRouteLimit: z.number().int().positive().optional().describe("Maximum OSC routes to return."),
        objectContextLimit: z.number().int().positive().optional().describe("Maximum Object Tree contexts to return."),
        objectBusPathLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum direct /b/ Object Tree paths to return."),
        parameterRangeLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum command parameter ranges to return."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({
      path,
      includeDetails,
      commandLimit,
      oscRouteLimit,
      objectContextLimit,
      objectBusPathLimit,
      parameterRangeLimit,
    }) =>
      asTextResult(
        lookupPropertyControls(
          {
            path,
            includeDetails,
            commandLimit,
            oscRouteLimit,
            objectContextLimit,
            objectBusPathLimit,
            parameterRangeLimit,
          },
          ctx.knowledge.propertyControlIndex,
        ),
      ),
  );

  server.registerTool(
    MCP_TOOL_IDS.searchPropertyControls,
    {
      description:
        "Compact search for property control methods by intent, property name, command name, OSC route, or Object Tree path. Use this before lookupPropertyControls when the exact property path is unknown.",
      inputSchema: {
        query: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpQueryChars)
          .describe("Search terms, e.g. dmx output, brightness command, chase manual, or /beyond/dmx."),
        root: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .optional()
          .describe("Optional Object Tree root filter, e.g. Master, DmxOutput, FX."),
        kind: z.enum(["object", "fx"]).optional().describe("Optional property family filter."),
        limit: z.number().int().positive().optional().describe("Maximum hits to return (default 10, max 50)."),
        includeDetails: z.boolean().optional().describe("Use larger capped example limits. Defaults to false."),
        commandLimit: z.number().int().positive().optional().describe("Maximum PangoScript commands per hit."),
        oscRouteLimit: z.number().int().positive().optional().describe("Maximum OSC routes per hit."),
        objectContextLimit: z.number().int().positive().optional().describe("Maximum Object Tree contexts per hit."),
        objectBusPathLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum direct /b/ Object Tree paths per hit."),
        parameterRangeLimit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum command parameter ranges per hit."),
      },
      annotations: KNOWLEDGE_TOOL_ANNOTATIONS,
    },
    async ({
      query,
      root,
      kind,
      limit,
      includeDetails,
      commandLimit,
      oscRouteLimit,
      objectContextLimit,
      objectBusPathLimit,
      parameterRangeLimit,
    }) =>
      asTextResult(
        searchPropertyControls(
          {
            query,
            root,
            kind,
            limit,
            includeDetails,
            commandLimit,
            oscRouteLimit,
            objectContextLimit,
            objectBusPathLimit,
            parameterRangeLimit,
          },
          ctx.knowledge.propertyControlIndex,
        ),
      ),
  );
}
