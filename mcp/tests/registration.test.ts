// Locks the registration-shape contract in place: every tool gets
// annotations (read-only / destructive / openWorld hints), every
// resource advertises a `size`, and the server instructions reach the
// underlying SDK Server. Without these tests, a contributor could drop
// an `annotations:` block or the `size:` field and `npm run check`
// would still pass.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { buildMcpPropertyControlIndex } from "../../src/knowledge/mcpControlReference";
import { buildObjectPropertyIndex } from "../../src/knowledge/objectPropertyIndex";
import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import type { McpConfig } from "../src/config";
import type { McpKnowledgeBase } from "../src/knowledgeBase";
import { buildCatalogPayload, buildSchemasPayload, registerResources } from "../src/resources/index";
import { SERVER_DISPLAY_NAME, SERVER_INFO, SERVER_INSTRUCTIONS, SERVER_NAME } from "../src/server";
import { getServerConfig } from "../src/tools/getServerConfig";
import {
  KNOWLEDGE_TOOL_ANNOTATIONS,
  RUNTIME_READ_TOOL_ANNOTATIONS,
  RUNTIME_WRITE_TOOL_ANNOTATIONS,
  registerKnowledgeTools,
} from "../src/tools/index";
import { availableToolIdsForConfig, MCP_TOOL_DEFINITIONS } from "../src/tools/toolDefinitions";

interface CapturedTool {
  name: string;
  config: {
    description?: string;
    inputSchema?: unknown;
    annotations?: {
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
  };
}

interface CapturedResource {
  name: string;
  uri: string;
  config: {
    mimeType?: string;
    description?: string;
    size?: number;
  };
}

function createCapturingServer(): {
  server: McpServer;
  tools: CapturedTool[];
  resources: CapturedResource[];
} {
  const tools: CapturedTool[] = [];
  const resources: CapturedResource[] = [];
  const stub = {
    registerTool(name: string, config: CapturedTool["config"], _cb: unknown) {
      tools.push({ name, config });
      return {} as unknown;
    },
    registerResource(name: string, uri: string, config: CapturedResource["config"], _cb: unknown) {
      resources.push({ name, uri, config });
      return {} as unknown;
    },
  };
  return { server: stub as unknown as McpServer, tools, resources };
}

const fixtureKnowledge: McpKnowledgeBase = {
  knowledgeBase: {
    schemaVersion: 1,
    commands: {
      brightness: {
        canonical: "Brightness",
        aliases: ["Brightness"],
        evidenceLevel: "exported",
        confidence: "high",
        safetyTier: "T1",
        category: "General",
        forms: [{ signature: "Brightness <value>" }],
        description: "Set master brightness 0..100.",
      },
    },
  },
  catalog: { commands: [], byName: new Map() },
  byName: new Map(),
  propertyIndex: buildPropertyIndex({
    schemaVersion: 1,
    generatedAt: "",
    generatedFrom: "test",
    schemas: [{ object: "Master", isArray: false, propertyCount: 1, properties: ["Brightness"], sharedWithAliases: 0 }],
  } satisfies PropertyIndexFile),
  objectPropertyIndex: buildObjectPropertyIndex({
    schemaVersion: 1,
    generatedAt: "",
    generatedFrom: "test",
    entries: [],
  }),
  propertyControlIndex: buildMcpPropertyControlIndex({
    schemaVersion: 1,
    entries: [],
  }),
};

const fixtureConfig: McpConfig = {
  runtimeReadEnabled: false,
  runtimeWriteEnabled: false,
  beyondTalkTransport: "auto",
  beyondTalkHost: "127.0.0.1",
  beyondTalkPort: 16062,
  beyondTalkTcpHost: "127.0.0.1",
  beyondTalkTcpPort: 16063,
  beyondTalkTcpEchoMode: 2,
  beyondTalkUdpHost: "127.0.0.1",
  beyondTalkUdpPort: 16062,
  beyondTalkUdpFallbackAllowed: false,
  beyondTalkTcpPassword: "",
  oscListenHost: "0.0.0.0",
  oscListenPort: 7000,
  readbackTimeoutMs: 3000,
};

describe("registerKnowledgeTools annotations contract", () => {
  const { server, tools } = createCapturingServer();
  registerKnowledgeTools(server, { version: "test", config: fixtureConfig, knowledge: fixtureKnowledge });

  const KNOWLEDGE_TOOL_NAMES = [
    "lookupCommand",
    "searchCommands",
    "lookupObject",
    "listObjects",
    "searchObjectProperties",
    "lookupObjectProperty",
    "lookupPropertyControls",
    "searchPropertyControls",
    "lintScript",
    "explainDiagnostic",
    "getServerConfig",
  ] as const;

  it("registers every declared MCP tool", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(MCP_TOOL_DEFINITIONS.map((tool) => tool.id).sort());
  });

  it("advertises available tools from the same definitions used by registration", () => {
    const disabledConfig = getServerConfig("test", fixtureConfig);
    if (!disabledConfig.ok) throw new Error(disabledConfig.error);
    expect(disabledConfig.data.availableTools.sort()).toEqual(availableToolIdsForConfig(fixtureConfig).sort());

    const writeConfig: McpConfig = { ...fixtureConfig, runtimeReadEnabled: true, runtimeWriteEnabled: true };
    const enabledConfig = getServerConfig("test", writeConfig);
    if (!enabledConfig.ok) throw new Error(enabledConfig.error);
    expect(enabledConfig.data.availableTools.sort()).toEqual(availableToolIdsForConfig(writeConfig).sort());
  });

  it.each(KNOWLEDGE_TOOL_NAMES)("knowledge tool %s carries KNOWLEDGE_TOOL_ANNOTATIONS", (name) => {
    const tool = tools.find((t) => t.name === name);
    expect(tool, `tool ${name} should be registered`).toBeDefined();
    expect(tool?.config.annotations).toEqual(KNOWLEDGE_TOOL_ANNOTATIONS);
  });

  it("runtime read tools carry RUNTIME_READ_TOOL_ANNOTATIONS", () => {
    for (const name of [
      "healthCheck",
      "checkTalkConnection",
      "readBeyondProperty",
      "readReceivedOscMessages",
    ] as const) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.config.annotations).toEqual(RUNTIME_READ_TOOL_ANNOTATIONS);
    }
  });

  it("runScript carries RUNTIME_WRITE_TOOL_ANNOTATIONS (destructive, openWorld)", () => {
    const tool = tools.find((t) => t.name === "runScript");
    expect(tool?.config.annotations).toEqual(RUNTIME_WRITE_TOOL_ANNOTATIONS);
    expect(tool?.config.annotations?.destructiveHint).toBe(true);
    expect(tool?.config.annotations?.readOnlyHint).toBe(false);
  });
});

