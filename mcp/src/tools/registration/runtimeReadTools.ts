import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PANGO_ANALYSIS_LIMITS } from "../../../../src/language/mcpLanguageExports";
import { checkTalkConnection } from "../checkTalkConnection";
import { healthCheck } from "../healthCheck";
import { readBeyondProperty } from "../readBeyondProperty";
import { readReceivedOscMessages } from "../readReceivedOscMessages";
import { MCP_TOOL_IDS, RUNTIME_READ_TOOL_ANNOTATIONS } from "../toolDefinitions";
import { asTextResult } from "./toolRegistrationResult";
import type { RegisterToolsContext } from "./toolRegistrationTypes";

export function registerRuntimeReadTools(server: McpServer, ctx: RegisterToolsContext): void {
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
        "Open the configured BEYOND Talk TCP target and verify greeting, configured Echo mode, Hello, and Version replies. READ RUNTIME ONLY: returns blocked when PANGOLINT_MCP_RUNTIME_READ is not enabled.",
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
    MCP_TOOL_IDS.readReceivedOscMessages,
    {
      description:
        "Listen on the configured BEYOND OSC callback port for a bounded receive window and return decoded OSC messages. READ RUNTIME ONLY. Use after RegisterOscFeedback or an operator action to inspect received OSC feedback without sending Talk commands.",
      inputSchema: {
        addresses: z
          .array(z.string().max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars))
          .max(64)
          .optional()
          .describe("Exact OSC address paths to receive, e.g. ['/pangolint/feedback/zone']."),
        addressPrefix: z
          .string()
          .max(PANGO_ANALYSIS_LIMITS.maxMcpNameChars)
          .optional()
          .describe("OSC address prefix to receive, e.g. '/pangolint/' or '/b/Zone/'."),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Receive window in milliseconds. Cannot exceed PANGOLINT_MCP_READBACK_TIMEOUT_MS."),
        maxMessages: z
          .number()
          .int()
          .positive()
          .max(256)
          .optional()
          .describe("Maximum matching OSC packets to return."),
      },
      annotations: RUNTIME_READ_TOOL_ANNOTATIONS,
    },
    async ({ addresses, addressPrefix, timeoutMs, maxMessages }) =>
      asTextResult(await readReceivedOscMessages({ addresses, addressPrefix, timeoutMs, maxMessages }, ctx.config)),
  );
}
