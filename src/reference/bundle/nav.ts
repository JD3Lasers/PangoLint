// Left column: top-level mode toggle (Commands | Object Tree), the rest
// of the rail adapts to the active mode. In Commands mode the body is
// a Categories filter list. In Object Tree mode it shows object-focused
// reference sections.

import { clear, el } from "./dom";
import { buildCueTypeReference, buildFxEffectReference } from "./objectTree";
import type { ObjectSection, ReferenceState } from "./state";

export function renderNavColumn(state: ReferenceState): HTMLElement {
  const root = el("aside", { className: "col col--nav", attrs: { "aria-label": "Navigation" } });

  // Mode toggle: Commands | Object Tree
  const toggle = el("div", {
    className: "mode-toggle",
    attrs: { role: "tablist", "aria-label": "View mode" },
  });
  const commandsBtn = el(
    "button",
    {
      className: "mode-toggle__btn",
      attrs: { type: "button", role: "tab" },
      on: {
        click: () => {
          state.setViewMode("commands");
          showBrowsePanelOnNarrow();
        },
      },
    },
    el("span", { className: "mode-toggle__label" }, "Commands"),
    el("span", { className: "mode-toggle__count" }, String(state.catalog.commands.length)),
  );
  const objectsBtn = el(
    "button",
    {
      className: "mode-toggle__btn",
      attrs: { type: "button", role: "tab" },
      on: {
        click: () => {
          state.setViewMode("objects");
          showBrowsePanelOnNarrow();
        },
      },
    },
    el("span", { className: "mode-toggle__label" }, "Object Tree"),
    el("span", { className: "mode-toggle__count" }, String(state.catalog.objects?.length ?? 0)),
  );
  toggle.append(commandsBtn, objectsBtn);
  root.append(toggle);

  const refreshToggle = (): void => {
    commandsBtn.classList.toggle("is-active", state.viewMode === "commands");
    commandsBtn.setAttribute("aria-selected", state.viewMode === "commands" ? "true" : "false");
    objectsBtn.classList.toggle("is-active", state.viewMode === "objects");
    objectsBtn.setAttribute("aria-selected", state.viewMode === "objects" ? "true" : "false");
  };
  refreshToggle();

  // Body: categories list in commands mode, object sections in Object Tree mode.
  const body = el("div", { className: "nav__body" });
  root.append(body);

  const renderCategories = (): void => {
    clear(body);
    if (state.viewMode !== "commands") {
      body.append(
        el(
          "div",
          { className: "nav__heading" },
          el("span", {}, "Object Tree"),
          el("span", { className: "nav__heading-count" }, "3"),
        ),
      );
      const cueTypes = buildCueTypeReference(state.catalog.objects ?? []);
      const fxEffects = buildFxEffectReference(state.catalog.objects ?? []);
      const sections: Array<{ label: string; section: ObjectSection; count: number }> = [
        { label: "Schemas", section: "schemas", count: state.catalog.objects?.length ?? 0 },
        { label: "Cue Types", section: "cue-types", count: cueTypes.typeCount },
        { label: "FX Effects", section: "fx", count: fxEffects.effectCount },
      ];
      const ul = el("ul", { className: "nav__list", attrs: { role: "list" } });
      for (const { label, section, count } of sections) {
        const btn = el(
          "button",
          {
            className: state.objectSection === section ? "nav__btn is-active" : "nav__btn",
            attrs: { type: "button" },
            on: { click: () => state.setObjectSection(section) },
          },
          el("span", { className: "nav__btn-name" }, label),
          el("span", { className: "nav__btn-count" }, String(count)),
        );
        ul.append(el("li", { className: "nav__item" }, btn));
      }
      body.append(ul);
      return;
    }
    const heading = el(
      "div",
      { className: "nav__heading" },
      el("span", {}, "Categories"),
      el("span", { className: "nav__heading-count" }, String(state.catalog.meta.categories.length + 1)),
    );
    body.append(heading);

    const list = el("ul", { className: "nav__list", attrs: { role: "list" } });

    const all = el(
      "li",
      { className: "nav__item" },
      el(
        "button",
        {
          className: state.filter.category === null ? "nav__btn is-active" : "nav__btn",
          attrs: { type: "button" },
          on: { click: () => state.setCategory(null) },
        },
        el("span", { className: "nav__btn-name" }, "All categories"),
        el("span", { className: "nav__btn-count" }, String(state.catalog.meta.total)),
      ),
    );
    list.append(all);

    for (const cat of state.catalog.meta.categories) {
      const item = el(
        "li",
        { className: "nav__item" },
        el(
          "button",
          {
            className: state.filter.category === cat.name ? "nav__btn is-active" : "nav__btn",
            attrs: { type: "button", title: cat.name },
            on: { click: () => state.setCategory(cat.name) },
          },
          el("span", { className: "nav__btn-name" }, cat.name),
          el("span", { className: "nav__btn-count" }, String(cat.count)),
        ),
      );
      list.append(item);
    }

    body.append(list);
  };

  // Wire updates
  state.subscribe((change) => {
    if (change === "mode" || change === "section") {
      refreshToggle();
      renderCategories();
    }
    if (change === "filter" && state.viewMode === "commands") renderCategories();
  });
  renderCategories();

  return root;
}

function showBrowsePanelOnNarrow(): void {
  if (window.innerWidth > 880) return;
  window.dispatchEvent(new CustomEvent("reference:mobile-panel", { detail: "browse" }));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
