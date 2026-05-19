// Page state: view mode, search query, filters, current selection
// (command OR object), hash routing state. Listeners re-render when
// state changes.

import { buildIndex, type SearchHit, type SearchIndex, search } from "./search";
import type { ReferenceCatalog, ReferenceCommand, ReferenceObject } from "./types";

export type ViewMode = "commands" | "objects";
export type ObjectSection = "fx" | "cue-types" | "schemas";
export type ObjectReferenceSection = "fx" | "cue-types";

export interface ObjectReferenceSelection {
  section: ObjectReferenceSection;
  id: string;
}

export type VisibleDetailSelection =
  | { kind: "command"; canonical: string }
  | { kind: "object"; name: string; propertyPath: string | null }
  | { kind: "object-reference"; selection: ObjectReferenceSelection };

export interface FilterState {
  query: string;
  category: string | null;
}

export type StateChange = "filter" | "selection" | "mode" | "section";
export type StateListener = (change: StateChange) => void;

export class ReferenceState {
  readonly catalog: ReferenceCatalog;
  readonly index: SearchIndex<ReferenceCommand>;
  readonly commandsByCanonical: Map<string, ReferenceCommand>;
  readonly objectsByName: Map<string, ReferenceObject>;

  viewMode: ViewMode = "commands";
  filter: FilterState = { query: "", category: null };
  selectedCanonical: string | null = null;
  selectedObject: string | null = null;
  selectedObjectPropertyPath: string | null = null;
  selectedObjectReference: ObjectReferenceSelection | null = null;
  objectSection: ObjectSection = "schemas";

  private listeners = new Set<StateListener>();

  constructor(catalog: ReferenceCatalog) {
    this.catalog = catalog;
    this.index = buildIndex(catalog.commands);
    this.commandsByCanonical = new Map(catalog.commands.map((c) => [c.canonical, c]));
    this.objectsByName = new Map((catalog.objects ?? []).map((o) => [o.name, o]));
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(change: StateChange): void {
    for (const listener of this.listeners) listener(change);
  }

  private applyViewMode(mode: ViewMode): boolean {
    if (this.viewMode === mode) return false;
    this.viewMode = mode;
    // Mode flip clears the search and category filter (they're tied to
    // the previous mode's vocabulary).
    this.filter = { query: "", category: null };
    this.objectSection = "schemas";
    this.selectedObjectReference = null;
    return true;
  }

  /**
   * Switch top-level view mode. Each mode has its own search query so
   * a Commands search isn't accidentally consumed by an Objects list.
   * Selection is preserved across mode switches.
   */
  setViewMode(mode: ViewMode): void {
    if (!this.applyViewMode(mode)) return;
    this.emit("mode");
  }

  setQuery(query: string): void {
    if (this.filter.query === query) return;
    this.filter.query = query;
    this.emit("filter");
  }

  setCategory(category: string | null): void {
    if (this.filter.category === category) return;
    this.filter.category = category;
    this.emit("filter");
  }

  setObjectSection(section: ObjectSection): void {
    if (this.objectSection === section) return;
    this.objectSection = section;
    this.selectedObjectReference = null;
    this.selectedObject = null;
    this.selectedObjectPropertyPath = null;
    this.emit("section");
  }

  clearFilters(): void {
    this.filter = { query: "", category: null };
    this.emit("filter");
  }

  /**
   * Select a command. Switches viewMode to "commands" and clears any
   * object selection so cross-nav (e.g. from a related-commands chip
   * on an object page) lands the user in a consistent state.
   */
  select(canonical: string | null): void {
    const modeChange = canonical !== null && this.viewMode !== "commands";
    const same =
      this.selectedCanonical === canonical &&
      this.selectedObject === null &&
      this.selectedObjectReference === null &&
      !modeChange;
    if (same) return;
    if (modeChange) this.applyViewMode("commands");
    this.selectedCanonical = canonical;
    this.selectedObject = null;
    this.selectedObjectPropertyPath = null;
    this.selectedObjectReference = null;
    this.emit(modeChange ? "mode" : "selection");
  }

  /**
   * Select an object schema. Switches viewMode to "objects" and clears
   * any command selection. Use when cross-navigating from a command's
   * setsProperty chip.
   */
  selectObject(name: string | null, propertyPath: string | null = null): void {
    const modeChange = name !== null && this.viewMode !== "objects";
    const same =
      this.selectedObject === name &&
      this.selectedObjectPropertyPath === propertyPath &&
      this.selectedCanonical === null &&
      this.selectedObjectReference === null &&
      !modeChange;
    if (same) return;
    if (modeChange) this.applyViewMode("objects");
    this.selectedObject = name;
    this.selectedObjectPropertyPath = propertyPath;
    this.selectedCanonical = null;
    this.selectedObjectReference = null;
    this.emit(modeChange ? "mode" : "selection");
  }

  selectObjectReference(section: ObjectReferenceSection, id: string | null): void {
    const modeChange = id !== null && this.viewMode !== "objects";
    const sectionChange = this.objectSection !== section;
    const same =
      this.selectedObjectReference?.section === section &&
      this.selectedObjectReference.id === id &&
      this.selectedCanonical === null &&
      this.selectedObject === null &&
      this.selectedObjectPropertyPath === null &&
      !modeChange &&
      !sectionChange;
    if (same) return;
    if (modeChange) this.applyViewMode("objects");
    this.objectSection = section;
    this.selectedObjectReference = id ? { section, id } : null;
    this.selectedCanonical = null;
    this.selectedObject = null;
    this.selectedObjectPropertyPath = null;
    this.emit(modeChange ? "mode" : sectionChange ? "section" : "selection");
  }

  /** Filtered + ranked command list, applying every active filter. */
  filteredCommandHits(): SearchHit<ReferenceCommand>[] {
    const hits = search(this.index, this.filter.query);
    const cat = this.filter.category;
    return hits.filter((hit) => {
      if (cat && hit.item.category !== cat) return false;
      return true;
    });
  }

  /**
   * Filtered list of object schemas matching the current query. Search
   * is case-insensitive and matches the object name plus any property
   * name in its schema (so "BPM" finds Master, "RotoAngle" finds Master,
   * "Beam" finds itself + DefaultLayout if it has a Beam property).
   */
  filteredObjects(): ReferenceObject[] {
    const q = this.filter.query.trim().toLowerCase();
    const all = this.catalog.objects ?? [];
    if (!q) return [...all].sort((a, b) => a.name.localeCompare(b.name));
    return all
      .filter((obj) => {
        if (obj.name.toLowerCase().includes(q)) return true;
        return obj.properties.some((p) => p.property.toLowerCase().includes(q));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Back-compat alias retained for any older callers. */
  filteredHits(): SearchHit<ReferenceCommand>[] {
    return this.filteredCommandHits();
  }
}

export function getVisibleDetailSelection(state: ReferenceState): VisibleDetailSelection | null {
  if (state.viewMode === "commands") {
    return state.selectedCanonical ? { kind: "command", canonical: state.selectedCanonical } : null;
  }
  if (state.objectSection === "schemas") {
    return state.selectedObject
      ? { kind: "object", name: state.selectedObject, propertyPath: state.selectedObjectPropertyPath }
      : null;
  }
  return state.selectedObjectReference?.section === state.objectSection
    ? { kind: "object-reference", selection: state.selectedObjectReference }
    : null;
}

export function hasVisibleDetailSelection(state: ReferenceState): boolean {
  return getVisibleDetailSelection(state) !== null;
}
