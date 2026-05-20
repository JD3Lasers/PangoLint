import * as vscode from "vscode";
import type { CommandCatalog } from "../knowledge/catalog";
import {
  EXPRESSION_FUNCTIONS,
  type ExpressionFunctionEntry,
  expressionFunctionAtPosition,
} from "../knowledge/expressionFunctions";
import type { CommandKnowledgeEntry, PangoKnowledgeBase } from "../knowledge/knowledgeBase";
import { formatParameterRangeMetadata } from "../knowledge/parameterMetadata";
import { lineAnalysisLimitReason } from "./analysisLimits";
import { leadingCommandName } from "./commandLine";

export function buildKnowledgeByName(kb: PangoKnowledgeBase): Map<string, CommandKnowledgeEntry> {
  const map = new Map<string, CommandKnowledgeEntry>();
  for (const entry of Object.values(kb.commands)) {
    map.set(entry.canonical.toLowerCase(), entry);
    for (const alias of entry.aliases ?? []) {
      map.set(alias.toLowerCase(), entry);
    }
  }
  return map;
}

export function commandCompletionItems(
  catalog: CommandCatalog,
  knowledgeByName: Map<string, CommandKnowledgeEntry>,
): vscode.CompletionItem[] {
  return catalog.commands.map((command) => {
    const item = new vscode.CompletionItem(command.canonical, vscode.CompletionItemKind.Function);
    item.detail = command.example;
    item.documentation = command.description || command.rawLine;
    const entry = knowledgeByName.get(command.canonical.toLowerCase());
    const form = entry?.forms?.[0];
    item.insertText = form && /<[^>]+>/.test(form.signature) ? signatureToSnippet(form.signature) : command.canonical;
    item.sortText = `${safetyBucket(entry?.safetyTier)}_${command.canonical}`;
    return item;
  });
}

export function commandHoverForPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
  knowledgeByName: Map<string, CommandKnowledgeEntry>,
  expressionFunctions: readonly ExpressionFunctionEntry[] = EXPRESSION_FUNCTIONS,
): vscode.Hover | undefined {
  const line = document.lineAt(position.line).text;
  if (lineAnalysisLimitReason(line)) return undefined;
  const command = leadingCommandName(line);
  if (command) {
    if (position.character >= command.start && position.character <= command.end) {
      const entry = knowledgeByName.get(command.name.toLowerCase());
      if (entry) return buildHover(entry, new vscode.Range(position.line, command.start, position.line, command.end));
    }
  }

  const expressionFunction = expressionFunctionAtPosition(line, position.character, expressionFunctions);
  if (!expressionFunction) return undefined;
  return buildExpressionFunctionHover(
    expressionFunction.entry,
    new vscode.Range(position.line, expressionFunction.start, position.line, expressionFunction.end),
  );
}

export function signatureHelpForLinePrefix(
  linePrefix: string,
  knowledgeByName: Map<string, CommandKnowledgeEntry>,
): vscode.SignatureHelp | undefined {
  if (lineAnalysisLimitReason(linePrefix)) return undefined;
  const parsed = parseCommandAndArgIndex(linePrefix);
  if (!parsed) return undefined;
  const entry = knowledgeByName.get(parsed.commandName.toLowerCase());
  if (!entry?.forms?.length) return undefined;
  const form = entry.forms.find((candidate) => candidate.parameters?.length);
  if (!form?.parameters?.length) return undefined;
  const sig = new vscode.SignatureInformation(form.signature, entry.description);
  sig.parameters = form.parameters.map((p) => {
    const label = p.required ? `<${p.name}>` : `[${p.name}]`;
    return new vscode.ParameterInformation(label, p.description);
  });
  const help = new vscode.SignatureHelp();
  help.signatures = [sig];
  help.activeSignature = 0;
  help.activeParameter = Math.min(parsed.argIndex, form.parameters.length - 1);
  return help;
}

