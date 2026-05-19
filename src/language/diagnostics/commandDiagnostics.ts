import { type CommandCatalog, lookupCommand } from "../../knowledge/catalog";
import type { CommandKnowledgeEntry, KnowledgeForm } from "../../knowledge/knowledgeBase";
import { countArgs, type ParsedLine } from "../parser";
import { makePangoDiagnostic, type PangoDiagnostic } from "./pangoDiagnostic";

const COMMAND_NAMES_WITH_SEPARATE_DIAGNOSTICS = new Set([
  "exit",
  "for",
  "next",
  "while",
  "do",
  "repeat",
  "until",
  "loop",
]);

export function findUnknownCommandDiagnostic(line: ParsedLine, catalog: CommandCatalog): PangoDiagnostic | undefined {
  if (line.kind !== "command" || !line.command) return undefined;
  const cmdLower = line.command.name.toLowerCase();
  if (COMMAND_NAMES_WITH_SEPARATE_DIAGNOSTICS.has(cmdLower)) return undefined;
  if (isPropertyPathCommandName(line.command.name)) return undefined;
  if (lookupCommand(catalog, line.command.name)) return undefined;

  return makePangoDiagnostic(
    line.lineNumber,
    0,
    line.command.name.length,
    "warning",
    "unknown-command",
    `Unknown PangoScript command '${line.command.name}'.`,
  );
}

export function findWrongArgumentCountDiagnostic(
  line: ParsedLine,
  knowledgeByName: Map<string, CommandKnowledgeEntry> | undefined,
): PangoDiagnostic | undefined {
  if (line.kind !== "command" || !line.command || !knowledgeByName) return undefined;
  const entry = knowledgeByName.get(line.command.name.toLowerCase());
  const arity = entry?.forms ? checkArity(line.command.args, entry.forms) : undefined;
  if (!arity) return undefined;

  return makePangoDiagnostic(
    line.lineNumber,
    0,
    line.command.name.length,
    "warning",
    "wrong-arg-count",
    `${line.command.name} expects ${arity.expected} ${arity.expected === "1" ? "argument" : "arguments"}, got ${arity.actual}.`,
  );
}

function isPropertyPathCommandName(name: string): boolean {
  return name.includes(".");
}

function checkArity(argsString: string, forms: KnowledgeForm[]): { expected: string; actual: number } | undefined {
  const actual = countArgs(argsString);
  const ranges = arityRangesForForms(forms);

  if (ranges.length === 0) return undefined;
  if (ranges.some((range) => actual >= range.min && actual <= range.max)) {
    return undefined;
  }

  return { expected: describeArityExpectation(ranges), actual };
}

function arityRangesForForms(forms: KnowledgeForm[]): Array<{ min: number; max: number }> {
  const hasCuratedForms = forms.some((form) => !isGeneratedOptionalExampleForm(form) && !isGeneratedBareStub(form));
  const hasCuratedParameterizedForms = forms.some((form) => {
    return !isGeneratedOptionalExampleForm(form) && !isGeneratedBareStub(form) && (form.parameters?.length ?? 0) > 0;
  });

  return forms.flatMap((form) => {
    if (isGeneratedOptionalExampleForm(form)) {
      const count = form.parameters?.length ?? 0;
      return [{ min: hasCuratedForms ? count : 0, max: count }];
    }
    if (hasCuratedParameterizedForms && isGeneratedBareStub(form)) return [];

    const range = arityRangeForForm(form);
    return range ? [range] : [];
  });
}

function isGeneratedOptionalExampleForm(form: KnowledgeForm): boolean {
  const params = form.parameters ?? [];
  if (params.length === 0) return false;
  return params.every(
    (param, index) => param.name === `arg${index + 1}` && param.type === "unknown" && param.required === false,
  );
}

function isGeneratedBareStub(form: KnowledgeForm): boolean {
  return form.parameters === undefined && isBareCommandSignature(form.signature);
}

function arityRangeForForm(form: KnowledgeForm): { min: number; max: number } | undefined {
  if (isZeroArityForm(form)) return { min: 0, max: 0 };

  const params = form.parameters ?? [];
  if (params.length === 0) return undefined;

  const required = params.filter((param) => param.required).length;
  return {
    min: required,
    max: isVariadicForm(form) ? Number.POSITIVE_INFINITY : params.length,
  };
}

function isVariadicForm(form: KnowledgeForm): boolean {
  if (/\.\.\./.test(form.signature ?? "")) return true;
  return (form.parameters ?? []).some((param) => {
    return param.type === "variadic" || /\.\.n\b/i.test(param.name) || /\brepeatable\b/i.test(param.description ?? "");
  });
}

function describeArityExpectation(ranges: Array<{ min: number; max: number }>): string {
  const merged = mergeArityRanges(ranges);
  if (merged.length === 1) {
    const [range] = merged;
    if (!range) return "unknown";
    if (range.max === Number.POSITIVE_INFINITY) return `at least ${range.min}`;
    if (range.min === range.max) return String(range.min);
    return `between ${range.min} and ${range.max}`;
  }

  const exactValues = merged
    .filter((range) => range.min === range.max)
    .map((range) => range.min)
    .sort((left, right) => left - right);
  if (exactValues.length === merged.length && exactValues.length <= 3) {
    return exactValues.join(" or ");
  }

  const variadic = merged.find((range) => range.max === Number.POSITIVE_INFINITY);
  if (variadic) {
    const exactPrefix = exactValues.length > 0 ? `${exactValues.join(" or ")} or ` : "";
    return `${exactPrefix}at least ${variadic.min}`;
  }

  return `between ${Math.min(...merged.map((range) => range.min))} and ${Math.max(...merged.map((range) => range.max))}`;
}

function mergeArityRanges(ranges: Array<{ min: number; max: number }>): Array<{ min: number; max: number }> {
  const sorted = [...ranges].sort((left, right) => left.min - right.min || left.max - right.max);
  const merged: Array<{ min: number; max: number }> = [];
  for (const range of sorted) {
    const prior = merged[merged.length - 1];
    if (!prior || range.min > prior.max + 1) {
      merged.push({ ...range });
      continue;
    }
    prior.max = Math.max(prior.max, range.max);
  }
  return merged;
}

function isZeroArityForm(form: KnowledgeForm): boolean {
  return Array.isArray(form.parameters) && form.parameters.length === 0 && isBareCommandSignature(form.signature);
}

function isBareCommandSignature(signature: string | undefined): boolean {
  const trimmed = signature?.trim() ?? "";
  return trimmed.length > 0 && !/\s/.test(trimmed) && !/[<[]/.test(trimmed);
}
