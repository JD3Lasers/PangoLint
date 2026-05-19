// Tool: searchCommands — task-intent search over command names, aliases,
// descriptions, categories, forms, parameters, notes, tags, and optional
// command-reference prose, with typo tolerance from Levenshtein distance. The
// catalog schema declares safetyTier values T0..T4 plus "unknown"; filtering
// is case-sensitive on the enum.

import type { CommandKnowledgeEntry, SafetyTier } from "../../../src/knowledge/knowledgeBase";
import { mcpQueryLimitReason } from "../../../src/language/analysisLimits";
import { levenshteinDistance } from "../../../src/language/diagnostics/stringDistance";
import { fail, ok, type ToolResult } from "../config";

export interface SearchCommandsInput {
  query: string;
  /** Optional safetyTier filter. Entries without a matching tier are excluded. */
  safetyTier?: SafetyTier;
  /** Maximum number of matches to return. Default 10, max 50. */
  limit?: number;
}

export interface SearchHit {
  canonical: string;
  aliases: string[];
  description: string;
  safetyTier: SafetyTier | undefined;
  score: number;
  distance: number;
  matchedFields: string[];
  referenceExcerpt?: string;
}

export type SearchCommandsResult = ToolResult<{ hits: SearchHit[]; query: string }>;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const FIELD_WEIGHTS = {
  name: 24,
  description: 12,
  tags: 12,
  forms: 10,
  parameters: 10,
  reference: 9,
  category: 8,
  notes: 8,
} as const;

type SearchField = keyof typeof FIELD_WEIGHTS;

const FIELD_ORDER: SearchField[] = [
  "name",
  "description",
  "parameters",
  "category",
  "forms",
  "reference",
  "notes",
  "tags",
];

export function searchCommands(
  input: SearchCommandsInput,
  byName: Map<string, CommandKnowledgeEntry>,
  referenceTextByCanonical: ReadonlyMap<string, string> = new Map(),
): SearchCommandsResult {
  const query = input.query?.trim();
  if (!query) return fail("query is required");
  const queryLimitReason = mcpQueryLimitReason(query);
  if (queryLimitReason) return fail(`query exceeds MCP searchCommands limit: ${queryLimitReason}`);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return fail("query must contain at least one letter or number");
  const limit = clampLimit(input.limit);
  const tierFilter = input.safetyTier;

  // Walk unique entries (the byName map repeats entries under aliases).
  const seen = new Set<CommandKnowledgeEntry>();
  const candidates: CommandKnowledgeEntry[] = [];
  for (const entry of byName.values()) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    if (tierFilter && entry.safetyTier !== tierFilter) continue;
    candidates.push(entry);
  }

  const queryLower = query.toLowerCase();
  const terms = tokenizeSearchText(query);
  const ranked: SearchHit[] = [];
  for (const entry of candidates) {
    // Best-distance over canonical + aliases.
    let best = Number.POSITIVE_INFINITY;
    const targets = [entry.canonical, ...(entry.aliases ?? [])];
    const matchedFields = new Set<SearchField>();
    let score = 0;
    for (const target of targets) {
      const targetLower = target.toLowerCase();
      const d = levenshteinDistance(queryLower, targetLower);
      if (d < best) best = d;
      score += scoreNameTarget(targetLower, normalizedQuery, terms);
      if (
        targetLower.includes(queryLower) ||
        queryLower.includes(targetLower) ||
        terms.some((term) => targetLower.includes(term))
      ) {
        matchedFields.add("name");
      }
    }
    score += Math.max(0, 60 - best * 4);
    score += scoreTextField("description", entry.description, normalizedQuery, terms, matchedFields);
    score += scoreTextField("category", entry.category, normalizedQuery, terms, matchedFields);
    score += scoreTextField("forms", formatForms(entry), normalizedQuery, terms, matchedFields);
    score += scoreTextField("parameters", formatParameters(entry), normalizedQuery, terms, matchedFields);
    const referenceText = referenceTextByCanonical.get(entry.canonical.toLowerCase());
    score += scoreTextField("reference", referenceText, normalizedQuery, terms, matchedFields);
    score += scoreTextField(
      "notes",
      entry.notes?.map((note) => note.text).join("\n"),
      normalizedQuery,
      terms,
      matchedFields,
    );
    score += scoreTextField("tags", entry.tags?.join(" "), normalizedQuery, terms, matchedFields);

    ranked.push({
      canonical: entry.canonical,
      aliases: entry.aliases ?? [],
      description: entry.description ?? "",
      safetyTier: entry.safetyTier,
      score,
      distance: best,
      matchedFields: FIELD_ORDER.filter((field) => matchedFields.has(field)),
      referenceExcerpt: matchedFields.has("reference")
        ? excerptForQuery(referenceText ?? "", query, normalizedQuery, terms)
        : undefined,
    });
  }
  ranked.sort((a, b) => b.score - a.score || a.distance - b.distance || a.canonical.localeCompare(b.canonical));
  return ok({ hits: ranked.slice(0, limit), query });
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}

