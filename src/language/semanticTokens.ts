// Semantic-token classifier for PangoScript. Goes beyond the TextMate
// grammar by using parser + catalog awareness — known curated commands
// get one color, unknown commands get a different one, label
// declarations vs references are distinguished, and variable
// declarations stand out from reads.
//
// VS Code merges semantic tokens with the TextMate scopes; semantic
// tokens win when both apply. We keep the legend small to make theme
// authoring painless.

import type { CommandCatalog } from "../knowledge/catalog";
import type { PropertyIndex } from "../knowledge/propertyIndex";
import { documentAnalysisLimitReason, lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "./analysisLimits";
import { parseScript } from "./parser";

/**
 * Token type names contributed by PangoLint. Index in this array is the
 * encoded type id used by SemanticTokensBuilder.
 */
export const TOKEN_TYPES = [
  "function", // command names
  "label", // goto targets and label declarations
  "variable", // var declarations and references
  "class", // registered object roots (Master, Zone, registered universes …)
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

/**
 * Token modifiers contributed by PangoLint.
 *   - declaration: `Var X` / `MyLabel:` / first definition site
 *   - defaultLibrary: command appears in the curated catalog
 *   - modification: variable assignment LHS (`X = ...`)
 */
export const TOKEN_MODIFIERS = ["declaration", "defaultLibrary", "modification"] as const;

export type TokenModifier = (typeof TOKEN_MODIFIERS)[number];

const TYPE_INDEX = new Map<TokenType, number>(TOKEN_TYPES.map((name, idx) => [name, idx]));
const MODIFIER_BIT = new Map<TokenModifier, number>(TOKEN_MODIFIERS.map((name, idx) => [name, 1 << idx]));

/**
 * One classified token in the source: zero-based line, start column,
 * length, type, and packed modifier bitmask.
 */
export interface SemanticToken {
  line: number;
  start: number;
  length: number;
  typeId: number;
  modifiers: number;
}

function modBits(...mods: TokenModifier[]): number {
  let bits = 0;
  for (const m of mods) bits |= MODIFIER_BIT.get(m) ?? 0;
  return bits;
}

/**
 * Classify every interesting token in the document. Caller (the
 * DocumentSemanticTokensProvider in extension.ts) feeds these into a
 * SemanticTokensBuilder.
 */
export function classifySemanticTokens(
  text: string,
  catalog: CommandCatalog,
  propertyIndex?: PropertyIndex,
): SemanticToken[] {
  if (documentAnalysisLimitReason(text)) return [];
  const out: SemanticToken[] = [];
  const tokensByLine = new Map<number, SemanticToken[]>();
  const addToken = (token: SemanticToken): void => {
    if (out.length >= PANGO_ANALYSIS_LIMITS.maxSemanticTokens) return;
    out.push(token);
    const lineTokens = tokensByLine.get(token.line);
    if (lineTokens) {
      lineTokens.push(token);
    } else {
      tokensByLine.set(token.line, [token]);
    }
  };
  const lines = text.split(/\r?\n/);
  const parsed = parseScript(text);
  const knownCommandsLower = new Set(catalog.commands.map((c) => c.canonical.toLowerCase()));
  // Track declared variables so we can paint reads after the declaration.
  const declaredVars = new Set<string>();
  for (const line of parsed.lines) {
    if (line.kind === "declaration" && line.declaration) {
      for (const n of line.declaration.names) declaredVars.add(n.toLowerCase());
    }
  }

  const labelType = TYPE_INDEX.get("label") ?? 0;
  const variableType = TYPE_INDEX.get("variable") ?? 0;
  const functionType = TYPE_INDEX.get("function") ?? 0;
  const classType = TYPE_INDEX.get("class") ?? 0;

  for (const line of parsed.lines) {
    const lineText = lines[line.lineNumber] ?? "";
    if (lineAnalysisLimitReason(lineText)) continue;

    // 1. Label declarations (`MyLabel:` form, possibly with trailing statement).
    if (line.label) {
      const labelStart = lineText.indexOf(line.label);
      if (labelStart >= 0) {
        addToken({
          line: line.lineNumber,
          start: labelStart,
          length: line.label.length,
          typeId: labelType,
          modifiers: modBits("declaration"),
        });
      }
    }

    // 2. Goto target references (bare or quoted).
    if ((line.kind === "goto" || line.kind === "if") && line.gotoTarget) {
      const re = /\bgoto\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/gi;
      for (const m of lineText.matchAll(re)) {
        const matched = m[1] ?? m[2];
        if (!matched) continue;
        const matchStart = m.index ?? 0;
        const nameStart = matchStart + m[0].lastIndexOf(matched);
        const isVariableTarget = !m[1] && declaredVars.has(matched.toLowerCase());
        addToken({
          line: line.lineNumber,
          start: nameStart,
          length: matched.length,
          typeId: isVariableTarget ? variableType : labelType,
          modifiers: 0,
        });
      }
    }

    // 3. Command-position identifier on command-kind lines.
    if (line.kind === "command" && line.command) {
      const cmdStart = lineText.indexOf(line.command.name);
      if (cmdStart >= 0) {
        const isKnown = knownCommandsLower.has(line.command.name.toLowerCase());
        addToken({
          line: line.lineNumber,
          start: cmdStart,
          length: line.command.name.length,
          typeId: functionType,
          modifiers: isKnown ? modBits("defaultLibrary") : 0,
        });
      }
    }

    // 4. Variable declaration names (`Var X, Y` → paint X and Y).
    if (line.kind === "declaration" && line.declaration) {
      for (const declName of line.declaration.names) {
        const search = lineText.toLowerCase();
        let from = 0;
        // Find the declared name; match by case-insensitive substring against
        // identifier boundaries to avoid colliding with other tokens.
        while (from < search.length) {
          const idx = search.indexOf(declName.toLowerCase(), from);
          if (idx < 0) break;
          const before = lineText[idx - 1] ?? "";
          const after = lineText[idx + declName.length] ?? "";
          const isWordBoundary = !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
          if (isWordBoundary) {
            // Don't paint the leading "Var" / "GlobalVar" keyword if our name
            // happens to equal that — keywords already get TextMate coloring.
            const tokLower = declName.toLowerCase();
            if (tokLower !== "var" && tokLower !== "globalvar") {
              addToken({
                line: line.lineNumber,
                start: idx,
                length: declName.length,
                typeId: variableType,
                modifiers: modBits("declaration"),
              });
            }
            break;
          }
          from = idx + declName.length;
        }
      }
    }

    // 5. Variable assignment LHS (modification).
    if (line.kind === "assignment" && line.assignment) {
      const target = line.assignment.target;
      if (declaredVars.has(target.toLowerCase())) {
        const idx = lineText.indexOf(target);
        if (idx >= 0) {
          addToken({
            line: line.lineNumber,
            start: idx,
            length: target.length,
            typeId: variableType,
            modifiers: modBits("modification"),
          });
        }
      }
    }

    // 6. Variable reads in expression / argument context.
    if (line.kind === "command" || line.kind === "assignment" || line.kind === "if" || line.kind === "oscAddress") {
      const argText =
        line.kind === "command" || line.kind === "oscAddress"
          ? (line.command?.args ?? "")
          : line.kind === "assignment"
            ? (line.assignment?.expression ?? "")
            : line.code; // if-line: scan whole code
      if (!argText) continue;
      const argStart = lineText.indexOf(argText);
      if (argStart < 0) continue;
      const identRe = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
      for (const m of argText.matchAll(identRe)) {
        const ident = m[1];
        if (!declaredVars.has(ident.toLowerCase())) continue;
        const offsetInArg = m.index ?? 0;
        const absStart = argStart + offsetInArg;
        // Skip dotted property access.
        if (lineText[absStart - 1] === ".") continue;
        addToken({
          line: line.lineNumber,
          start: absStart,
          length: ident.length,
          typeId: variableType,
          modifiers: 0,
        });
      }
    }
  }

  // 7. Property-path roots (e.g. `Master` in `Master.Brightness`,
  // `COLORPICKER` in `COLORPICKER.SECONDARYCOLOR.ColorOff`). Roots that
  // resolve to a registered schema are painted as `class`; bundled
  // canonicals get `defaultLibrary` so themes can distinguish built-in
  // objects from workspace-discovered universes.
  if (propertyIndex) {
    for (const line of parsed.lines) {
      if (line.kind === "comment" || line.kind === "blank") continue;
      const lineText = lines[line.lineNumber] ?? "";
      if (lineAnalysisLimitReason(lineText)) continue;
      const existingOnLine = tokensByLine.get(line.lineNumber) ?? [];
      for (const root of findPropertyPathRoots(lineText)) {
        const schema = propertyIndex.getObject(root.name);
        if (!schema) continue;
        const rootEnd = root.start + root.name.length;
        const overlaps = existingOnLine.some((t) => root.start < t.start + t.length && rootEnd > t.start);
        if (overlaps) continue;
        const isBundled = !schema.discoverySource && !schema.inheritedFrom;
        addToken({
          line: line.lineNumber,
          start: root.start,
          length: root.name.length,
          typeId: classType,
          modifiers: isBundled ? modBits("defaultLibrary") : 0,
        });
      }
    }
  }

  // Stable order: line ascending, then start ascending. SemanticTokensBuilder
  // requires this ordering when push() is used in sequence.
  out.sort((a, b) => a.line - b.line || a.start - b.start);
  return out;
}

/**
 * Scan a line for identifiers in property-path-root position — bare
 * identifiers immediately followed by `.` or `[`. Skips identifiers
 * inside double-quoted strings and `//` line comments.
 */
function findPropertyPathRoots(line: string): Array<{ name: string; start: number }> {
  const out: Array<{ name: string; start: number }> = [];
  let inString = false;
  for (let i = 0; i < line.length; ) {
    const c = line[i];
    if (inString) {
      if (c === "\\" && i + 1 < line.length) {
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      i++;
      continue;
    }
    if (c === "/" && line[i + 1] === "/") break;
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < line.length && /[A-Za-z0-9_]/.test(line[i])) i++;
      const next = line[i];
      if (next === "." || next === "[") {
        // Don't paint a numeric `[` segment with no ident; we want the
        // leading identifier itself.
        out.push({ name: line.slice(start, i), start });
      }
      continue;
    }
    i++;
  }
  return out;
}
