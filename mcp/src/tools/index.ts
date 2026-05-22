// Registers every PangoLint MCP tool onto an McpServer instance.
// Each tool's pure logic lives in its own file; this module only deals
// with the SDK adapter layer (zod input schemas, result wrapping).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PANGO_ANALYSIS_LIMITS } from "../../../src/language/analysisLimits";
import { buildCommandReferenceSearchIndex } from "../commandReference";
import type { McpConfig } from "../config";
import type { McpKnowledgeBase } from "../knowledgeBase";
import { checkTalkConnection } from "./checkTalkConnection";
import { explainDiagnostic } from "./explainDiagnostic";
import { getServerConfig } from "./getServerConfig";
import { healthCheck } from "./healthCheck";
import { lintScript } from "./lintScript";
import { listObjects } from "./listObjects";
import { lookupCommand } from "./lookupCommand";
import { lookupObject } from "./lookupObject";
import { lookupObjectProperty } from "./lookupObjectProperty";
import { lookupPropertyControls } from "./lookupPropertyControls";
import { readBeyondProperty } from "./readBeyondProperty";
import { runScript } from "./runScript";
import { searchCommands } from "./searchCommands";
import { searchObjectProperties } from "./searchObjectProperties";
import { searchPropertyControls } from "./searchPropertyControls";
import {
  KNOWLEDGE_TOOL_ANNOTATIONS,
  MCP_TOOL_IDS,
  RUNTIME_READ_TOOL_ANNOTATIONS,
  RUNTIME_WRITE_TOOL_ANNOTATIONS,
} from "./toolDefinitions";

export { KNOWLEDGE_TOOL_ANNOTATIONS, RUNTIME_READ_TOOL_ANNOTATIONS, RUNTIME_WRITE_TOOL_ANNOTATIONS };

const SAFETY_TIER_VALUES = ["T0", "T1", "T2", "T3", "T4", "unknown"] as const;

interface RegisterContext {
  version: string;
  config: McpConfig;
  knowledge: McpKnowledgeBase;
}

function asTextResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

export function registerKnowledgeTools(server: McpServer, ctx: RegisterContext): void {
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

  // Runtime tools are always registered, but the tool functions return
  // { ok: false, blocked: true } when their read/write runtime opt-in is not enabled.
  // This way the agent can list them via tools/list, call them, and get a
  // structured "you need to enable runtime" response instead of a confusing
  // "tool not found" error.

  server.registerTool(
    MCP_TOOL_IDS.healthCheck,
    {
      description:
        "Check that the configured BEYOND UDP target host is resolvable and a UDP socket can address it. READ RUNTIME ONLY: returns blocked when PANGOLINT_MCP_RUNTIME_READ is not enabled. Does NOT verify BEYOND accepts commands; for Talk TCP command status, use checkTalkConnection.",
      inputSchema: {},
      annotations: RUNTIME_READ_TOOL_ANNOTATIONS,
    },
    async () => asTextResult(await healthCheck(ctx.config)),
  );

  server.registerTool(
    MCP_TOOL_IDS.checkTalkConnection,
    {
      description:
        "Open the configured BEYOND Talk TCP target and verify greeting, Echo 1, Hello, and Version replies. READ RUNTIME ONLY: returns blocked when PANGOLINT_MCP_RUNTIME_READ is not enabled.",
      inputSchema: {},
      annotations: RUNTIME_READ_TOOL_ANNOTATIONS,
    },
    async () => asTextResult(await checkTalkConnection(ctx.config)),
  );

  server.registerTool(
    MCP_TOOL_IDS.readBeyondProperty,
    {
      description:
        "Send one T1 readback of a PangoScript property path (e.g. 'Master.Brightness', 'Zone.0.Red', 'WS.1.2.Caption' for page 1 cue 2) to the configured BEYOND host and return the value. READ RUNTIME ONLY. Use this to confirm an object exists or to read its current state before generating an assignment.",
      inputSchema: {
        path: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .describe("Property path to read (e.g. 'Master.Brightness', 'Zone.0.Red')."),
        typeTag: z.enum(["f", "i", "s"]).optional().describe("OSC type tag for the response. Defaults to 'f' (float)."),
      },
      annotations: RUNTIME_READ_TOOL_ANNOTATIONS,
    },
    async ({ path, typeTag }) => asTextResult(await readBeyondProperty({ path, typeTag }, ctx.config)),
  );

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