describe("registerResources size hint contract", () => {
  const { server, resources } = createCapturingServer();
  registerResources(server, { knowledge: fixtureKnowledge });

  it("registers all reference resources agents need for script generation", () => {
    expect(resources.map((r) => r.uri).sort()).toEqual(
      [
        "pangoscript://catalog/commands",
        "pangoscript://catalog/property-coverage",
        "pangoscript://schemas/objects",
        "pangoscript://diagnostics/codes",
        "pangoscript://reference/command-reference",
        "pangoscript://reference/master-object-tree",
        "pangoscript://reference/object-model",
        "pangoscript://reference/operators",
        "pangoscript://reference/syntax",
      ].sort(),
    );
  });

  it("catalog resource size matches Buffer.byteLength of the JSON payload", () => {
    const expected = Buffer.byteLength(buildCatalogPayload(fixtureKnowledge), "utf8");
    const resource = resources.find((r) => r.uri === "pangoscript://catalog/commands");
    expect(resource?.config.size).toBe(expected);
    expect(resource?.config.mimeType).toBe("application/json");
  });

  it("property coverage resource advertises bundled JSON when available", () => {
    const resource = resources.find((r) => r.uri === "pangoscript://catalog/property-coverage");
    expect(resource?.config.mimeType).toBe("application/json");
    expect(resource?.config.size).toBeTypeOf("number");
    expect(resource?.config.size).toBeGreaterThan(0);
  });

  it("schemas resource size matches Buffer.byteLength of the JSON payload", () => {
    const expected = Buffer.byteLength(buildSchemasPayload(fixtureKnowledge), "utf8");
    const resource = resources.find((r) => r.uri === "pangoscript://schemas/objects");
    expect(resource?.config.size).toBe(expected);
    expect(resource?.config.mimeType).toBe("application/json");
  });

  it.each([
    "pangoscript://diagnostics/codes",
    "pangoscript://reference/command-reference",
    "pangoscript://reference/master-object-tree",
    "pangoscript://reference/object-model",
    "pangoscript://reference/operators",
    "pangoscript://reference/syntax",
  ])("markdown resource %s advertises a positive size", (uri) => {
    const resource = resources.find((r) => r.uri === uri);
    expect(resource?.config.mimeType).toBe("text/markdown");
    expect(resource?.config.size).toBeTypeOf("number");
    expect(resource?.config.size).toBeGreaterThan(0);
  });
});

describe("SERVER_INSTRUCTIONS wired through to the McpServer constructor", () => {
  it("reaches the underlying SDK Server's _instructions field", () => {
    const mcp = new McpServer(SERVER_INFO, {
      capabilities: { tools: {}, resources: {} },
      instructions: SERVER_INSTRUCTIONS,
    });
    // The SDK does not expose a public getter for instructions; the only
    // way to confirm wiring is to inspect the inner Server's private
    // field. Narrow cast keeps this honest.
    const inner = (mcp.server as unknown as { _instructions?: string })._instructions;
    expect(inner).toBe(SERVER_INSTRUCTIONS);
  });

  it("instructions content covers the recommended-flow checklist", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/getServerConfig/);
    expect(SERVER_INSTRUCTIONS).toMatch(/lintScript/);
    expect(SERVER_INSTRUCTIONS).toMatch(/runScript/);
    expect(SERVER_INSTRUCTIONS).toMatch(/PANGOLINT_MCP_RUNTIME_READ/);
    expect(SERVER_INSTRUCTIONS).toMatch(/PANGOLINT_MCP_RUNTIME_WRITE/);
  });
});

describe("MCP public display branding", () => {
  it("keeps the machine id lowercase while exposing PangoLint as the display name", () => {
    expect(SERVER_NAME).toBe("pangolint-mcp");
    expect(SERVER_DISPLAY_NAME).toBe("PangoLint MCP");
    expect(SERVER_INFO.name).toBe(SERVER_NAME);
    expect(SERVER_INFO.title).toBe(SERVER_DISPLAY_NAME);
    expect(SERVER_INSTRUCTIONS.startsWith("PangoLint MCP exposes")).toBe(true);
  });

  it("passes the display name through SDK server metadata", () => {
    const mcp = new McpServer(SERVER_INFO, {
      capabilities: { tools: {}, resources: {} },
      instructions: SERVER_INSTRUCTIONS,
    });

    const inner = (mcp.server as unknown as { _serverInfo?: { title?: string; name?: string } })._serverInfo;
    expect(inner?.name).toBe("pangolint-mcp");
    expect(inner?.title).toBe("PangoLint MCP");
  });
});
