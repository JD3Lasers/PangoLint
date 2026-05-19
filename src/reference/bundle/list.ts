// Middle column: filter toolbar + scrollable list. Renders either
// commands or object schemas depending on state.viewMode.

import { clear, debounce, el, highlight } from "./dom";
import {
  buildCueTypeReference,
  buildFxEffectReference,
  filterObjectReferenceRows,
  type ObjectPropertyReferenceDetail,
  type ObjectPropertyReferenceRow,
} from "./objectTree";
import { formatSafetyTextForReference, formatSafetyTierLabel } from "./safetyTierDisplay";
import type { ObjectReferenceSection, ReferenceState } from "./state";
import type { ReferenceCommand, ReferenceObject } from "./types";

const SEARCH_DEBOUNCE_MS = 60;

export interface CommandListSection {
  category: string | null;
  commands: ReferenceCommand[];
}

export function renderListColumn(state: ReferenceState): HTMLElement {
  const root = el("div", { className: "col col--list" });

  // ── Toolbar ────────────────────────────────────────────────────
  const toolbar = el("div", { className: "toolbar" });
  const search = el("input", {
    className: "toolbar__search",
    attrs: {
      type: "search",
      placeholder: "Search…",
      "aria-label": "Search",
      autocomplete: "off",
      spellcheck: false,
    },
  });
  const onInput = debounce((value: string) => state.setQuery(value), SEARCH_DEBOUNCE_MS);
  search.addEventListener("input", () => onInput(search.value));
  toolbar.append(search);

  const clearBtn = el(
    "button",
    {
      className: "toolbar__clear",
      attrs: { type: "button", title: "Clear all filters" },
      on: {
        click: () => {
          search.value = "";
          state.clearFilters();
        },
      },
    },
    "Clear",
  );
  toolbar.append(clearBtn);

  const counter = el("div", { className: "toolbar__counter", attrs: { "aria-live": "polite" } });
  toolbar.append(counter);

  root.append(toolbar);

  // ── Active-filter pills ────────────────────────────────────────
  const pillsRow = el("div", { className: "active-pills", attrs: { "aria-label": "Active filters" } });
  root.append(pillsRow);

  // ── Result list ────────────────────────────────────────────────
  const listBox = el("div", { className: "list" });
  root.append(listBox);

  const renderObjectReferenceRows = (
    rows: ObjectPropertyReferenceRow[],
    details: ObjectPropertyReferenceDetail[],
    section: ObjectReferenceSection,
    emptyText: string,
    noMatchText: string,
  ): void => {
    const query = state.filter.query.trim();
    const filtered = filterObjectReferenceRows(rows, details, query);
    counter.textContent = query
      ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}`
      : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`;
    if (!rows.length) {
      listBox.append(emptyMessage(emptyText));
      return;
    }
    if (!filtered.length) {
      listBox.append(emptyMessage(noMatchText));
      return;
    }
    const ul = el("ul", { className: "list__items", attrs: { role: "list" } });
    for (const row of filtered) ul.append(renderObjectReferenceRow(row, section, state, query));
    listBox.append(ul);
    requestAnimationFrame(() => highlightObjectReferenceSelection(listBox, state.selectedObjectReference));
  };

  const renderFxSection = (): void => {
    const reference = buildFxEffectReference(state.catalog.objects ?? []);
    renderObjectReferenceRows(
      reference.rows,
      reference.details,
      "fx",
      "No FX Effects data in this catalog.",
      "No FX Effects match this query.",
    );
  };

  const renderCueTypesSection = (): void => {
    const reference = buildCueTypeReference(state.catalog.objects ?? []);
    renderObjectReferenceRows(
      reference.rows,
      reference.details,
      "cue-types",
      "No Cue Types data in this catalog.",
      "No Cue Types match this query.",
    );
  };

  const refreshToolbarChrome = (): void => {
    const isCommands = state.viewMode === "commands";
    search.placeholder = isCommands
      ? "Search commands, aliases, descriptions…"
      : "Search object schemas + property names…";
    if (search.value !== state.filter.query) search.value = state.filter.query;
    const hasFilters = Boolean(state.filter.query || (isCommands && state.filter.category));
    clearBtn.hidden = !hasFilters;
    clearBtn.disabled = !hasFilters;
  };

  const renderPills = (): void => {
    clear(pillsRow);
    const f = state.filter;
    const isCommands = state.viewMode === "commands";
    const hasAny = Boolean(f.query || (isCommands && f.category));
    if (!hasAny) {
      pillsRow.hidden = true;
      return;
    }
    pillsRow.hidden = false;
    if (f.query) {
      pillsRow.append(
        makePill(`"${f.query}"`, "search", () => {
          search.value = "";
          state.setQuery("");
        }),
      );
    }
    if (isCommands && f.category) {
      pillsRow.append(makePill(f.category, "category", () => state.setCategory(null)));
    }
  };

  const renderCommands = (): void => {
    const hits = state.filteredCommandHits();
    counter.textContent = `${hits.length} of ${state.catalog.commands.length}`;

    if (hits.length === 0) {
      listBox.append(emptyMessage("No matches. Try a shorter search, or clear filters."));
      return;
    }

    const query = state.filter.query.trim();
    const sections = buildCommandListSections(
      hits.map((h) => h.item),
      state.catalog.meta.categories.map((c) => c.name),
      query,
    );
    for (const section of sections) {
      if (section.category) listBox.append(groupHeading(section.category, section.commands.length));
      const ul = el("ul", { className: "list__items", attrs: { role: "list" } });
      for (const cmd of section.commands) ul.append(renderCommandRow(cmd, state, query));
      listBox.append(ul);
    }

    if (state.selectedCanonical) {
      requestAnimationFrame(() => highlightCommandSelection(listBox, state.selectedCanonical));
    }
  };

  const renderObjects = (): void => {
    const matches = state.filteredObjects();
    counter.textContent = `${matches.length} of ${state.catalog.objects?.length ?? 0}`;

    if (matches.length === 0) {
      listBox.append(emptyMessage("No object schemas match this query."));
      return;
    }

    const query = state.filter.query.trim();
    const ul = el("ul", { className: "list__items", attrs: { role: "list" } });
    for (const obj of matches) ul.append(renderObjectRow(obj, state, query));
    listBox.append(ul);

    if (state.selectedObject) {
      requestAnimationFrame(() =>
        highlightObjectSelection(listBox, state.selectedObject, state.selectedObjectPropertyPath),
      );
    }
  };

  const render = (): void => {
    refreshToolbarChrome();
    renderPills();
    clear(listBox);
    if (state.viewMode === "commands") {
      renderCommands();
    } else {
      switch (state.objectSection) {
        case "fx":
          renderFxSection();
          break;
        case "cue-types":
          renderCueTypesSection();
          break;
        default:
          renderObjects();
      }
    }
  };

  state.subscribe((change) => {
    if (change === "filter" || change === "mode" || change === "section") render();
    if (change === "selection") {
      if (state.viewMode === "commands") {
        highlightCommandSelection(listBox, state.selectedCanonical);
      } else if (state.objectSection === "fx" || state.objectSection === "cue-types") {
        highlightObjectReferenceSelection(listBox, state.selectedObjectReference);
      } else {
        highlightObjectSelection(listBox, state.selectedObject, state.selectedObjectPropertyPath);
      }
    }
  });
  render();

  return root;
}

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

