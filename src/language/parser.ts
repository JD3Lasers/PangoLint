type ParsedLineKind =
  | "blank"
  | "comment"
  | "label"
  | "declaration"
  | "assignment"
  | "command"
  | "oscAddress"
  | "goto"
  | "if"
  | "blockBoundary";

interface DeclarationInfo {
  scope: "var" | "globalvar";
  names: string[];
}

interface AssignmentInfo {
  target: string;
  expression: string;
}

interface CommandInfo {
  name: string;
  args: string;
}

export interface ParsedLine {
  lineNumber: number;
  raw: string;
  code: string;
  comment: string;
  kind: ParsedLineKind;
  label?: string;
  declaration?: DeclarationInfo;
  assignment?: AssignmentInfo;
  command?: CommandInfo;
  gotoTarget?: string;
}

export interface ParsedScript {
  lines: ParsedLine[];
}

const IDENTIFIER = "[A-Za-z_][A-Za-z0-9_]*";
const HARDWARE_ROOT = "FB[34][-_][A-Za-z0-9]+";
const PROPERTY_ROOT = `(?:${HARDWARE_ROOT}|${IDENTIFIER}|#[0-9]+)`;
const IDENTIFIER_RE = new RegExp(`^${IDENTIFIER}$`);
const PROPERTY_PATH_COMMAND = `${PROPERTY_ROOT}(?:\\.(?:${IDENTIFIER}|[0-9]+))*`;
const OBJECT_ROOT_RE = new RegExp(`^${PROPERTY_ROOT}$`);
const ASSIGNMENT_TARGET_RE = new RegExp(`^${PROPERTY_ROOT}(?:[.\\[][A-Za-z0-9_.\\[\\]]*)?$`);
const COMMAND_RE = new RegExp(`^(${PROPERTY_PATH_COMMAND})(?:\\s*(.*))?$`);
const LABEL_PREFIX_RE = new RegExp(`^(${IDENTIFIER})\\s*:\\s*(.*)$`);

export function parseScript(text: string): ParsedScript {
  return {
    lines: text.split(/\r?\n/).map((line, index) => parseLine(line, index)),
  };
}

export function parseLine(raw: string, lineNumber: number): ParsedLine {
  const { code, comment } = splitCodeAndComment(raw.replace(/\r$/, ""));
  const trimmed = code.trim();
  const labelPrefix = splitLeadingLabel(trimmed);
  const statement = labelPrefix?.statement ?? trimmed;
  const base = { lineNumber, raw, code: trimmed, comment, label: labelPrefix?.label };

  if (!trimmed) {
    return { ...base, kind: comment ? "comment" : "blank" };
  }

  if (labelPrefix && !statement) {
    return { ...base, kind: "label", label: labelPrefix.label };
  }

  if (/^[{}](\s*[{}])*$/.test(statement)) {
    return { ...base, kind: "blockBoundary" };
  }

  const declaration = statement.match(/^(var|globalvar)\b\s*(.*?)\s*;?$/i);
  if (declaration) {
    const names = declaration[2]
      .split(",")
      .map((name) => name.trim())
      .filter((name) => IDENTIFIER_RE.test(name));
    return {
      ...base,
      kind: "declaration",
      declaration: {
        scope: declaration[1].toLowerCase() as "var" | "globalvar",
        names,
      },
    };
  }

  if (/^if\b/i.test(statement)) {
    return { ...base, kind: "if", gotoTarget: parseGotoTarget(statement) };
  }

  if (/^goto\b/i.test(statement)) {
    return { ...base, kind: "goto", gotoTarget: parseGotoTarget(statement) };
  }

  if (statement.startsWith("/")) {
    const [address, ...rest] = statement.split(/\s+/);
    return {
      ...base,
      kind: "oscAddress",
      command: { name: address, args: rest.join(" ") },
    };
  }

  const assignmentIndex = findAssignmentOperator(statement);
  if (assignmentIndex >= 0) {
    const target = statement.slice(0, assignmentIndex).trim();
    const expression = stripTrailingSemicolon(statement.slice(assignmentIndex + 1).trim());
    return {
      ...base,
      kind: "assignment",
      assignment: { target, expression },
    };
  }

  const command = statement.match(COMMAND_RE);
  if (command) {
    return {
      ...base,
      kind: "command",
      command: {
        name: command[1],
        args: stripTrailingSemicolon(command[2]?.trim() ?? ""),
      },
    };
  }

  return { ...base, kind: "command", command: { name: statement, args: "" } };
}

