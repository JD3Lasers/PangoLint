// Sidebar catalog queries. Wraps the bundled PangoKnowledgeBase and
// derives the renderer-agnostic CommandSummary / CommandDetail shapes
// the sidebar consumes. No vscode imports.

import type { ExpressionFunctionEntry } from "../../knowledge/expressionFunctions";
import type {
  CommandKnowledgeEntry,
  KnowledgeForm,
  KnowledgeNote,
  PangoKnowledgeBase,
} from "../../knowledge/knowledgeBase";
import type { CommandDetail, CommandSummary, FilterState, NoteDetail, ParameterDetail, SignatureDetail } from "./types";

export interface SidebarCatalog {
  /** All commands, sorted by canonical name. */
  list: CommandSummary[];
  /** Lookup by canonical or alias (case-insensitive). */
  byName: Map<string, CommandKnowledgeEntry>;
  /** Sidebar kind keyed by canonical or alias (case-insensitive). */
  kindsByName: Map<string, "command" | "function">;
}

export interface SidebarCatalogOptions {
  expressionFunctions?: readonly ExpressionFunctionEntry[];
}

const HIDDEN_COMMAND_LIST_TAGS = new Set(["prototype", "do-not-use", "internal"]);

export function buildSidebarCatalog(
  knowledgeBase: PangoKnowledgeBase,
  options: SidebarCatalogOptions = {},
): SidebarCatalog {
  const byName = new Map<string, CommandKnowledgeEntry>();
  const kindsByName = new Map<string, "command" | "function">();
  const list: CommandSummary[] = [];

  for (const entry of Object.values(knowledgeBase.commands)) {
    byName.set(entry.canonical.toLowerCase(), entry);
    kindsByName.set(entry.canonical.toLowerCase(), "command");
    for (const alias of entry.aliases ?? []) {
      byName.set(alias.toLowerCase(), entry);
      kindsByName.set(alias.toLowerCase(), "command");
    }
    if (isBrowsableCommandEntry(entry)) {
      list.push(toSummary(entry, "command"));
    }
  }

  for (const entry of options.expressionFunctions ?? []) {
    const adapted = expressionFunctionToKnowledgeEntry(entry);
    byName.set(adapted.canonical.toLowerCase(), adapted);
    kindsByName.set(adapted.canonical.toLowerCase(), "function");
    for (const alias of adapted.aliases ?? []) {
      byName.set(alias.toLowerCase(), adapted);
      kindsByName.set(alias.toLowerCase(), "function");
    }
    list.push(toSummary(adapted, "function"));
  }

  list.sort((a, b) => a.canonical.localeCompare(b.canonical));
  return { list, byName, kindsByName };
}

function isBrowsableCommandEntry(entry: CommandKnowledgeEntry): boolean {
  return !(entry.tags ?? []).some((tag) => HIDDEN_COMMAND_LIST_TAGS.has(tag.toLowerCase()));
}

export function getCommands(catalog: SidebarCatalog, filter: FilterState = {}): CommandSummary[] {
  const query = filter.query?.trim().toLowerCase() ?? "";
  const categories = filter.categories && filter.categories.length > 0 ? new Set(filter.categories) : null;

  const filtered = catalog.list
    .map((command, index) => ({
      command,
      index,
      score: query ? scoreMatch(command, query) : 0,
    }))
    .filter(({ command, score }) => {
      if (categories && !categories.has(command.category)) return false;
      return !query || score !== null;
    });

  if (!query) return filtered.map((wrapped) => wrapped.command);

  return filtered
    .sort((a, b) => (a.score ?? Number.POSITIVE_INFINITY) - (b.score ?? Number.POSITIVE_INFINITY) || a.index - b.index)
    .map((wrapped) => wrapped.command);
}

export function getCommandDetail(catalog: SidebarCatalog, name: string): CommandDetail | undefined {
  const entry = catalog.byName.get(name.trim().toLowerCase());
  if (!entry) return undefined;

  const kind = catalog.kindsByName.get(name.trim().toLowerCase()) ?? "command";
  const summary = toSummary(entry, kind);
  const signatures = (entry.forms ?? []).map(toSignatureDetail);
  const notes = (entry.notes ?? []).map(toNoteDetail);
  const example = entry.forms?.[0]?.signature ?? entry.canonical;

  return {
    ...summary,
    signatures,
    notes,
    tags: entry.tags ?? [],
    setsProperty: entry.setsProperty ?? [],
    example,
  };
}

