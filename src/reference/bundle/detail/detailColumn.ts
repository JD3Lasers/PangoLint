import { clear, el } from "../dom";
import { findObjectTreeReferenceDetail } from "../object-tree/objectTreeDetailReference";
import { getVisibleDetailSelection, hasVisibleDetailSelection, type ReferenceState } from "../state";
import type { ReferenceObjectProperty } from "../types";
import { renderCommandDetail } from "./commandDetail";
import { renderObjectDetail, renderObjectReferenceDetail } from "./objectDetail";
import { focusObjectProperty } from "./objectPropertyFocus";

export interface DetailColumnOptions {
  onBackToResults?: () => void;
}

export function renderDetailColumn(state: ReferenceState, options: DetailColumnOptions = {}): HTMLElement {
  const root = el("section", {
    className: "col col--detail",
    attrs: { "aria-live": "polite", "aria-label": "Detail" },
  });

  const objectIndex = buildObjectPropertyIndex(state);

  const render = (): void => {
    clear(root);
    const detailSelection = getVisibleDetailSelection(state);
    const selectedPropertyPath = detailSelection?.kind === "object" ? detailSelection.propertyPath : null;
    if (hasVisibleDetailSelection(state) && options.onBackToResults) {
      root.append(renderMobileBackButton(options.onBackToResults));
    }
    if (detailSelection?.kind === "object-reference") {
      const objectReference = findObjectTreeReferenceDetail(state, detailSelection.selection);
      root.append(
        objectReference
          ? renderObjectReferenceDetail(objectReference, state)
          : notFoundState(detailSelection.selection.id, "object"),
      );
    } else if (detailSelection?.kind === "object") {
      const obj = state.objectsByName.get(detailSelection.name);
      root.append(obj ? renderObjectDetail(obj, state) : notFoundState(detailSelection.name, "object"));
    } else if (detailSelection?.kind === "command") {
      const cmd = state.commandsByCanonical.get(detailSelection.canonical);
      root.append(
        cmd ? renderCommandDetail(cmd, objectIndex, state) : notFoundState(detailSelection.canonical, "command"),
      );
    } else {
      root.append(emptyState(state));
    }
    if (selectedPropertyPath) {
      requestAnimationFrame(() => focusObjectProperty(root, selectedPropertyPath));
    } else {
      root.scrollTop = 0;
    }
  };

  state.subscribe((change) => {
    if (change === "selection" || change === "mode" || change === "section") render();
  });
  render();

  return root;
}

function renderMobileBackButton(onBackToResults: () => void): HTMLElement {
  return el(
    "button",
    {
      className: "mobile-detail-back",
      attrs: { type: "button" },
      on: { click: onBackToResults },
    },
    "Back to results",
  );
}

function emptyState(state: ReferenceState): HTMLElement {
  if (state.viewMode === "objects") {
    return objectTreeEmptyState(state);
  }
  const total = state.catalog.meta.total;
  return el(
    "div",
    { className: "detail__empty" },
    el("p", { className: "detail__empty-title" }, `${total} PangoScript commands and expression functions`),
    el(
      "p",
      { className: "detail__empty-body" },
      "Pick a command on the left, or type in the search box to narrow the list. Click any property under “Sets property” on a command detail to jump to its object schema and see every related command.",
    ),
    el(
      "p",
      { className: "detail__empty-hint" },
      "Shortcuts: ",
      el("kbd", {}, "/"),
      " focuses search · ",
      el("kbd", {}, "Esc"),
      " clears filters",
    ),
  );
}

function objectTreeEmptyState(state: ReferenceState): HTMLElement {
  const objectCount = state.catalog.objects?.length ?? 0;
  const copy =
    state.objectSection === "cue-types"
      ? {
          title: "Cue Types",
          body: "Pick a cue type on the left to inspect its WS Object Tree paths here.",
        }
      : state.objectSection === "universe-components"
        ? {
            title: "Universe Components",
            body: "Pick a Universe component type on the left to inspect its Object Tree paths here.",
          }
        : state.objectSection === "fx"
          ? {
              title: "FX Effects",
              body: "Pick an FX effect on the left to inspect its FX Object Tree paths here.",
            }
          : {
              title: `${objectCount} Object Tree schemas`,
              body: "Pick an object schema on the left, or search by object and property name.",
            };
  return el(
    "div",
    { className: "detail__empty" },
    el("p", { className: "detail__empty-title" }, copy.title),
    el("p", { className: "detail__empty-body" }, copy.body),
    el(
      "p",
      { className: "detail__empty-hint" },
      "Shortcuts: ",
      el("kbd", {}, "/"),
      " focuses search, ",
      el("kbd", {}, "Esc"),
      " clears filters",
    ),
  );
}

function notFoundState(name: string, kind: "command" | "object"): HTMLElement {
  const noun = kind === "command" ? "Command" : "Object";
  return el(
    "div",
    { className: "detail__empty" },
    el("p", { className: "detail__empty-title" }, `${noun} not found`),
    el("p", { className: "detail__empty-body" }, `“${name}” is not in the bundled browsable catalog.`),
  );
}

function buildObjectPropertyIndex(state: ReferenceState): Map<string, ReferenceObjectProperty> {
  const index = new Map<string, ReferenceObjectProperty>();
  for (const obj of state.catalog.objects ?? []) {
    for (const prop of obj.properties ?? []) {
      index.set(prop.path, prop);
    }
  }
  return index;
}
