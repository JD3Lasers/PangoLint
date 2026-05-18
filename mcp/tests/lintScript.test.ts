import { describe, expect, it } from "vitest";
import { parseCommandCatalog } from "../../src/knowledge/catalog";
import { buildObjectPropertyIndex, type ObjectPropertyIndexFile } from "../../src/knowledge/objectPropertyIndex";
import { buildPropertyIndex } from "../../src/knowledge/propertyIndex";
import { PANGO_ANALYSIS_LIMITS } from "../../src/language/analysisLimits";
import { lintScript } from "../src/tools/lintScript";

const catalog = parseCommandCatalog(["Brightness|Brightness 100", 'DisplayPopup|DisplayPopup "Hi"'].join("\n"));
const knowledgeByName = new Map();
const propertyIndex = buildPropertyIndex({
  schemaVersion: 1,
  generatedAt: "",
  generatedFrom: "test",
  schemas: [],
});
const objectPropertyIndex = buildObjectPropertyIndex({
  schemaVersion: 1,
  generatedAt: "",
  generatedFrom: "test",
  entries: [
    {
      path: "WS.N.N.Caption",
      normalizedPath: "WS.N.N.Caption",
      root: "WS",
      property: "Caption",
      kind: "object",
      confidence: "observed",
      searchText: "workspace cue caption",
      variantCount: 1,
      variants: [{ path: "WS.1.2.Caption", osc: "/b/WS/1/2/Caption" }],
    },
    {
      path: "WS.N.N.Ani.0.MaxValue",
      normalizedPath: "WS.N.N.Ani.0.MaxValue",
      root: "WS",
      property: "Ani.0.MaxValue",
      kind: "object",
      confidence: "observed",
      searchText: "workspace cue animation max value",
      variantCount: 1,
      variants: [{ path: "WS.0.0.Ani.0.MaxValue", osc: "/b/WS/0/0/Ani/0/MaxValue" }],
    },
  ],
} satisfies ObjectPropertyIndexFile);

describe("lintScript", () => {
  it("returns an empty diagnostic list for clean scripts", () => {
    const result = lintScript({ text: ["Brightness 50", "exit"].join("\n") }, catalog, knowledgeByName, propertyIndex);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.diagnostics).toEqual([]);
      expect(result.data.errorCount).toBe(0);
    }
  });

  it("counts diagnostics by severity", () => {
    const result = lintScript(
      { text: ["UnknownCmd 1", '"unclosed'].join("\n") },
      catalog,
      knowledgeByName,
      propertyIndex,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const codes: string[] = result.data.diagnostics.map((d) => d.code);
      expect(codes).toContain("unknown-command");
      expect(codes).toContain("unclosed-string");
      expect(result.data.errorCount).toBeGreaterThan(0);
      expect(result.data.warningCount).toBeGreaterThan(0);
    }
  });

  it("fails when text is missing", () => {
    const result = lintScript({ text: undefined as unknown as string }, catalog, knowledgeByName, propertyIndex);
    expect(result.ok).toBe(false);
  });

  it("rejects oversized payloads before running diagnostics", () => {
    const result = lintScript(
      { text: "x".repeat(PANGO_ANALYSIS_LIMITS.maxMcpTextChars + 1) },
      catalog,
      knowledgeByName,
      propertyIndex,
    );

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("text exceeds") });
  });

  it("uses the Object Tree index for MCP property-path typo hints", () => {
    const result = lintScript(
      { text: ['WS.1.2.Captino = "Main"', "exit"].join("\n") },
      catalog,
      knowledgeByName,
      propertyIndex,
      objectPropertyIndex,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "property-typo",
          message: expect.stringContaining("WS.1.2.Caption"),
        }),
      );
    }
  });

  it("does not warn for Object Tree paths with literal numeric property members", () => {
    const result = lintScript(
      { text: ["WS.1.2.Ani.0.MaxValue = 100", "exit"].join("\n") },
      catalog,
      knowledgeByName,
      propertyIndex,
      objectPropertyIndex,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.diagnostics.filter((diagnostic) => diagnostic.code === "property-typo")).toEqual([]);
    }
  });

  it("does not warn for exact Object Tree paths that are absent from canonical schemas", () => {
    const result = lintScript(
      { text: ['WS.1.2.Caption = "Main"', "exit"].join("\n") },
      catalog,
      knowledgeByName,
      propertyIndex,
      objectPropertyIndex,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.diagnostics.filter((diagnostic) => diagnostic.code === "property-typo")).toEqual([]);
    }
  });
});
