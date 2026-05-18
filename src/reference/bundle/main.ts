// Entry point for the PangoScript reference page bundle.
//
// The build script (scripts/buildReferenceSite.ts) inlines the catalog
// as a <script type="application/json" id="reference-catalog"> block,
// then loads the compiled bundle as a deferred ES module. This file
// reads the catalog, instantiates state, installs the router, and
// renders the 3-column layout.

import { renderDetailColumn } from "./detail";
import { renderListColumn } from "./list";
import { renderNavColumn } from "./nav";
import { installRouter } from "./router";
import { ReferenceState } from "./state";
import type { ReferenceCatalog } from "./types";

function readCatalog(): ReferenceCatalog {
  const node = document.getElementById("reference-catalog");
  if (!node) throw new Error("reference-catalog inline data block missing");
  const raw = node.textContent ?? "{}";
  return JSON.parse(raw) as ReferenceCatalog;
}

function mount(): void {
  const root = document.getElementById("reference-root");
  if (!root) throw new Error("#reference-root missing");

  const catalog = readCatalog();
  const state = new ReferenceState(catalog);

  const layout = document.createElement("div");
  layout.className = "layout";
  layout.append(renderNavColumn(state), renderListColumn(state), renderDetailColumn(state));
  root.replaceChildren(layout);

  installRouter(state);
  installShortcuts(state);
}

function installShortcuts(state: ReferenceState): void {
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const inField = tag === "input" || tag === "textarea" || tag === "select";

    // "/" → focus search (when not already typing)
    if (event.key === "/" && !inField) {
      const search = document.querySelector<HTMLInputElement>(".toolbar__search");
      if (search) {
        event.preventDefault();
        search.focus();
        search.select();
      }
      return;
    }
    // Escape → clear when in search; otherwise clear filters
    if (event.key === "Escape") {
      if (inField && tag === "input") {
        (target as HTMLInputElement).value = "";
        (target as HTMLInputElement).dispatchEvent(new Event("input"));
        return;
      }
      state.clearFilters();
      return;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
