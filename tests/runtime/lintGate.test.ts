import { describe, expect, it } from "vitest";

import type { PangoDiagnostic } from "../../src/language/diagnostics/pangoDiagnostic";
import { evaluateRuntimeLintGate } from "../../src/runtime/commandBatch/lintGate";

const diagnostic = (severity: PangoDiagnostic["severity"], code: string): PangoDiagnostic => ({
  line: 0,
  start: 0,
  length: 1,
  severity,
  code,
  message: code,
});

describe("runtime lint gate", () => {
  it("blocks error-severity diagnostics", () => {
    const result = evaluateRuntimeLintGate([diagnostic("error", "unclosed-string")]);

    expect(result.ok).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.error).toContain("error-severity");
  });

  it("blocks analysis-limited diagnostics even though they are warnings", () => {
    const result = evaluateRuntimeLintGate([diagnostic("warning", "analysis-limited")]);

    expect(result.ok).toBe(false);
    expect(result.warningCount).toBe(1);
    expect(result.error).toContain("analysis was skipped");
  });

  it("allows warning and hint diagnostics when full analysis completed", () => {
    const result = evaluateRuntimeLintGate([
      diagnostic("warning", "unknown-command"),
      diagnostic("hint", "unused-variable"),
    ]);

    expect(result.ok).toBe(true);
    expect(result.warningCount).toBe(1);
    expect(result.hintCount).toBe(1);
  });
});