export function groupByCategory(
  commands: CommandSummary[],
  categoryOrder: Record<string, number> = {},
): Map<string, CommandSummary[]> {
  const groups = new Map<string, CommandSummary[]>();
  for (const command of commands) {
    const cat = command.category;
    const existing = groups.get(cat);
    if (existing) {
      existing.push(command);
    } else {
      groups.set(cat, [command]);
    }
  }
  return new Map(
    [...groups.entries()].sort(([a], [b]) => {
      const oa = categoryOrder[a] ?? Number.MAX_SAFE_INTEGER;
      const ob = categoryOrder[b] ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.localeCompare(b);
    }),
  );
}

function toSummary(entry: CommandKnowledgeEntry, kind: "command" | "function"): CommandSummary {
  const signature = entry.forms?.[0]?.signature ?? entry.canonical;
  return {
    canonical: entry.canonical,
    kind,
    aliases: entry.aliases ?? [],
    description: entry.description ?? entry.forms?.[0]?.description ?? "",
    signature,
    safetyTier: entry.safetyTier ?? "unknown",
    evidenceLevel: entry.evidenceLevel,
    category: entry.category,
  };
}

function toSignatureDetail(form: KnowledgeForm): SignatureDetail {
  const parameters: ParameterDetail[] = (form.parameters ?? []).map((param) => ({
    name: param.name,
    type: param.type,
    required: param.required,
    range: param.range,
    valueRange: param.valueRange,
    acceptedValues: param.acceptedValues,
    description: param.description,
  }));
  return {
    signature: form.signature,
    description: form.description,
    parameters,
  };
}

function toNoteDetail(note: KnowledgeNote): NoteDetail {
  return { text: note.text };
}

function expressionFunctionToKnowledgeEntry(entry: ExpressionFunctionEntry): CommandKnowledgeEntry {
  return {
    canonical: entry.canonical,
    aliases: entry.aliases ?? [],
    description: entry.description,
    evidenceLevel: entry.evidenceLevel,
    confidence: entry.confidence,
    safetyTier: "T0",
    // Expression functions are not BEYOND commands; use a fixed sentinel
    // category so the required field is satisfied.
    category: "Expression",
    forms: entry.forms,
    notes: entry.notes,
    tags: ["expression-function", ...(entry.tags ?? [])],
  };
}

function scoreMatch(command: CommandSummary, query: string): number | null {
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = compactSearchText(normalizedQuery);
  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  if (!normalizedQuery || !compactQuery) return null;

  const nameTargets = [command.canonical, ...command.aliases];
  let best = Number.POSITIVE_INFINITY;
  for (const target of nameTargets) {
    const normalizedTarget = normalizeSearchText(target);
    const compactTarget = compactSearchText(normalizedTarget);
    if (normalizedTarget === normalizedQuery || compactTarget === compactQuery) return 0;
    if (normalizedTarget.startsWith(normalizedQuery) || compactTarget.startsWith(compactQuery)) {
      best = Math.min(best, 1);
      continue;
    }
    if (normalizedTarget.includes(normalizedQuery) || compactTarget.includes(compactQuery)) {
      best = Math.min(best, 2);
    }
  }

  best = Math.min(best, scoreSearchTarget(command.signature, normalizedQuery, compactQuery, queryWords, 3));
  best = Math.min(best, scoreSearchTarget(command.description, normalizedQuery, compactQuery, queryWords, 5));
  best = Math.min(best, scoreSearchTarget(command.category, normalizedQuery, compactQuery, queryWords, 6));

  return Number.isFinite(best) ? best : null;
}

function scoreSearchTarget(
  value: string | undefined,
  normalizedQuery: string,
  compactQuery: string,
  queryWords: string[],
  baseScore: number,
): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const normalizedTarget = normalizeSearchText(value);
  const compactTarget = compactSearchText(normalizedTarget);
  if (normalizedTarget.includes(normalizedQuery) || compactTarget.includes(compactQuery)) return baseScore;
  const targetWords = normalizedTarget.split(" ").filter(Boolean);
  if (
    queryWords.length > 0 &&
    queryWords.every((queryWord) => targetWords.some((targetWord) => targetWord.startsWith(queryWord)))
  ) {
    return baseScore + 0.5;
  }
  return Number.POSITIVE_INFINITY;
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactSearchText(value: string): string {
  return value.replace(/\s+/g, "");
}