function makePill(label: string, kind: string, onDismiss: () => void): HTMLElement {
  return el(
    "button",
    {
      className: `pill pill--${kind}`,
      attrs: {
        type: "button",
        title: `Remove ${kind} filter`,
        "aria-label": `Remove ${kind} filter`,
      },
      on: { click: onDismiss },
    },
    el("span", { className: "pill__label" }, label),
    el("span", { className: "pill__dismiss", attrs: { "aria-hidden": "true" } }, "×"),
  );
}

function emptyMessage(text: string): HTMLElement {
  return el("div", { className: "list__empty" }, text);
}

function groupHeading(name: string, count: number, description?: string): HTMLElement {
  const label = el("span", { className: "list__group-name" }, name);
  if (description) {
    label.append(el("span", { className: "list__group-desc" }, description));
  }
  return el(
    "div",
    { className: "list__group-heading", attrs: { role: "heading", "aria-level": "3" } },
    label,
    el("span", { className: "list__group-count" }, String(count)),
  );
}

function renderCommandRow(cmd: ReferenceCommand, state: ReferenceState, query: string): HTMLElement {
  const li = el("li", {
    className: "list__row",
    attrs: {
      role: "button",
      tabindex: "0",
      "data-canonical": cmd.canonical,
      "aria-selected": cmd.canonical === state.selectedCanonical ? "true" : "false",
    },
  });
  if (cmd.canonical === state.selectedCanonical) li.classList.add("is-selected");

  const name = el("div", { className: "list__name" });
  name.append(highlight(cmd.canonical, query));
  if (cmd.kind === "function") {
    name.append(el("span", { className: "list__kind-chip" }, "function"));
  }
  li.append(name);

  if (cmd.description) {
    const desc = el("div", { className: "list__desc" });
    desc.append(highlight(truncate(formatSafetyTextForReference(cmd.description), 140), query));
    li.append(desc);
  }

  const meta = el("div", { className: "list__meta" });
  const safetyLabel = formatSafetyTierLabel(cmd.safetyTier);
  if (safetyLabel) {
    meta.append(
      el("span", { className: `badge badge--tier badge--tier-${cmd.safetyTier.toLowerCase()}` }, safetyLabel),
    );
  }
  li.append(meta);

  const onSelect = () => {
    state.select(cmd.canonical);
    scrollToDetailOnNarrow();
  };
  li.addEventListener("click", onSelect);
  li.addEventListener("keydown", (event) => {
    const ev = event as KeyboardEvent;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelect();
    }
  });
  return li;
}

