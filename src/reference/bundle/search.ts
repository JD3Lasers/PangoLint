import Fuse from "fuse.js";

import type { ReferenceCommand } from "./types";

export interface SearchIndex<T> {
  items: T[];
  fuse: Fuse<T>;
}

export interface SearchHit<T> {
  item: T;
  score: number;
}

export function buildIndex(commands: ReferenceCommand[]): SearchIndex<ReferenceCommand> {
  return {
    items: commands,
    fuse: new Fuse(commands, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.34,
      minMatchCharLength: 2,
      keys: [
        { name: "canonical", weight: 3 },
        { name: "aliases", weight: 2.5 },
        { name: "coverage.setsProperty", weight: 1.5 },
        { name: "description", weight: 1 },
        { name: "category", weight: 1 },
        { name: "tags", weight: 0.6 },
      ],
    }),
  };
}

export function search<T extends ReferenceCommand>(index: SearchIndex<T>, rawQuery: string): SearchHit<T>[] {
  const q = rawQuery.trim();
  if (!q) return index.items.map((item) => ({ item, score: 0 }));
  if (!compactSearchText(normalizeSearchText(q))) return [];

  const hits = new Map<T, number>();
  for (const item of index.items) {
    const score = scoreCommandSearchMatch(item, q);
    if (score !== null) hits.set(item, score);
  }
  for (const result of index.fuse.search(q)) {
    const score = 20 + (result.score ?? 1);
    hits.set(result.item, Math.min(hits.get(result.item) ?? Number.POSITIVE_INFINITY, score));
  }

  return [...hits.entries()]
    .sort(([a, aScore], [b, bScore]) => aScore - bScore || index.items.indexOf(a) - index.items.indexOf(b))
    .map(([item, score]) => ({ item, score }));
}

function scoreCommandSearchMatch(command: ReferenceCommand, query: string): number | null {
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

  for (const form of command.forms) {
    best = Math.min(best, scoreSearchTarget(form.signature, normalizedQuery, compactQuery, queryWords, 3));
    best = Math.min(best, scoreSearchTarget(form.description, normalizedQuery, compactQuery, queryWords, 4));
  }
  best = Math.min(
    best,
    scoreSearchTarget(command.coverage?.setsProperty?.join(" "), normalizedQuery, compactQuery, queryWords, 4),
  );
  best = Math.min(best, scoreSearchTarget(command.description, normalizedQuery, compactQuery, queryWords, 5));
  best = Math.min(best, scoreSearchTarget(command.category, normalizedQuery, compactQuery, queryWords, 6));
  best = Math.min(best, scoreSearchTarget(command.tags.join(" "), normalizedQuery, compactQuery, queryWords, 7));

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
