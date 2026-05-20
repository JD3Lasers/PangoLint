// Webview state store. Keeps the catalog, the current filter, the
// derived (filtered + grouped) list, and the selected command. Emits a
// "change" event when anything updates so renderers can re-draw.
//
// Filtering and scoring run locally - the host pushed the full catalog
// in the init message, so the webview can answer keystroke-by-keystroke
// search without round-tripping to the extension.

import type { CommandDetail, CommandSummary } from "../../../model/types";
import type { CommandGroup, InitPayload } from "../messages";

type NormalizedCatalog = Required<InitPayload>;

export interface FilterState {
  query: string;
}

export interface ViewModel {
  /** When non-null, the detail panel is open for this command. */
  selectedCommand: string | null;
  /**
   * Pending detail fetch - present while the host is resolving the
   * detail message. The webview can show a loading state while waiting.
   */
  detailLoading: boolean;
  /** Most recent detail payload, or null if none has arrived yet. */
  detail: CommandDetail | null;
  /** Most recent action result, displayed as a transient toast. */
  toast: { kind: "ok" | "warn"; message: string } | null;
}

const SEARCH_RESULTS_GROUP = "Search results";

export type StateChange = "init" | "filter" | "selection" | "detail" | "toast" | "expand";

export type StateListener = (change: StateChange) => void;

export class SidebarState {
  private listeners = new Set<StateListener>();
  private catalog: NormalizedCatalog | null = null;

  filter: FilterState = { query: "" };
  expandedCategories: Set<string> = new Set();
  view: ViewModel = {
    selectedCommand: null,
    detailLoading: false,
    detail: null,
    toast: null,
  };

  /** Cached filtered list - recomputed on filter or catalog change. */
  private filteredList: CommandSummary[] = [];
  /** Cached grouped list - always computed. */
  private filteredGroups: CommandGroup[] = [];

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: StateChange): void {
    for (const listener of this.listeners) listener(change);
  }

  setCatalog(payload: Partial<InitPayload> | null | undefined): void {
    this.catalog = normalizeCatalog(payload);
    this.recomputeList();
    this.emit("init");
  }

  getCatalog(): NormalizedCatalog | null {
    return this.catalog;
  }

  setQuery(query: string): void {
    if (query === this.filter.query) return;
    this.filter.query = query;
    this.recomputeList();
    this.emit("filter");
  }

  clearFilter(): void {
    this.filter.query = "";
    this.recomputeList();
    this.emit("filter");
  }

  toggleCategoryExpanded(name: string): void {
    if (this.expandedCategories.has(name)) {
      this.expandedCategories.delete(name);
    } else {
      this.expandedCategories.add(name);
    }
    this.emit("expand");
  }

  expandAllCategories(): void {
    for (const { category } of this.filteredGroups) this.expandedCategories.add(category);
    this.emit("expand");
  }

  collapseAllCategories(): void {
    this.expandedCategories.clear();
    this.emit("expand");
  }

  allCategoriesExpanded(): boolean {
    if (this.filteredGroups.length === 0) return false;
    return this.filteredGroups.every(({ category }) => this.expandedCategories.has(category));
  }

  selectCommand(canonical: string | null): void {
    if (canonical === this.view.selectedCommand) return;
    this.view.selectedCommand = canonical;
    this.view.detail = null;
    this.view.detailLoading = canonical !== null;
    this.emit("selection");
  }

  setDetail(canonical: string, detail: CommandDetail | undefined): void {
    if (this.view.selectedCommand !== canonical) return; // stale response
    this.view.detail = detail ?? null;
    this.view.detailLoading = false;
    this.emit("detail");
  }

  setToast(kind: "ok" | "warn", message: string): void {
    this.view.toast = { kind, message };
    this.emit("toast");
  }

  clearToast(): void {
    if (!this.view.toast) return;
    this.view.toast = null;
    this.emit("toast");
  }

  /** Flat filtered list - used for status bar count. */
  list(): CommandSummary[] {
    return this.filteredList;
  }

  /** Grouped filtered list - always populated. */
  groups(): CommandGroup[] {
    return this.filteredGroups;
  }

  private recomputeList(): void {
    if (!this.catalog) {
      this.filteredList = [];
      this.filteredGroups = [];
      return;
    }
    const filtered = applyFilter(this.catalog.commands, this.filter);
    this.filteredList = filtered;
    this.filteredGroups = this.filter.query.trim()
      ? [{ category: SEARCH_RESULTS_GROUP, commands: filtered }]
      : groupByCategory(filtered, this.catalog.categoryOrder ?? {});
  }
}

function normalizeCatalog(payload: Partial<InitPayload> | null | undefined): NormalizedCatalog {
  return {
    commands: Array.isArray(payload?.commands) ? payload.commands : [],
    categories: Array.isArray(payload?.categories) ? payload.categories : [],
    categoryOrder: isCategoryOrder(payload?.categoryOrder) ? payload.categoryOrder : {},
  };
}

function isCategoryOrder(value: unknown): value is Record<string, number> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// ============================================================
// Filtering + scoring (mirrors src/sidebar/model/catalog.ts logic
// but keeps it local so the webview doesn't need a node-side bundle).
// ============================================================

function applyFilter(commands: CommandSummary[], filter: FilterState): CommandSummary[] {
  const query = filter.query.trim().toLowerCase();

  const filtered = commands
    .map((command, index) => ({
      command,
      index,
      score: query ? scoreMatch(command, query) : 0,
    }))
    .filter(({ score }) => !query || score !== null);

  if (!query) return filtered.map((wrapped) => wrapped.command);

  return filtered
    .sort((a, b) => (a.score ?? Number.POSITIVE_INFINITY) - (b.score ?? Number.POSITIVE_INFINITY) || a.index - b.index)
    .map((wrapped) => wrapped.command);
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

function groupByCategory(commands: CommandSummary[], categoryOrder: Record<string, number> = {}): CommandGroup[] {
  const groups = new Map<string, CommandSummary[]>();
  for (const command of commands) {
    const list = groups.get(command.category);
    if (list) list.push(command);
    else groups.set(command.category, [command]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const oa = categoryOrder[a] ?? Number.MAX_SAFE_INTEGER;
      const ob = categoryOrder[b] ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.localeCompare(b);
    })
    .map(([category, list]) => ({ category, commands: list }));
}
