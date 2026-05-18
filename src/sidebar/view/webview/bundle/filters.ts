// Filter toolbar. Renders the search input, an expand/collapse-all
// button, and a Clear button. Category filtering is handled by the
// collapsible group headers in the list itself.

import { debounce, el } from "./dom";
import type { SidebarState } from "./state";

const SEARCH_DEBOUNCE_MS = 60;

export function renderFilters(state: SidebarState): HTMLElement {
  const root = el("div", { className: "filters" });

  const searchInput = el("input", {
    className: "filters__search",
    type: "search",
    placeholder: "Filter by name, alias, or description…",
    "aria-label": "Filter commands",
  }) as HTMLInputElement;

  const debouncedSetQuery = debounce((value: string) => state.setQuery(value), SEARCH_DEBOUNCE_MS);
  searchInput.addEventListener("input", () => debouncedSetQuery(searchInput.value));

  const expandBtn = el(
    "button",
    {
      className: "filters__expand-all",
      type: "button",
      on: {
        click: () => {
          if (state.allCategoriesExpanded()) {
            state.collapseAllCategories();
          } else {
            state.expandAllCategories();
          }
        },
      },
    },
    "Expand All",
  );

  const clearButton = el(
    "button",
    {
      className: "filters__clear",
      type: "button",
      title: "Clear search",
      on: {
        click: () => {
          searchInput.value = "";
          state.clearFilter();
        },
      },
    },
    "Clear",
  );

  root.appendChild(el("div", { className: "filters__row filters__row--top" }, searchInput));
  root.appendChild(el("div", { className: "filters__row filters__row--bottom" }, expandBtn, clearButton));

  state.subscribe((change) => {
    if (change !== "filter" && change !== "init" && change !== "expand") return;
    if (searchInput.value !== state.filter.query) searchInput.value = state.filter.query;
    expandBtn.textContent = state.allCategoriesExpanded() ? "Collapse All" : "Expand All";
  });

  return root;
}
