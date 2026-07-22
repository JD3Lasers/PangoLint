import * as vscode from "vscode";
import { EXTENSION_COMMAND_IDS } from "../extensionHost/extensionIds";
import type { CommandCatalog } from "../knowledge/catalog";
import { type KnownObjectSchema, type PropertyIndex, perIndexSchemaName } from "../knowledge/propertyIndex";
import { lineAnalysisLimitReason, PANGO_ANALYSIS_LIMITS } from "./analysisLimits";
import { levenshteinDistance } from "./diagnostics/stringDistance";

const PROPERTY_ROOT = "(?:[A-Za-z_][A-Za-z0-9_]*|#[0-9]+)";
const PROPERTY_PATH_PREFIX_RE = new RegExp(`(${PROPERTY_ROOT})((?:\\.(?:[A-Za-z0-9_]+|\\d+))*)\\.$`);
const PROPERTY_PATH_AT_POSITION_RE = new RegExp(`(${PROPERTY_ROOT})((?:\\.(?:[A-Za-z0-9_]+|\\d+))*)`, "g");

export function propertyCompletionsForPrefix(
  linePrefix: string,
  propertyIndex: PropertyIndex,
): vscode.CompletionItem[] | null {
  if (lineAnalysisLimitReason(linePrefix)) return null;
  const match = PROPERTY_PATH_PREFIX_RE.exec(linePrefix);
  if (!match) return null;
  const root = match[1];
  const intermediate = match[2];
  const schema = propertyIndex.getObject(root);
  if (!schema) return null;

  const segments = intermediate.split(".").filter((s) => s.length > 0);
  let propPrefixSegments: string[] = [];

  if (schema.isArray) {
    if (segments.length === 0) {
      const items = (schema.rootProperties ?? []).map((name) => {
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
        item.detail = `${schema.object}.${name} - direct property`;
        item.insertText = name;
        return item;
      });
      if (schema.arrayIndices && schema.arrayIndices.length > 0) {
        items.push(
          ...schema.arrayIndices.map((name) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.EnumMember);
            item.detail = `${schema.object}.${name} - discovered control`;
            item.insertText = name;
            return item;
          }),
        );
        return items;
      }
      const indexCompletion = new vscode.CompletionItem("0", vscode.CompletionItemKind.Value);
      indexCompletion.detail = `${schema.object}.0 - index into ${schema.object}.ARRAY`;
      indexCompletion.insertText = "0";
      items.push(indexCompletion);
      return items;
    }
    if (isDirectRootProperty(schema, segments[0])) return [];
    propPrefixSegments = segments.slice(1);
  } else {
    propPrefixSegments = segments;
  }

  let propsSource: KnownObjectSchema = schema;
  if (schema.isArray && segments.length >= 1) {
    const targetName = perIndexSchemaName(schema, segments[0]);
    if (targetName) {
      const target = propertyIndex.getObject(targetName);
      if (target) propsSource = target;
    }
  }

  const propPrefix = propPrefixSegments.join(".");
  const seen = new Set<string>();
  const items: vscode.CompletionItem[] = [];

  for (const prop of propsSource.properties) {
    let suffix: string;
    if (propPrefix === "") {
      suffix = prop;
    } else if (prop === propPrefix) {
      continue;
    } else if (prop.startsWith(`${propPrefix}.`)) {
      suffix = prop.slice(propPrefix.length + 1);
    } else {
      continue;
    }
    const nextSegment = suffix.split(".")[0];
    if (seen.has(nextSegment)) continue;
    seen.add(nextSegment);

    const isLeaf = !suffix.includes(".");
    const item = new vscode.CompletionItem(
      nextSegment,
      isLeaf ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.Module,
    );
    item.detail = isLeaf
      ? `${schema.object}${schema.isArray ? ".N" : ""}.${propPrefix ? `${propPrefix}.` : ""}${nextSegment}`
      : `${schema.object} struct (${prop.startsWith(`${propPrefix}.`) ? prop : `${nextSegment}.*`})`;
    items.push(item);
  }

  return items;
}

