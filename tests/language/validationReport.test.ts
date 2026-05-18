import { describe, expect, it } from "vitest";

import { formatValidationReport } from "../../src/language/validationReport";

describe("formatValidationReport", () => {
  it("renders a readable diagnostics report for the output channel", () => {
    const report = formatValidationReport({
      documentName: "docs/runbooks/vsix-smoke-test.BeyondCode",
      diagnostics: [
        {
          severity: "error",
          code: "unclosed-string",
          message: "Unclosed string literal.",
          line: 17,
          character: 0,
        },
        {
          severity: "warning",
          code: "unknown-command",
          message: "Unknown PangoScript command 'TotallyMadeUpCommand'.",
          line: 14,
          character: 0,
        },
        {
          severity: "hint",
          code: "missing-terminal-exit",
          message: "BEYOND accepts this shape, but `exit` is recommended.",
          line: 51,
          character: 0,
        },
      ],
    });

    expect(report).toContain("PangoLint validation: docs/runbooks/vsix-smoke-test.BeyondCode");
    expect(report).toContain("3 diagnostics");
    expect(report).toContain("ERROR unclosed-string [Ln 18, Col 1]");
    expect(report).toContain("WARNING unknown-command [Ln 15, Col 1]");
    expect(report).toContain("HINT missing-terminal-exit [Ln 52, Col 1]");
    expect(report).toContain("Unknown PangoScript command 'TotallyMadeUpCommand'.");
  });

  it("renders the clean validation state", () => {
    expect(formatValidationReport({ documentName: "clean.BeyondCode", diagnostics: [] })).toBe(
      "PangoLint validation: clean.BeyondCode\n0 diagnostics\n\nNo PangoLint diagnostics found.",
    );
  });
});
