import type { PangoDiagnostic } from "../language/diagnostics/pangoDiagnostic";

export interface RuntimeLintGateResult {
  ok: boolean;
  diagnostics: readonly PangoDiagnostic[];
  errorCount: number;
  warningCount: number;
  hintCount: number;
  error?: string;
}

export function evaluateRuntimeLintGate(diagnostics: readonly PangoDiagnostic[]): RuntimeLintGateResult {
  let errorCount = 0;
  let warningCount = 0;
  let hintCount = 0;
  let analysisLimited = false;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errorCount++;
    else if (diagnostic.severity === "warning") warningCount++;
    else hintCount++;
    if (diagnostic.code === "analysis-limited") analysisLimited = true;
  }

  if (errorCount > 0) {
    return {
      ok: false,
      diagnostics,
      errorCount,
      warningCount,
      hintCount,
      error: `Lint gate refused send: ${errorCount} error-severity diagnostic${errorCount === 1 ? "" : "s"} found.`,
    };
  }

  if (analysisLimited) {
    return {
      ok: false,
      diagnostics,
      errorCount,
      warningCount,
      hintCount,
      error: "Lint gate refused send: script analysis was skipped or capped by PangoLint limits.",
    };
  }

  return { ok: true, diagnostics, errorCount, warningCount, hintCount };
}
