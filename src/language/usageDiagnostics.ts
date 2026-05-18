import type { ParsedLine } from "./parser";

const ENTRY_POINT_LABEL_NAMES = new Set([
  "init",
  "start",
  "main",
  "setup",
  "end",
  "finish",
  "onclick",
  "ondoubleclick",
  "onpress",
  "onrelease",
  "onhover",
  "onmouseover",
  "onmouseout",
  "onenter",
  "onexit",
  "onload",
  "onunload",
  "onchange",
  "onvalue",
  "onvaluechanged",
  "onfocus",
  "onblur",
  "ontick",
  "ontimer",
]);

export function isExternallyInvokedLabelName(name: string): boolean {
  return ENTRY_POINT_LABEL_NAMES.has(name.toLowerCase());
}

export function expressionForVariableReads(line: ParsedLine): string {
  if (line.kind === "assignment") {
    return line.assignment?.expression ?? "";
  }
  if (line.kind === "command") {
    return line.command?.args ?? "";
  }
  if (line.kind === "oscAddress") {
    return `${line.command?.name ?? ""} ${line.command?.args ?? ""}`;
  }
  if (line.kind === "if") {
    return line.code;
  }
  return "";
}
