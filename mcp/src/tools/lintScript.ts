// Tool: lintScript - runs PangoLint's diagnostics over the supplied script
// text and returns the structured diagnostic list.
//
// The MCP linter has no workspace, so user-defined universes / folder-
// scoped auto-discoveries / runtime-validated roots cannot resolve. Only
// canonical bundled schemas (Master, Zone, UniversePanel, …) inform
// property-typo hints.

import type { CommandCatalog } from "../../../src/knowledge/catalog";
import type { CommandKnowledgeEntry } from "../../../src/knowledge/knowledgeBase";
import type { ObjectPropertyIndex } from "../../../src/knowledge/objectPropertyIndex";
import type { PropertyIndex } from "../../../src/knowledge/propertyIndex";
import { mcpTextLimitReason } from "../../../src/language/analysisLimits";
import { lintPangoScript } from "../../../src/language/diagnostics";
import type { PangoDiagnostic } from "../../../src/language/diagnostics/pangoDiagnostic";
import { fail, ok, type ToolResult } from "../config";

export interface LintScriptInput {
  text: string;
}

export interface LintScriptOutput {
  diagnostics: PangoDiagnostic[];
  errorCount: number;
  warningCount: number;
  hintCount: number;
}

export type LintScriptResult = ToolResult<LintScriptOutput>;

export function lintScript(
  input: LintScriptInput,
  catalog: CommandCatalog,
  knowledgeByName: Map<string, CommandKnowledgeEntry>,
  propertyIndex: PropertyIndex,
  objectPropertyIndex?: ObjectPropertyIndex,
): LintScriptResult {
  if (typeof input.text !== "string") return fail("text is required");
  const textLimitReason = mcpTextLimitReason(input.text);
  if (textLimitReason) return fail(`text exceeds MCP lintScript limit: ${textLimitReason}`);
  const diagnostics = lintPangoScript(input.text, catalog, knowledgeByName, propertyIndex, objectPropertyIndex);
  let errorCount = 0;
  let warningCount = 0;
  let hintCount = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") errorCount++;
    else if (d.severity === "warning") warningCount++;
    else hintCount++;
  }
  return ok({ diagnostics, errorCount, warningCount, hintCount });
}