function renderObjectRow(obj: ReferenceObject, state: ReferenceState, query: string): HTMLElement {
  const li = el("li", {
    className: "list__row",
    attrs: {
      role: "button",
      tabindex: "0",
      "data-object": obj.name,
      "aria-selected": obj.name === state.selectedObject ? "true" : "false",
    },
  });
  if (obj.name === state.selectedObject) li.classList.add("is-selected");

  const name = el("div", { className: "list__name" });
  name.append(highlight(obj.name, query));
  li.append(name);

  const meta = el("div", { className: "list__meta" });
  meta.append(
    el(
      "span",
      { className: "badge badge--neutral" },
      `${obj.propertyCount} ${obj.propertyCount === 1 ? "property" : "properties"}`,
    ),
  );
  if (obj.isArray) {
    meta.append(el("span", { className: "badge badge--neutral" }, "Indexed"));
  }
  li.append(meta);

  // When the query matches property names (not just the object name),
  // show a tiny "match in N properties" hint so the user knows why
  // this object surfaced.
  if (query) {
    const q = query.toLowerCase();
    if (!obj.name.toLowerCase().includes(q)) {
      const matchedProps = obj.properties.filter((p) => p.property.toLowerCase().includes(q)).map((p) => p.property);
      if (matchedProps.length > 0) {
        const hint = el("div", { className: "list__desc" });
        hint.append(`Matches: ${matchedProps.slice(0, 4).join(", ")}`);
        if (matchedProps.length > 4) hint.append(`, +${matchedProps.length - 4} more`);
        li.append(hint);
      }
    }
  }

  const onSelect = () => {
    state.selectObject(obj.name);
    scrollToDetailOnNarrow();
  };
  li.addEventListener("click", onSelect);
  li.addEventListener("keydown", (event) => {
    const ev = event as KeyboardEvent;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelect();
    }
  });
  return li;
}

function renderObjectReferenceRow(
  row: ObjectPropertyReferenceRow,
  section: ObjectReferenceSection,
  state: ReferenceState,
  query: string,
): HTMLElement {
  const selected = state.selectedObjectReference?.section === section && state.selectedObjectReference.id === row.id;
  const li = el("li", {
    className: "list__row",
    attrs: {
      role: "button",
      tabindex: "0",
      "data-object-reference-section": section,
      "data-object-reference-id": row.id,
      "aria-selected": selected ? "true" : "false",
    },
  });
  if (selected) li.classList.add("is-selected");

  const name = el("div", { className: "list__name" });
  name.append(highlight(row.label, query));
  li.append(name);

  if (row.description) {
    const desc = el("div", { className: "list__desc" });
    desc.append(highlight(row.description, query));
    li.append(desc);
  }

  const meta = el("div", { className: "list__meta" });
  meta.append(
    el(
      "span",
      { className: "badge badge--neutral" },
      `${row.propertyCount} ${row.propertyCount === 1 ? "property" : "properties"}`,
    ),
  );
  li.append(meta);

  const onSelect = () => {
    state.selectObjectReference(section, row.id);
    scrollToDetailOnNarrow();
  };
  li.addEventListener("click", onSelect);
  li.addEventListener("keydown", (event) => {
    const ev = event as KeyboardEvent;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelect();
    }
  });
  return li;
}

