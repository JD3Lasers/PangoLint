// Tool: explainDiagnostic - returns the human-readable section for a
// diagnostic code from docs/references/diagnostics/README.md and returns
// it as markdown.
//
// The doc file uses `## <code>` headings, with each code's section
// terminated by either the next `## ` heading or end-of-file.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { mcpNameLimitReason } from "../../../src/language/analysisLimits";
import { fail, ok, type ToolResult } from "../config";
import { resolveDataDir } from "../knowledgeBase";

export interface ExplainDiagnosticInput {
  code: string;
}

export interface ExplainDiagnosticOutput {
  code: string;
  markdown: string;
}

export type ExplainDiagnosticResult = ToolResult<ExplainDiagnosticOutput>;

let cachedDoc: string | undefined;
let cachedDocPath: string | undefined;

function loadDoc(env: NodeJS.ProcessEnv): string | undefined {
  const repoRoot = resolveDataDir(env);
  const docPath = path.join(repoRoot, "docs", "references", "diagnostics", "README.md");
  if (cachedDocPath === docPath && cachedDoc !== undefined) return cachedDoc;
  if (!existsSync(docPath)) return undefined;
  cachedDoc = readFileSync(docPath, "utf8");
  cachedDocPath = docPath;
  return cachedDoc;
}

export function explainDiagnostic(
  input: ExplainDiagnosticInput,
  env: NodeJS.ProcessEnv = process.env,
): ExplainDiagnosticResult {
  const code = input.code?.trim();
  if (!code) return fail("code is required");
  const codeLimitReason = mcpNameLimitReason(code);
  if (codeLimitReason) return fail(`code exceeds MCP explainDiagnostic limit: ${codeLimitReason}`);

  const doc = loadDoc(env);
  if (doc === undefined) return fail("diagnostics doc not found in bundled data", true);

  const section = extractSection(doc, code);
  if (!section) return fail(`no documentation entry for diagnostic '${code}'`);
  return ok({ code, markdown: section });
}

/**
 * Read the `## <code>` section's body. Section ends at the next `## `
 * heading at the same level or end-of-file. Match is case-insensitive on
 * the code value but preserves the doc text verbatim.
 */
export function extractSection(doc: string, code: string): string | undefined {
  const lines = doc.split(/\r?\n/);
  const wantHeading = `## ${code.toLowerCase()}`;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().trimEnd() === wantHeading) {
      start = i;
      break;
    }
  }
  if (start === -1) return undefined;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trimEnd();
}

/** Test-only: clear the cached doc so a fresh load happens next call. */
export function _resetCache(): void {
  cachedDoc = undefined;
  cachedDocPath = undefined;
}