function scoreNameTarget(targetLower: string, normalizedQuery: string, terms: string[]): number {
  const target = normalizeSearchText(targetLower);
  let score = 0;
  if (target === normalizedQuery) score += 120;
  else if (target.includes(normalizedQuery) || normalizedQuery.includes(target)) score += 80;
  for (const term of terms) {
    if (target.includes(term)) score += FIELD_WEIGHTS.name;
  }
  return score;
}

function scoreTextField(
  field: Exclude<SearchField, "name">,
  text: string | undefined,
  normalizedQuery: string,
  terms: string[],
  matchedFields: Set<SearchField>,
): number {
  if (!text) return 0;
  const normalized = normalizeSearchText(text);
  if (!normalized) return 0;

  const weight = FIELD_WEIGHTS[field];
  let score = 0;
  let matched = false;
  if (normalized.includes(normalizedQuery)) {
    score += weight * (terms.length + 4);
    matched = true;
  }

  let termHits = 0;
  for (const term of terms) {
    if (normalized.includes(term)) termHits++;
  }
  if (termHits > 0) {
    score += weight * termHits;
    if (termHits === terms.length) score += weight * 2;
    matched = true;
  }

  if (matched) matchedFields.add(field);
  return score;
}

function formatForms(entry: CommandKnowledgeEntry): string {
  return (entry.forms ?? []).map((form) => [form.signature, form.description].filter(Boolean).join(" ")).join("\n");
}

function formatParameters(entry: CommandKnowledgeEntry): string {
  const parts: string[] = [];
  for (const form of entry.forms ?? []) {
    for (const parameter of form.parameters ?? []) {
      parts.push(
        [
          parameter.name,
          parameter.type,
          parameter.range,
          formatValueRange(parameter.valueRange),
          formatAcceptedValues(parameter.acceptedValues),
          parameter.description,
          parameter.required ? "required" : "optional",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
  }
  return parts.join("\n");
}

function formatValueRange(
  valueRange:
    | {
        min?: number;
        max?: number;
        unit?: string;
        boundaryBehavior?: string;
        evidenceLevel?: string;
        notes?: string;
      }
    | undefined,
): string | undefined {
  if (!valueRange) return undefined;
  return [
    valueRange.min !== undefined || valueRange.max !== undefined
      ? `min ${valueRange.min ?? "-inf"} max ${valueRange.max ?? "+inf"}`
      : undefined,
    valueRange.unit,
    valueRange.boundaryBehavior,
    valueRange.evidenceLevel,
    valueRange.notes,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatAcceptedValues(
  acceptedValues: Array<{ value: string | number | boolean; label?: string; description?: string }> | undefined,
): string | undefined {
  if (!acceptedValues?.length) return undefined;
  return acceptedValues
    .map((item) => [String(item.value), item.label, item.description].filter(Boolean).join(" "))
    .join(" ");
}

function tokenizeSearchText(text: string): string[] {
  return normalizeSearchText(text)
    .split(" ")
    .filter((term) => term.length >= 2);
}

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function excerptForQuery(text: string, rawQuery: string, normalizedQuery: string, terms: string[]): string | undefined {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;

  const compactLower = compact.toLowerCase();
  const needles = [
    rawQuery.trim().toLowerCase(),
    normalizedQuery,
    ...[...terms].sort((a, b) => b.length - a.length),
  ].filter(Boolean);
  const firstHit = needles.map((needle) => compactLower.indexOf(needle)).find((index) => index >= 0) ?? 0;
  const start = Math.max(0, firstHit - 80);
  const end = Math.min(compact.length, firstHit + 220);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < compact.length ? "..." : "";
  return `${prefix}${compact.slice(start, end)}${suffix}`;
}