export function buildCommandListSections(
  commands: ReferenceCommand[],
  categoryOrder: string[],
  query: string,
): CommandListSection[] {
  if (query.trim()) return [{ category: null, commands }];

  const buckets = new Map<string, ReferenceCommand[]>();
  for (const cmd of commands) {
    const bucket = buckets.get(cmd.category) ?? [];
    bucket.push(cmd);
    buckets.set(cmd.category, bucket);
  }
  const orderIndex = new Map(categoryOrder.map((c, i) => [c, i]));
  const sorted: CommandListSection[] = [];
  for (const [category, list] of buckets.entries()) {
    list.sort((a, b) => a.canonical.localeCompare(b.canonical));
    sorted.push({ category, commands: list });
  }
  sorted.sort((a, b) => {
    const ai = orderIndex.get(a.category ?? "") ?? Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.get(b.category ?? "") ?? Number.MAX_SAFE_INTEGER;
    return ai - bi || (a.category ?? "").localeCompare(b.category ?? "");
  });
  return sorted;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > max - 20 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

function highlightCommandSelection(listBox: HTMLElement, canonical: string | null): void {
  for (const node of listBox.querySelectorAll(".list__row.is-selected")) {
    node.classList.remove("is-selected");
    node.setAttribute("aria-selected", "false");
  }
  if (!canonical) return;
  const next = listBox.querySelector<HTMLElement>(`.list__row[data-canonical="${cssEscape(canonical)}"]`);
  if (next) {
    next.classList.add("is-selected");
    next.setAttribute("aria-selected", "true");
    next.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function highlightObjectSelection(listBox: HTMLElement, name: string | null, propertyPath: string | null = null): void {
  for (const node of listBox.querySelectorAll(".list__row.is-selected")) {
    node.classList.remove("is-selected");
    node.setAttribute("aria-selected", "false");
  }
  const next = objectSelectionSelectors(name, propertyPath)
    .map((selector) => listBox.querySelector<HTMLElement>(selector))
    .find((node): node is HTMLElement => node !== null);
  if (next) {
    next.classList.add("is-selected");
    next.setAttribute("aria-selected", "true");
    next.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

export function objectSelectionSelectors(name: string | null, propertyPath: string | null = null): string[] {
  if (!name) return [];
  const objectSelector = `.list__row[data-object="${cssEscape(name)}"]`;
  return propertyPath
    ? [`.list__row[data-property-path="${cssEscape(propertyPath)}"]`, objectSelector]
    : [objectSelector];
}

function highlightObjectReferenceSelection(
  listBox: HTMLElement,
  selection: ReferenceState["selectedObjectReference"],
): void {
  for (const node of listBox.querySelectorAll(".list__row.is-selected")) {
    node.classList.remove("is-selected");
    node.setAttribute("aria-selected", "false");
  }
  if (!selection) return;
  const next = listBox.querySelector<HTMLElement>(
    `.list__row[data-object-reference-section="${cssEscape(selection.section)}"][data-object-reference-id="${cssEscape(
      selection.id,
    )}"]`,
  );
  if (next) {
    next.classList.add("is-selected");
    next.setAttribute("aria-selected", "true");
    next.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\\n]/g, "\\$&");
}

/**
 * On narrow viewports the layout shows one panel at a time. Move to the
 * detail panel after a selection so the result is immediately readable.
 */
function scrollToDetailOnNarrow(): void {
  if (window.innerWidth > 880) return;
  requestAnimationFrame(() => {
    window.dispatchEvent(new CustomEvent("reference:mobile-panel", { detail: "detail" }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
