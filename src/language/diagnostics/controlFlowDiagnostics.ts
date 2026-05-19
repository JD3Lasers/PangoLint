import type { ParsedLine } from "../parser";
import { makePangoDiagnostic, type PangoDiagnostic } from "./pangoDiagnostic";
import { findWordOutsideStrings } from "./pangoscriptTextSearch";

const UNSUPPORTED_LOOP_KEYWORDS = new Set(["while", "do", "repeat", "until", "loop"]);
const DELPHI_STYLE_FOR_RANGE_RE = /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*\S[\s\S]*\bto\b\s*\S[\s\S]*$/i;
const TERMINAL_EXIT_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*\s*:\s*)?exit\s*;?$/i;
const EXIT_SEMICOLON_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*\s*:\s*)?exit\s*;\s*$/i;

export function findControlFlowDiagnostics(line: ParsedLine): PangoDiagnostic[] {
  const diagnostics: PangoDiagnostic[] = [];
  const exitSemicolon = findUnsupportedExitSemicolonDiagnostic(line.code, line.raw, line.lineNumber);
  if (exitSemicolon) diagnostics.push(exitSemicolon);

  if (line.kind === "goto" || line.kind === "if") {
    const quotedGoto = findUnsupportedQuotedGotoDiagnostic(line.code, line.raw, line.lineNumber);
    if (quotedGoto) diagnostics.push(quotedGoto);
  }

  if (line.kind !== "command" || !line.command) return diagnostics;
  const cmdLower = line.command.name.toLowerCase();
  if (UNSUPPORTED_LOOP_KEYWORDS.has(cmdLower)) {
    diagnostics.push(
      makePangoDiagnostic(
        line.lineNumber,
        0,
        line.command.name.length,
        "hint",
        "unsupported-loop",
        `'${line.command.name}' is not a PangoScript construct. For conditional loops, use a label + 'If <cond> Goto <label>'.`,
      ),
    );
  } else if (cmdLower === "for" && DELPHI_STYLE_FOR_RANGE_RE.test(line.command.args)) {
    diagnostics.push(
      makePangoDiagnostic(
        line.lineNumber,
        Math.max(0, line.raw.toLowerCase().indexOf("for")),
        line.raw.trim().length,
        "error",
        "unsupported-for-range-syntax",
        "BEYOND reports 'Operation expected: to' for Delphi-style For assignment ranges like `For name = start To end`. Use documented label/Goto control flow instead.",
      ),
    );
  }

  return diagnostics;
}

export function findMissingTerminalExitDiagnostic(line: ParsedLine | undefined): PangoDiagnostic | undefined {
  if (!line || TERMINAL_EXIT_RE.test(line.code.trim())) return undefined;
  return makePangoDiagnostic(
    line.lineNumber,
    0,
    line.raw.length,
    "hint",
    "missing-terminal-exit",
    "BEYOND accepts this shape, but `exit` is recommended to prevent fall-through between script sections.",
  );
}

function findUnsupportedExitSemicolonDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  if (!EXIT_SEMICOLON_RE.test(lineCode.trim())) return undefined;

  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  const exitIndex = lineCode.toLowerCase().lastIndexOf("exit");
  return makePangoDiagnostic(
    lineNumber,
    rawOffset + Math.max(0, exitIndex),
    lineCode.length - Math.max(0, exitIndex),
    "warning",
    "unsupported-exit-semicolon",
    "BEYOND reports 'Invalid expression' for `exit;`. Use bare `exit` without a trailing semicolon.",
  );
}

function findUnsupportedQuotedGotoDiagnostic(
  lineCode: string,
  lineRaw: string,
  lineNumber: number,
): PangoDiagnostic | undefined {
  const gotoIndex = findWordOutsideStrings(lineCode, "goto", 0, lineCode.length);
  if (gotoIndex < 0) return undefined;

  let quoteIndex = gotoIndex + "goto".length;
  while (quoteIndex < lineCode.length && /\s/.test(lineCode[quoteIndex] ?? "")) {
    quoteIndex += 1;
  }
  if (lineCode[quoteIndex] !== '"') return undefined;

  const closingQuoteIndex = lineCode.indexOf('"', quoteIndex + 1);
  const length = closingQuoteIndex >= 0 ? closingQuoteIndex - quoteIndex + 1 : lineCode.length - quoteIndex;
  const label = lineCode.slice(quoteIndex + 1, closingQuoteIndex >= 0 ? closingQuoteIndex : undefined);
  const rawOffset = Math.max(0, lineRaw.indexOf(lineCode));
  return makePangoDiagnostic(
    lineNumber,
    rawOffset + quoteIndex,
    length,
    "warning",
    "unsupported-quoted-goto-label",
    `BEYOND reports 'Illegal goto label: ${label}' for quoted Goto targets. Use a bare label name: Goto ${label}.`,
  );
}
