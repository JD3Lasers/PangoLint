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
import { ReferenceState, type StateChange } from "./state";
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
  layout.dataset.mobilePanel = "browse";
  const setMobilePanel = (panel: "browse" | "detail"): void => {
    layout.dataset.mobilePanel = panel;
  };
  const syncMobilePanel = (change: StateChange): void => {
    if (change === "filter") return;
    setMobilePanel(hasDetailSelection(state) ? "detail" : "browse");
  };
  window.addEventListener("reference:mobile-panel", (event) => {
    const panel = (event as CustomEvent<"browse" | "detail">).detail;
    if (panel === "browse" || panel === "detail") setMobilePanel(panel);
  });

  state.subscribe(syncMobilePanel);
  layout.append(
    renderNavColumn(state),
    renderListColumn(state),
    renderDetailColumn(state, {
      onBackToResults: () => setMobilePanel("browse"),
    }),
  );
  root.replaceChildren(layout);

  installRouter(state);
  installShortcuts(state);
}

function hasDetailSelection(state: ReferenceState): boolean {
  return Boolean(state.selectedCanonical || state.selectedObject || state.selectedObjectReference);
}

function installShortcuts(state: ReferenceState): void {
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const inField = tag === "input" || tag === "textarea" || tag === "select";

    // "/" → focus search (when not already typing)
    if (event.key === "/" && !inField) {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("reference:mobile-panel", { detail: "browse" }));
      requestAnimationFrame(() => {
        const search = document.querySelector<HTMLInputElement>(".toolbar__search");
        if (!search) return;
        search.focus();
        search.select();
      });
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
