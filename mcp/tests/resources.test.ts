import { describe, expect, it } from "vitest";
import { buildMcpPropertyControlIndex } from "../../src/knowledge/mcpControlReference";
import { buildObjectPropertyIndex } from "../../src/knowledge/objectPropertyIndex";
import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import { buildCommandReferenceSearchIndex } from "../src/commandReference";
import type { McpKnowledgeBase } from "../src/knowledgeBase";
import {
  asResourceContents,
  buildCatalogPayload,
  buildCommandReferencePayload,
  buildSchemasPayload,
  readBundledText,
  readMarkdownDoc,
} from "../src/resources/index";

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
  // catalog isn't exercised by these resource builders; cast a stub.
  catalog: { commands: [], byName: new Map() },
  byName: new Map(),
  propertyIndex: buildPropertyIndex({
    schemaVersion: 1,
    generatedAt: "",
    generatedFrom: "test",
    schemas: [
      { object: "Master", isArray: false, propertyCount: 1, properties: ["Brightness"], sharedWithAliases: 0 },
      { object: "Zone", isArray: true, propertyCount: 1, properties: ["Red"], sharedWithAliases: 0 },
    ],
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

describe("buildCatalogPayload", () => {
  it("serializes the curated knowledge base as JSON", () => {
    const text = buildCatalogPayload(fixtureKnowledge);
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.commands.brightness.canonical).toBe("Brightness");
    expect(parsed.commands.brightness.safetyTier).toBe("T1");
  });
});

describe("buildSchemasPayload", () => {
  it("serializes every canonical schema", () => {
    const text = buildSchemasPayload(fixtureKnowledge);
    const parsed = JSON.parse(text);
    expect(parsed.generatedFrom).toBe("PangoLint MCP bundled property index");
    expect(parsed.objects).toHaveLength(2);
    const names = parsed.objects.map((o: { object: string }) => o.object).sort();
    expect(names).toEqual(["Master", "Zone"]);
  });
});

describe("readMarkdownDoc", () => {
  it("returns bundled JSON data for the command property coverage ledger", () => {
    const text = readBundledText("data/pangoscript/command-property-coverage.json");
    expect(text).toBeDefined();
    expect(JSON.parse(text ?? "{}").schemaVersion).toBe(1);
  });

  it("returns the file contents for a real bundled doc", () => {
    const text = readMarkdownDoc("docs/references/diagnostics/README.md");
    expect(text).toBeDefined();
    expect(text).toMatch(/PangoLint diagnostic codes/);
  });

  it("returns command-reference and object-model docs needed by script-writing agents", () => {
    expect(readMarkdownDoc("docs/references/beyond/pangoscript/master-object-tree.md")).toMatch(/Object Tree/);
    expect(readMarkdownDoc("docs/references/beyond/pangoscript/object-model.md")).toMatch(/object/i);
    expect(readMarkdownDoc("docs/references/beyond/pangoscript/command-reference/general.md")).toMatch(/Brightness/);
  });

  it("returns undefined for missing paths (so callers can surface a clear error)", () => {
    expect(readMarkdownDoc("docs/does-not-exist.md")).toBeUndefined();
  });
});

describe("buildCommandReferencePayload", () => {
  it("combines command-reference docs into one agent-readable markdown resource", () => {
    const text = buildCommandReferencePayload();
    expect(text).toContain("# PangoScript Command Reference");
    expect(text).toContain("## Source: general.md");
    expect(text).toContain("### Brightness");
    expect(text).toContain("## Source: midi-dmx-channel-osc-output.md");
    expect(text).toContain("### OscOutTTS");
  });
});

describe("buildCommandReferenceSearchIndex", () => {
  it("indexes per-command reference prose for task-intent search", () => {
    const index = buildCommandReferenceSearchIndex();
    expect(index.get("brightness")).toMatch(/### Brightness/);
    expect(index.get("oscouttts")).toMatch(/### OscOutTTS/);
  });

  it("does not carry family-section prose into the preceding command", () => {
    const index = buildCommandReferenceSearchIndex();
    expect(index.get("beatresync")).toMatch(/### BeatResync/);
    expect(index.get("beatresync")).not.toMatch(/## Event injection/);
    expect(index.get("beatresync")).not.toMatch(/Unit-testing reactive scripts/);
  });
});

describe("asResourceContents", () => {
  it("wraps text in the SDK's contents shape", () => {
    const result = asResourceContents("pangoscript://x", "text/plain", "hi");
    expect(result.contents).toEqual([{ uri: "pangoscript://x", mimeType: "text/plain", text: "hi" }]);
  });
});