export function hoverForPropertyPath(
  line: string,
  column: number,
  propertyIndex: PropertyIndex,
  lineNumber: number,
): vscode.Hover | undefined {
  if (lineAnalysisLimitReason(line)) return undefined;
  let containing: { start: number; end: number; text: string } | undefined;
  for (const m of line.matchAll(PROPERTY_PATH_AT_POSITION_RE)) {
    const start = m.index ?? 0;
    if (start > 0 && /[A-Za-z0-9_#]/.test(line[start - 1] ?? "")) continue;
    const end = start + m[0].length;
    if (start <= column && column <= end && m[2].length > 0) {
      containing = { start, end, text: m[0] };
      break;
    }
  }
  if (!containing) return undefined;

  const parts = containing.text.split(".");
  const root = parts[0];
  const schema = propertyIndex.getObject(root);
  if (!schema) return undefined;

  let segIndex = 0;
  let segOffset = containing.start;
  for (let i = 0; i < parts.length; i++) {
    const segEnd = segOffset + parts[i].length;
    if (column <= segEnd) {
      segIndex = i;
      break;
    }
    segOffset = segEnd + 1;
    segIndex = i + 1;
  }
  if (segIndex >= parts.length) segIndex = parts.length - 1;

  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  md.appendMarkdown(`**\`${containing.text}\`**\n\n`);

  const inheritedNote = schema.inheritedFrom
    ? ` Inherits the canonical **${schema.inheritedFrom}** schema (${schema.propertyCount} properties).`
    : "";

  if (segIndex === 0) {
    appendRootHoverMarkdown(md, schema, inheritedNote);
    return new vscode.Hover(md, new vscode.Range(lineNumber, containing.start, lineNumber, containing.end));
  }

  let controlSchema: KnownObjectSchema | undefined;
  let controlKind: "effect" | "zonePad" | undefined;
  if (schema.isArray && parts.length >= 2) {
    const targetName = perIndexSchemaName(schema, parts[1]);
    if (targetName) {
      controlSchema = propertyIndex.getObject(targetName);
      controlKind = targetName === "UniverseEffectControl" ? "effect" : "zonePad";
    }
  }

  const directRootProperty = schema.isArray && isDirectRootProperty(schema, parts[1]);
  if (schema.isArray && segIndex === 1 && !directRootProperty) {
    const seg = parts[1];
    if (schema.inheritedFrom === "UniversePanel") {
      const known = schema.arrayIndices?.includes(seg);
      const kindNote =
        controlKind === "effect"
          ? " - classified as **Effect control** from observed `Effect.*` usage"
          : controlKind === "zonePad"
            ? " - classified as **ZonePad control** from observed `Zone.*` usage"
            : "";
      md.appendMarkdown(
        `Control \`${seg}\` on \`${schema.object}\`${known ? " (discovered in workspace)" : " (not yet observed in scripts)"}${kindNote}.${inheritedNote}`,
      );
    } else {
      md.appendMarkdown(`Index slot for \`${schema.object}\` (array-of-records access).`);
    }
    return new vscode.Hover(md, new vscode.Range(lineNumber, containing.start, lineNumber, containing.end));
  }

  if (directRootProperty) {
    if (parts.length === 2) {
      md.appendMarkdown(`Verified direct property on **${schema.object}**.`);
    } else {
      md.appendMarkdown(
        `\`${schema.object}.${parts[1]}\` is a direct property with no nested path; \`${containing.text}\` is not valid.`,
      );
    }
    return new vscode.Hover(md, new vscode.Range(lineNumber, containing.start, lineNumber, containing.end));
  }

  const propPath = schema.isArray ? parts.slice(2).join(".") : parts.slice(1).join(".");
  if (!propPath) return undefined;

  const verifyAgainst = controlSchema ?? schema;
  const sourceName = controlSchema ? controlSchema.object : schema.inheritedFrom;
  const inheritedFromControl = controlSchema
    ? ` Inherits the canonical **${controlSchema.object}** schema (${controlSchema.propertyCount} properties).`
    : inheritedNote;

  if (verifyAgainst.properties.includes(propPath)) {
    md.appendMarkdown(
      `Verified property on **${schema.object}**${schema.isArray ? " (indexed)" : ""}` +
        `${schema.sharedWithAliases > 0 ? ` (schema also used by ${schema.sharedWithAliases} alias root${schema.sharedWithAliases > 1 ? "s" : ""})` : ""}.${inheritedFromControl}`,
    );
  } else {
    md.appendMarkdown(
      `Root \`${schema.object}\` is a known BEYOND object (${verifyAgainst.propertyCount} verified properties on ${sourceName ?? schema.object}), but \`${propPath}\` is not in its known schema.`,
    );
  }
  return new vscode.Hover(md, new vscode.Range(lineNumber, containing.start, lineNumber, containing.end));
}

function isDirectRootProperty(schema: KnownObjectSchema, property: string): boolean {
  const propertyLower = property.toLowerCase();
  return schema.rootProperties?.some((candidate) => candidate.toLowerCase() === propertyLower) ?? false;
}

export function codeActionsForUnknownRoot(
  line: string,
  column: number,
  propertyIndex: PropertyIndex,
): vscode.CodeAction[] | undefined {
  if (lineAnalysisLimitReason(line)) return undefined;
  const pathRe = new RegExp(`(${PROPERTY_ROOT})((?:\\.(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+))+)\\b`, "g");
  let containing: { root: string; rootStart: number; rootEnd: number } | undefined;
  for (const m of line.matchAll(pathRe)) {
    const start = m.index ?? 0;
    if (start > 0 && /[A-Za-z0-9_#]/.test(line[start - 1] ?? "")) continue;
    const end = start + m[0].length;
    if (start <= column && column <= end) {
      containing = { root: m[1], rootStart: start, rootEnd: start + m[1].length };
      break;
    }
  }
  if (!containing) return undefined;
  const existing = propertyIndex.getObject(containing.root);
  if (existing && existing.discoverySource !== "folderScope") return undefined;

  const universeAction = new vscode.CodeAction(
    `PangoLint: add '${containing.root}' as user universe`,
    vscode.CodeActionKind.QuickFix,
  );
  universeAction.command = {
    command: EXTENSION_COMMAND_IDS.addUserObject,
    title: "Add user universe",
    arguments: [containing.root, "universe"],
  };

  const zoneAction = new vscode.CodeAction(
    `PangoLint: add '${containing.root}' as zone alias (inherits Zone schema)`,
    vscode.CodeActionKind.QuickFix,
  );
  zoneAction.command = {
    command: EXTENSION_COMMAND_IDS.addUserObject,
    title: "Add zone alias",
    arguments: [containing.root, "zoneAlias"],
  };

  const masterAction = new vscode.CodeAction(
    `PangoLint: add '${containing.root}' as Master alias (inherits Master schema)`,
    vscode.CodeActionKind.QuickFix,
  );
  masterAction.command = {
    command: EXTENSION_COMMAND_IDS.addUserObject,
    title: "Add Master alias",
    arguments: [containing.root, "masterAlias"],
  };

  return [universeAction, zoneAction, masterAction];
}

export function quickFixesForPropertyTypos(
  document: vscode.TextDocument,
  diagnostics: readonly vscode.Diagnostic[],
): vscode.CodeAction[] {
  const out: vscode.CodeAction[] = [];
  const allTypos = diagnostics.filter((d) => diagnosticCodeEquals(d, "property-typo") && d.source === "PangoLint");
  const typos = allTypos.slice(0, PANGO_ANALYSIS_LIMITS.maxQuickFixDiagnostics);
  const isTruncated = allTypos.length > typos.length;
  for (const diag of typos) {
    const match = /Did you mean ([\w.]+)\?/.exec(diag.message);
    if (!match) continue;
    const suggestion = match[1];
    const action = new vscode.CodeAction(`Replace with '${suggestion}'`, vscode.CodeActionKind.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, diag.range, suggestion);
    action.edit = edit;
    action.diagnostics = [diag];
    action.isPreferred = true;
    out.push(action);
  }
  if (typos.length > 1) {
    const title = isTruncated
      ? `PangoLint: fix first ${typos.length} property typos in file`
      : "PangoLint: fix all property typos in file";
    const fixAll = new vscode.CodeAction(
      title,
      isTruncated ? vscode.CodeActionKind.QuickFix : vscode.CodeActionKind.SourceFixAll,
    );
    const edit = new vscode.WorkspaceEdit();
    for (const diag of typos) {
      const match = /Did you mean ([\w.]+)\?/.exec(diag.message);
      if (!match) continue;
      edit.replace(document.uri, diag.range, match[1]);
    }
    fixAll.edit = edit;
    fixAll.diagnostics = [...typos];
    out.push(fixAll);
  }
  return out;
}

export function quickFixesForUnknownCommand(
  document: vscode.TextDocument,
  diagnostics: readonly vscode.Diagnostic[],
  catalog: CommandCatalog,
): vscode.CodeAction[] {
  const out: vscode.CodeAction[] = [];
  const unknowns = diagnostics
    .filter((d) => diagnosticCodeEquals(d, "unknown-command") && d.source === "PangoLint")
    .slice(0, PANGO_ANALYSIS_LIMITS.maxQuickFixDiagnostics);
  for (const diag of unknowns) {
    const typed = document.getText(diag.range);
    if (!typed) continue;
    if (typed.length > PANGO_ANALYSIS_LIMITS.maxQuickFixCommandLength) continue;
    const threshold = Math.max(2, Math.ceil(typed.length * 0.3));
    const ranked: Array<{ name: string; distance: number }> = [];
    for (const cmd of catalog.commands) {
      const d = levenshteinDistance(typed, cmd.canonical);
      if (d > 0 && d <= threshold) ranked.push({ name: cmd.canonical, distance: d });
    }
    ranked.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
    for (const [i, candidate] of ranked.slice(0, 3).entries()) {
      const action = new vscode.CodeAction(`Replace with '${candidate.name}'`, vscode.CodeActionKind.QuickFix);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, diag.range, candidate.name);
      action.edit = edit;
      action.diagnostics = [diag];
      if (i === 0) action.isPreferred = true;
      out.push(action);
    }
  }
  return out;
}

function appendRootHoverMarkdown(md: vscode.MarkdownString, schema: KnownObjectSchema, inheritedNote: string): void {
  if (schema.inheritedFrom === "UniversePanel") {
    const buttonCount = schema.arrayIndices?.length ?? 0;
    const buttonsNote = buttonCount > 0 ? ` - ${buttonCount} discovered control${buttonCount === 1 ? "" : "s"}` : "";
    let kindLabel: string;
    let sourceNote = "";
    if (schema.discoverySource === "beyondReadback") {
      kindLabel = "**BEYOND-validated universe panel**";
      sourceNote = ` Confirmed via runtime readback${schema.validatedAt ? ` at ${schema.validatedAt}` : ""}; session-scoped.`;
    } else if (schema.discoverySource === "folderScope") {
      kindLabel = "**folder-scoped universe panel**";
      sourceNote = ` Auto-discovered from ${schema.observedFileCount ?? 0} sibling \`.BeyondCode\` file${schema.observedFileCount === 1 ? "" : "s"}; classify it explicitly with the lightbulb code action to lock the type in, or run *Validate objects against BEYOND* to confirm against a live host.`;
    } else {
      kindLabel = "Registered **universe panel**";
    }
    md.appendMarkdown(`${kindLabel} \`${schema.object}\`${buttonsNote}.${inheritedNote}${sourceNote}`);
  } else if (schema.inheritedFrom === "Zone") {
    md.appendMarkdown(`Registered **zone alias** \`${schema.object}\`.${inheritedNote}`);
  } else if (schema.inheritedFrom === "Master") {
    md.appendMarkdown(`Registered **master alias** \`${schema.object}\`.${inheritedNote}`);
  } else {
    md.appendMarkdown(
      `Known BEYOND object **\`${schema.object}\`**${schema.isArray ? " (indexed)" : ""} - ${schema.propertyCount} verified properties.`,
    );
  }
}

function diagnosticCodeEquals(diag: vscode.Diagnostic, code: string): boolean {
  const c = diag.code;
  if (typeof c === "string") return c === code;
  if (c && typeof c === "object" && "value" in c) return c.value === code;
  return false;
}