function buildHover(entry: CommandKnowledgeEntry, range: vscode.Range): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = { enabledCommands: ["pangolint.sidebar.showCommand"] };
  if (entry.description) {
    md.appendMarkdown(`**${entry.canonical}** - ${entry.description}\n\n`);
  } else {
    md.appendMarkdown(`**${entry.canonical}**\n\n`);
  }
  for (const form of entry.forms ?? []) {
    md.appendCodeblock(form.signature, "pangoscript");
    if (form.description) {
      md.appendMarkdown(`${form.description}\n\n`);
    }
    if (form.parameters && form.parameters.length > 0) {
      md.appendMarkdown("| Parameter | Type | Range | Description |\n");
      md.appendMarkdown("|---|---|---|---|\n");
      for (const p of form.parameters) {
        const name = p.required ? `\`${p.name}\`` : `\`[${p.name}]\``;
        const range = formatParameterRangeMetadata(p).replace(/\|/g, "\\|");
        const desc = (p.description ?? "").replace(/\|/g, "\\|");
        md.appendMarkdown(`| ${name} | ${p.type} | ${range} | ${desc} |\n`);
      }
      md.appendMarkdown("\n");
    }
  }
  const meta: string[] = [];
  if (entry.safetyTier && entry.safetyTier !== "unknown") {
    meta.push(`Safety: ${entry.safetyTier}`);
  }
  meta.push(`Evidence: ${entry.evidenceLevel}`);
  const args = encodeURIComponent(JSON.stringify([{ canonical: entry.canonical }]));
  md.appendMarkdown(
    `*${meta.join(" · ")}*\n\n[View in Commands sidebar](command:pangolint.sidebar.showCommand?${args})`,
  );
  return new vscode.Hover(md, range);
}

function buildExpressionFunctionHover(entry: ExpressionFunctionEntry, range: vscode.Range): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  md.appendMarkdown(`**${entry.canonical}** - ${entry.description}\n\n`);
  for (const form of entry.forms) {
    md.appendCodeblock(form.signature, "pangoscript");
    if (form.description) {
      md.appendMarkdown(`${form.description}\n\n`);
    }
    if (form.parameters && form.parameters.length > 0) {
      md.appendMarkdown("| Parameter | Type | Range | Description |\n");
      md.appendMarkdown("|---|---|---|---|\n");
      for (const p of form.parameters) {
        const name = p.required ? `\`${p.name}\`` : `\`[${p.name}]\``;
        const range = p.range ?? "";
        const desc = (p.description ?? "").replace(/\|/g, "\\|");
        md.appendMarkdown(`| ${name} | ${p.type} | ${range} | ${desc} |\n`);
      }
      md.appendMarkdown("\n");
    }
  }
  if (entry.notes?.length) {
    md.appendMarkdown("**Notes**\n\n");
    for (const note of entry.notes) {
      md.appendMarkdown(`- ${note.text}\n`);
    }
    md.appendMarkdown("\n");
  }
  md.appendMarkdown(`*Expression function · Evidence: ${entry.evidenceLevel}*`);
  return new vscode.Hover(md, range);
}

function safetyBucket(tier: string | undefined | null): "0" | "1" | "2" | "3" {
  switch (tier) {
    case "T1":
    case "T2":
      return "0";
    case "T3":
      return "2";
    case "T4":
      return "3";
    default:
      return "1";
  }
}

function signatureToSnippet(signature: string): vscode.SnippetString {
  let index = 0;
  const text = signature.replace(/<([^>]+)>/g, (_full, name: string) => `\${${++index}:${name}}`);
  return new vscode.SnippetString(text);
}

function parseCommandAndArgIndex(linePrefix: string): { commandName: string; argIndex: number } | undefined {
  const trimmed = linePrefix.trimStart();
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) return undefined;
  const commandName = trimmed.slice(0, spaceIdx);
  const afterCommand = trimmed.slice(spaceIdx).trimStart();
  const commas = (afterCommand.match(/,/g) ?? []).length;
  return { commandName, argIndex: commas };
}
