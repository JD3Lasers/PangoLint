import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { describe, expect, it } from "vitest";
import { buildMcpPropertyControlIndex } from "../../src/knowledge/mcpControlReference";
import { buildObjectPropertyIndex } from "../../src/knowledge/objectPropertyIndex";
import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import type { McpKnowledgeBase } from "../src/knowledgeBase";
import { registerResources } from "../src/resources/index";
import { MCP_TOOL_DEFINITIONS } from "../src/tools/toolDefinitions";

type McpExposureStatus = "mcp-exposed" | "vs-code-only" | "private";

interface ParitySource {
  id: string;
  path?: string;
  pathPattern?: string;
  extensionSurface: string[];
  mcpExposure: {
    status: McpExposureStatus;
    resourceUri?: string;
    tools?: string[];
    packagePath?: string;
    rationale: string;
  };
}

interface ParityManifest {
  schemaVersion: 1;
  sources: ParitySource[];
}

const repoRoot = path.resolve(__dirname, "..", "..");
const manifestPath = path.join(repoRoot, "docs", "references", "mcp-knowledge-parity.json");
const packageSurfacePolicy = require("../../scripts/packageSurfacePolicy.cjs") as {
  mcpAssetDirectories: string[];
  mcpAssetFiles: string[];
};

const expectedExtensionVisibleIds = [
  "command-catalog",
  "command-property-coverage",
  "command-category-tree",
  "canonical-object-schemas",
  "object-tree-property-index",
  "diagnostics-reference",
  "operators-reference",
  "syntax-reference",
  "command-reference-docs",
  "master-object-tree-reference",
  "object-model-reference",
  "language-configuration",
  "textmate-grammar",
  "pangoscript-snippets",
  "working-examples-corpus",
  "linter-regression-corpus",
];

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

function loadManifest(): ParityManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ParityManifest;
}

function registeredResourceUris(): Set<string> {
  const uris = new Set<string>();
  const server = {
    registerResource(_name: string, uri: string, _config: unknown, _cb: unknown) {
      uris.add(uri);
      return {} as unknown;
    },
  };
  registerResources(server as unknown as McpServer, { knowledge: fixtureKnowledge });
  return uris;
}

describe("MCP knowledge parity manifest", () => {
  it("tracks every extension-visible knowledge source with an explicit MCP exposure decision", () => {
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = loadManifest();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.sources.map((source) => source.id).sort()).toEqual(expectedExtensionVisibleIds.sort());

    for (const source of manifest.sources) {
      expect(source.extensionSurface.length, source.id).toBeGreaterThan(0);
      expect(source.mcpExposure.rationale.trim(), source.id).not.toBe("");
      expect(["mcp-exposed", "vs-code-only", "private"]).toContain(source.mcpExposure.status);
      if (source.path) {
        expect(existsSync(path.join(repoRoot, source.path)), source.id).toBe(true);
      }
      if (source.pathPattern) {
        const parent = pathPatternParent(source);
        expect(existsSync(path.join(repoRoot, parent)), source.id).toBe(true);
      }
    }
  });

  it("rejects malformed pathPattern values before checking the filesystem", () => {
    expect(() => pathPatternParent({ id: "missing-wildcard", pathPattern: "docs/references" })).toThrow(/pathPattern/);
    expect(() => pathPatternParent({ id: "root-wildcard", pathPattern: "*.md" })).toThrow(/pathPattern/);
  });

  it("keeps MCP-exposed sources wired into resources, tools, or the MCP package asset copier", () => {
    const manifest = loadManifest();
    const resourceUris = registeredResourceUris();
    const toolIds = new Set<string>(MCP_TOOL_DEFINITIONS.map((tool) => tool.id));

    for (const source of manifest.sources.filter((entry) => entry.mcpExposure.status === "mcp-exposed")) {
      const { packagePath, resourceUri, tools } = source.mcpExposure;
      expect(Boolean(packagePath || resourceUri || tools?.length), source.id).toBe(true);

      if (resourceUri) {
        expect(resourceUris.has(resourceUri), source.id).toBe(true);
      }
      for (const tool of tools ?? []) {
        expect(toolIds.has(tool), source.id).toBe(true);
      }
      if (packagePath) {
        expect(isCopiedByMcpAssetPolicy(packagePath), source.id).toBe(true);
      }
    }
  });
});

function isCopiedByMcpAssetPolicy(packagePath: string): boolean {
  if (packageSurfacePolicy.mcpAssetFiles.includes(packagePath)) return true;
  if (packageSurfacePolicy.mcpAssetDirectories.includes(packagePath)) return true;
  const fullPath = path.join(repoRoot, packagePath);
  if (existsSync(fullPath) && statSync(fullPath).isFile()) {
    return packageSurfacePolicy.mcpAssetDirectories.includes(path.dirname(packagePath));
  }
  return false;
}

function pathPatternParent(source: Pick<ParitySource, "id" | "pathPattern">): string {
  const pattern = source.pathPattern ?? "";
  const wildcardIndex = pattern.indexOf("*");
  if (wildcardIndex <= 0) {
    throw new Error(`${source.id}: pathPattern must contain a wildcard after a parent directory`);
  }
  return pattern.slice(0, wildcardIndex);
}