export function splitCodeAndComment(raw: string): { code: string; comment: string } {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length - 1; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString && char === "/" && next === "/") {
      return {
        code: raw.slice(0, index).trimEnd(),
        comment: raw.slice(index).trim(),
      };
    }
  }

  return { code: raw.trimEnd(), comment: "" };
}

export function stripStringLiterals(code: string, replacement = '""'): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (const char of code) {
    if (!inString) {
      if (char === '"') {
        out += replacement;
        inString = true;
      } else {
        out += char;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = false;
    }
  }

  return out;
}

export function hasUnclosedString(code: string): boolean {
  let inString = false;
  let escaped = false;

  for (const char of code) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
    }
  }

  return inString;
}

export interface ParenthesesStatus {
  balance: number;
  prematureClose: boolean;
}

export function parenthesesStatus(code: string): ParenthesesStatus {
  let balance = 0;
  let prematureClose = false;
  let inString = false;
  let escaped = false;

  for (const char of code) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "(") {
      balance += 1;
    } else if (char === ")") {
      if (balance === 0) {
        prematureClose = true;
      }
      balance -= 1;
    }
  }

  return { balance, prematureClose };
}

export function splitLeadingLabel(code: string): { label: string; statement: string } | undefined {
  const match = code.match(LABEL_PREFIX_RE);
  if (!match) {
    return undefined;
  }
  return {
    label: match[1],
    statement: match[2].trim(),
  };
}

export function isAssignmentTarget(target: string): boolean {
  const value = target.trim();
  if (!value || /\s/.test(value)) {
    return false;
  }
  if (!OBJECT_ROOT_RE.test(value.split(/[.[]/, 1)[0] ?? "")) {
    return false;
  }
  return ASSIGNMENT_TARGET_RE.test(value);
}

export function extractBareIdentifiers(code: string): string[] {
  const withoutStrings = code.replace(/"([^"\\]|\\.)*"/g, " ");
  const identifiers: string[] = [];
  const matches = withoutStrings.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g);

  for (const match of matches) {
    const name = match[0];
    const start = match.index ?? 0;
    const before = withoutStrings[start - 1] ?? "";
    const after = withoutStrings[start + name.length] ?? "";
    if (before === "." || after === ".") {
      continue;
    }
    identifiers.push(name);
  }

  return identifiers;
}

function stripTrailingSemicolon(value: string): string {
  return value.replace(/\s*;\s*$/, "").trim();
}

export function countArgs(argsString: string): number {
  let s = argsString.trim();
  if (!s) return 0;

  if (s.startsWith("(") && s.endsWith(")")) {
    let depth = 0;
    let wraps = true;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0 && i < s.length - 1) {
          wraps = false;
          break;
        }
      }
    }
    if (wraps) {
      s = s.slice(1, -1).trim();
      if (!s) return 0;
    }
  }

  let inString = false;
  let escaped = false;
  let parenDepth = 0;
  let count = 0;
  let segmentHasNonWhitespace = false;
  for (const ch of s) {
    if (escaped) {
      escaped = false;
      if (!/\s/.test(ch)) segmentHasNonWhitespace = true;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      segmentHasNonWhitespace = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      segmentHasNonWhitespace = true;
      continue;
    }
    if (!inString) {
      if (ch === "(") parenDepth += 1;
      else if (ch === ")") parenDepth -= 1;
      else if (ch === "," && parenDepth === 0) {
        if (segmentHasNonWhitespace) count += 1;
        segmentHasNonWhitespace = false;
        continue;
      }
    }
    if (!/\s/.test(ch)) segmentHasNonWhitespace = true;
  }
  if (segmentHasNonWhitespace) count += 1;
  return count;
}

export function findAssignmentOperator(code: string): number {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "=") {
      const previous = code[index - 1] ?? "";
      const next = code[index + 1] ?? "";
      if (previous === ">" || previous === "<" || next === "=") {
        continue;
      }
      const target = code.slice(0, index).trim();
      if (!isAssignmentTarget(target)) {
        continue;
      }
      return index;
    }
  }

  return -1;
}

function parseGotoTarget(code: string): string | undefined {
  const match = code.match(/\bgoto\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/i);
  return match?.[1] ?? match?.[2];
}
