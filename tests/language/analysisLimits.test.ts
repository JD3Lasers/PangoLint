import { describe, expect, it } from "vitest";

import { parseCommandCatalog } from "../../src/knowledge/catalog";
import { PANGO_ANALYSIS_LIMITS } from "../../src/language/analysisLimits";
import { lintPangoScript } from "../../src/language/diagnostics";
import { classifySemanticTokens } from "../../src/language/semanticTokens";

const catalog = parseCommandCatalog(["Brightness|Brightness 100", "SelectZone|SelectZone 1"].join("\n"));

describe("bounded analysis limits", () => {
  it("returns a single analysis-limited diagnostic for oversized documents", () => {
    const text = "Brightness 50\n".repeat(Math.ceil(PANGO_ANALYSIS_LIMITS.maxDocumentChars / 14) + 1);

    const diagnostics = lintPangoScript(text, catalog);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "analysis-limited",
        severity: "warning",
      }),
    ]);
  });

  it("skips deep diagnostics on oversized lines instead of running regex-heavy checks", () => {
    const line = `BogusCommand ${"x".repeat(PANGO_ANALYSIS_LIMITS.maxLineChars + 1)}`;

    const diagnostics = lintPangoScript(line, catalog);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["analysis-limited"]);
  });

  it("preserves error diagnostics when the cap is filled by earlier warnings", () => {
    const warningLines = Array.from(
      { length: PANGO_ANALYSIS_LIMITS.maxDiagnostics },
      (_, index) => `BogusCommand${index} 1`,
    );
    const diagnostics = lintPangoScript([...warningLines, '"unclosed string'].join("\n"), catalog);

    expect(diagnostics).toHaveLength(PANGO_ANALYSIS_LIMITS.maxDiagnostics);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("unclosed-string");
  });

  it("does not classify semantic tokens for documents beyond the shared text budget", () => {
    const text = "Brightness 50\n".repeat(Math.ceil(PANGO_ANALYSIS_LIMITS.maxDocumentChars / 14) + 1);

    expect(classifySemanticTokens(text, catalog)).toEqual([]);
  });
});
