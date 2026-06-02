// PangoLint MCP server entry: connects an McpServer over stdio with
// PangoLint knowledge tools, resources, and startup-gated runtime tools.
//
// Logging goes to stderr only: stdout is reserved for MCP protocol
// frames (JSON-RPC) and any stray write would corrupt the session.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { loadMcpKnowledge } from "./knowledgeBase";
import { SERVER_VERSION } from "./packageInfo";
import { registerResources } from "./resources/index";
import { registerKnowledgeTools } from "./tools/index";

export const SERVER_NAME = "pangolint-mcp";
export const SERVER_DISPLAY_NAME = "PangoLint MCP";
export const SERVER_INFO = {
  name: SERVER_NAME,
  title: SERVER_DISPLAY_NAME,
  version: SERVER_VERSION,
  description: "PangoLint MCP server for curated PangoScript knowledge and optional BEYOND runtime tools.",
  websiteUrl: "https://github.com/JD3Lasers/PangoLint",
} as const;

export const SERVER_INSTRUCTIONS = `${SERVER_DISPLAY_NAME} exposes curated PangoScript knowledge plus optional BEYOND runtime tools.

Recommended flow:
1. Call \`getServerConfig\` first to learn which tools are available and whether runtime tools are enabled.
2. While generating PangoScript, use \`lookupCommand\` / \`searchCommands\` for commands and \`listObjects\` / \`lookupObject\` for object roots or exact Object Tree paths. \`lookupObject\` resolves bundled schemas plus Object Tree-only paths such as \`WS.N.N.Caption\`, where the WS indices are page and cue positions. Use \`searchObjectProperties\` when you know a property intent but not the exact path. Use \`lookupPropertyControls\` / \`searchPropertyControls\` when you need compact PangoScript, OSC, Object Tree, range, readback, and behavior control information for a property. These are offline and cost nothing.
3. Run \`lintScript\` over generated text to catch errors before they reach BEYOND. Use \`explainDiagnostic\` to surface fix guidance.
4. Read runtime tools (\`healthCheck\`, \`checkTalkConnection\`, \`readBeyondProperty\`, \`readReceivedOscMessages\`) require PANGOLINT_MCP_RUNTIME_READ=enabled. The legacy PANGOLINT_MCP_RUNTIME=enabled flag enables read tools only.
5. Write runtime (\`runScript\`) requires the separate PANGOLINT_MCP_RUNTIME_WRITE=enabled opt-in. When runtime is blocked, tools return { ok: false, blocked: true }: show the user how to enable the specific runtime tier, do not retry.
6. \`runScript\` lints before sending and refuses on error-severity diagnostics. It reports Talk TCP replies when configured, and marks UDP fallback as send-only. Hint/warning diagnostics surface in the response but do not block. Relay them to the user.

The MCP linter has no workspace, so user-defined universes and zone aliases do NOT resolve. Bundled schemas plus the bundled Object Tree index inform property hints.`;

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const knowledge = loadMcpKnowledge();

  const server = new McpServer(SERVER_INFO, {
    capabilities: { tools: {}, resources: {} },
    instructions: SERVER_INSTRUCTIONS,
  });

  registerKnowledgeTools(server, { version: SERVER_VERSION, config, knowledge });
  registerResources(server, { knowledge });

  process.stderr.write(
    `${SERVER_DISPLAY_NAME} ${SERVER_VERSION}: knowledge=${knowledge.knowledgeBase.commands ? Object.keys(knowledge.knowledgeBase.commands).length : 0} commands, ${knowledge.propertyIndex.size()} object schemas, runtimeRead=${config.runtimeReadEnabled ? "enabled" : "disabled"}, runtimeWrite=${config.runtimeWriteEnabled ? "enabled" : "disabled"}\n`,
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    process.stderr.write(
      `${SERVER_DISPLAY_NAME} fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  });
}
