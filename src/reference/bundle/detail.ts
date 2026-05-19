// Right column: detail pane. Renders either a command detail or an
// object schema detail depending on which is selected. Provides
// click-to-copy on signature blocks and click-through navigation from
// setsProperty chips.

import { clear, el } from "./dom";
import { buildCueTypeReference, buildFxEffectReference, type ObjectPropertyReferenceDetail } from "./objectTree";
import {
  getVisibleDetailSelection,
  hasVisibleDetailSelection,
  type ObjectReferenceSelection,
  type ReferenceState,
} from "./state";
import type {
  ReferenceCommand,
  ReferenceForm,
  ReferenceObject,
  ReferenceObjectProperty,
  ReferenceOscRoute,
  ReferenceParameter,
} from "./types";

export function hasAnyMeaningfulParam(params: ReferenceParameter[]): boolean {
  return params.some(
    (p) =>
      p.type !== "unknown" ||
      Boolean(p.description) ||
      p.range !== undefined ||
      p.valueRange !== undefined ||
      (p.acceptedValues !== undefined && p.acceptedValues.length > 0),
  );
}

export type ObjectPropertyPathDisplayContext = "schema" | "fx-effect";

export interface ObjectPropertyPathDisplay {
  primaryPath: string;
  secondaryLabel: string | null;
  secondaryPath: string | null;
}

export function objectPropertyPathDisplay(
  path: string,
  context: ObjectPropertyPathDisplayContext,
): ObjectPropertyPathDisplay {
  const quickFxCellPathPrefix = "FX.N.N.N.";
  if (context === "fx-effect" && path.startsWith(quickFxCellPathPrefix) && path.length > quickFxCellPathPrefix.length) {
    return {
      primaryPath: path.slice(quickFxCellPathPrefix.length),
      secondaryLabel: "QuickFX cell path",
      secondaryPath: path,
    };
  }
  return { primaryPath: path, secondaryLabel: null, secondaryPath: null };
}

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
      const objectReference = findObjectReferenceDetail(state, detailSelection.selection);
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

// ─────────────────────────────────────────────────────────────────
//  Empty / not-found states
// ─────────────────────────────────────────────────────────────────

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

function findObjectReferenceDetail(
  state: ReferenceState,
  selection: ObjectReferenceSelection,
): ObjectPropertyReferenceDetail | null {
  const reference =
    selection.section === "cue-types"
      ? buildCueTypeReference(state.catalog.objects ?? [])
      : buildFxEffectReference(state.catalog.objects ?? []);
  return reference.details.find((detail) => detail.id === selection.id) ?? null;
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

// ─────────────────────────────────────────────────────────────────
//  Command detail
// ─────────────────────────────────────────────────────────────────

function renderCommandDetail(
  cmd: ReferenceCommand,
  objectIndex: Map<string, ReferenceObjectProperty>,
  state: ReferenceState,
): HTMLElement {
  const container = el("article", { className: "detail" });

  // Header
  const header = el("header", { className: "detail__header" });
  const titleRow = el("div", { className: "detail__title-row" });
  const title = el("h1", { className: "detail__title" }, cmd.canonical);
  if (cmd.kind === "function") {
    title.append(el("span", { className: "detail__kind" }, "expression function"));
  }
  titleRow.append(title);
  header.append(titleRow);

  const chips = el("div", { className: "detail__chips" });
  chips.append(el("span", { className: "badge badge--category" }, cmd.category));
  if (cmd.safetyTier && cmd.safetyTier !== "unknown") {
    chips.append(
      el(
        "span",
        { className: `badge badge--tier badge--tier-${cmd.safetyTier.toLowerCase()}` },
        `Safety ${cmd.safetyTier}`,
      ),
    );
  }
  header.append(chips);

  if (cmd.aliases.length > 0) {
    const aliasLine = el("div", { className: "detail__aliases" });
    aliasLine.append(el("span", { className: "detail__aliases-label" }, "Aliases"));
    aliasLine.append(el("span", { className: "detail__aliases-value" }, cmd.aliases.join(" · ")));
    header.append(aliasLine);
  }

  container.append(header);

  // Description
  if (cmd.description) {
    container.append(el("p", { className: "detail__description" }, cmd.description));
  }

  // Signature forms
  if (cmd.forms.length > 0) {
    const section = el("section", { className: "detail__section" });
    section.append(el("h2", { className: "detail__h" }, cmd.forms.length === 1 ? "Signature" : "Signatures"));
    for (const form of cmd.forms) {
      section.append(renderForm(form));
    }
    container.append(section);
  }

  // Sets property (clickable chips → object schema page)
  if (cmd.coverage?.setsProperty && cmd.coverage.setsProperty.length > 0) {
    const section = el("section", { className: "detail__section" });
    section.append(el("h2", { className: "detail__h" }, "Sets property"));
    const list = el("ul", { className: "detail__sets-list" });
    for (const path of cmd.coverage.setsProperty) {
      const propInfo = objectIndex.get(path);
      const root = path.split(".")[0] ?? "";
      const objExists = state.objectsByName.has(root);
      const button = el(
        "button",
        {
          className: objExists ? "detail__sets-item is-link" : "detail__sets-item",
          attrs: {
            type: "button",
            "data-root": root,
            title: objExists ? `Jump to ${root} schema` : undefined,
          },
          on: objExists ? { click: () => state.selectObject(root, path) } : {},
        },
        el("code", { className: "detail__sets-path" }, path),
      );
      if (propInfo?.osc) {
        button.append(el("span", { className: "detail__sets-osc", attrs: { title: "OSC address" } }, propInfo.osc));
      }
      list.append(el("li", {}, button));
    }
    section.append(list);
    container.append(section);
  }

  if (cmd.oscRoutes?.length) {
    const section = el("section", { className: "detail__section" });
    section.append(el("h2", { className: "detail__h" }, "OSC routes"));
    section.append(renderOscRouteList(cmd.oscRoutes));
    container.append(section);
  }

  // Notes
  if (cmd.notes.length > 0) {
    const section = el("section", { className: "detail__section" });
    section.append(el("h2", { className: "detail__h" }, "Notes"));
    const ul = el("ul", { className: "detail__notes-list" });
    for (const note of cmd.notes) {
      ul.append(el("li", { className: "detail__notes-item" }, note));
    }
    section.append(ul);
    container.append(section);
  }

  // Tags
  if (cmd.tags.length > 0) {
    const section = el("section", { className: "detail__section detail__section--tags" });
    section.append(el("h2", { className: "detail__h detail__h--inline" }, "Tags"));
    const wrap = el("span", { className: "detail__tags" });
    for (const tag of cmd.tags) {
      wrap.append(el("span", { className: "tag-chip" }, tag));
    }
    section.append(wrap);
    container.append(section);
  }

  // Related commands (reverse from setsProperty index)
  const related = findRelatedCommands(cmd, objectIndex, state);
  if (related.length > 0) {
    const section = el("section", { className: "detail__section" });
    section.append(el("h2", { className: "detail__h" }, "Related commands"));
    section.append(el("p", { className: "detail__related-hint" }, "Other commands that touch the same properties:"));
    const wrap = el("div", { className: "detail__related" });
    for (const other of related) {
      wrap.append(
        el(
          "button",
          {
            className: "related-chip",
            attrs: { type: "button" },
            on: { click: () => state.select(other) },
          },
          other,
        ),
      );
    }
    section.append(wrap);
    container.append(section);
  }

  return container;
}

function renderForm(form: ReferenceForm): HTMLElement {
  const block = el("div", { className: "form" });
  const sigWrap = el("div", { className: "form__signature" });
  const code = el("code", {}, form.signature);
  sigWrap.append(code);
  sigWrap.append(renderCopyButton(form.signature, "Copy signature"));
  block.append(sigWrap);

  if (form.description) {
    block.append(el("p", { className: "form__description" }, form.description));
  }
  if (form.parameters.length > 0 && hasAnyMeaningfulParam(form.parameters)) {
    const table = el("table", { className: "form__params" });
    const thead = el("thead", {});
    const headRow = el("tr", {});
    for (const heading of ["Name", "Type", "Req", "Range", "Description"]) {
      headRow.append(el("th", {}, heading));
    }
    thead.append(headRow);
    table.append(thead);
    const tbody = el("tbody", {});
    for (const p of form.parameters) {
      const row = el("tr", {});
      row.append(el("td", { attrs: { "data-label": "Name" } }, el("code", {}, p.name)));
      row.append(el("td", { attrs: { "data-label": "Type" } }, p.type ?? "—"));
      row.append(el("td", { attrs: { "data-label": "Req" } }, p.required ? "✓" : ""));
      row.append(el("td", { attrs: { "data-label": "Range" } }, formatParameterRange(p)));
      row.append(
        el("td", { className: "form__params-desc", attrs: { "data-label": "Description" } }, p.description ?? ""),
      );
      tbody.append(row);
    }
    table.append(tbody);
    block.append(table);
  }
  return block;
}

function formatParameterRange(param: ReferenceForm["parameters"][number]): string {
  const parts: string[] = [];
  if (param.range) parts.push(param.range);
  const valueRange = param.valueRange;
  if (valueRange) {
    const structured = [
      formatValueRangeBounds(valueRange, param.range),
      valueRange.unit,
      valueRange.boundaryBehavior ? `${describeBoundaryBehavior(valueRange.boundaryBehavior)} outside range` : null,
    ].filter((part): part is string => Boolean(part));
    if (structured.length > 0) parts.push(structured.join("; "));
  }
  const values = param.acceptedValues?.map(formatAcceptedValue) ?? [];
  if (values.length > 0) parts.push(values.join(", "));
  return parts.join(" · ");
}

function formatValueRangeBounds(
  valueRange: NonNullable<ReferenceForm["parameters"][number]["valueRange"]>,
  legacyRange: string | undefined,
): string | null {
  const { min, max } = valueRange;
  if (min === undefined && max === undefined) return null;
  let bounds: string;
  if (min !== undefined && max !== undefined) {
    bounds =
      valueRange.minInclusive === false || valueRange.maxInclusive === false
        ? `${valueRange.minInclusive === false ? ">" : ">="} ${min} and ${
            valueRange.maxInclusive === false ? "<" : "<="
          } ${max}`
        : `${min}..${max}`;
  } else if (min !== undefined) {
    bounds = `${valueRange.minInclusive === false ? ">" : ">="} ${min}`;
  } else {
    bounds = `${valueRange.maxInclusive === false ? "<" : "<="} ${max}`;
  }
  return bounds === legacyRange ? null : bounds;
}

function formatAcceptedValue(
  value: NonNullable<ReferenceForm["parameters"][number]["acceptedValues"]>[number],
): string {
  return value.label ? `${value.value}=${value.label}` : String(value.value);
}

function describeBoundaryBehavior(
  behavior: NonNullable<ReferenceForm["parameters"][number]["valueRange"]>["boundaryBehavior"],
): string {
  switch (behavior) {
    case "clamp":
      return "clamps";
    case "no-op":
      return "no-ops";
    case "pass-through":
      return "passes through";
    case "reject":
      return "rejects";
    case "wrap":
      return "wraps";
    default:
      return "unknown behavior";
  }
}

// ─────────────────────────────────────────────────────────────────
//  Object detail
// ─────────────────────────────────────────────────────────────────

function renderObjectDetail(obj: ReferenceObject, state: ReferenceState): HTMLElement {
  const container = el("article", { className: "detail" });

  // Header
  const header = el("header", { className: "detail__header" });
  const titleRow = el("div", { className: "detail__title-row" });
  const title = el("h1", { className: "detail__title" }, obj.name);
  title.append(el("span", { className: "detail__kind" }, "object schema"));
  titleRow.append(title);
  header.append(titleRow);

  const chips = el("div", { className: "detail__chips" });
  chips.append(
    el(
      "span",
      { className: "badge badge--category" },
      `${obj.propertyCount} ${obj.propertyCount === 1 ? "property" : "properties"}`,
    ),
  );
  if (obj.isArray) {
    chips.append(el("span", { className: "badge badge--neutral" }, "Indexed (array)"));
  }
  if (obj.inheritsFrom) {
    chips.append(el("span", { className: "badge badge--neutral" }, `Inherits ${obj.inheritsFrom}`));
  }
  header.append(chips);

  if (obj.arrayIndices && obj.arrayIndices.length > 0 && obj.arrayIndices.length <= 32) {
    const aliasLine = el("div", { className: "detail__aliases" });
    aliasLine.append(el("span", { className: "detail__aliases-label" }, "Indices"));
    aliasLine.append(el("span", { className: "detail__aliases-value" }, obj.arrayIndices.join(" · ")));
    header.append(aliasLine);
  }

  container.append(header);

  // Properties table
  if (obj.properties.length === 0) {
    container.append(el("p", { className: "detail__description" }, "No properties indexed yet for this schema."));
    return container;
  }

  const section = el("section", { className: "detail__section" });
  section.append(el("h2", { className: "detail__h" }, "Properties"));
  section.append(renderObjectPropertiesTable(obj.properties, state, state.selectedObjectPropertyPath));
  container.append(section);

  return container;
}

function renderObjectReferenceDetail(detail: ObjectPropertyReferenceDetail, state: ReferenceState): HTMLElement {
  const container = el("article", { className: "detail" });

  const header = el("header", { className: "detail__header" });
  const titleRow = el("div", { className: "detail__title-row" });
  const title = el("h1", { className: "detail__title" }, detail.label);
  title.append(el("span", { className: "detail__kind" }, detail.root === "WS" ? "cue type" : "FX effect"));
  titleRow.append(title);
  header.append(titleRow);

  const chips = el("div", { className: "detail__chips" });
  chips.append(
    el(
      "span",
      { className: "badge badge--category" },
      `${detail.propertyCount} ${detail.propertyCount === 1 ? "property" : "properties"}`,
    ),
  );
  chips.append(el("span", { className: "badge badge--neutral" }, `${detail.root} Object Tree paths`));
  header.append(chips);

  if (detail.description) {
    header.append(el("p", { className: "detail__description" }, detail.description));
  }
  container.append(header);

  for (const sectionDetail of detail.sections) {
    const section = el("section", { className: "detail__section" });
    section.append(el("h2", { className: "detail__h" }, sectionDetail.label));
    if (sectionDetail.description) {
      section.append(el("p", { className: "detail__description" }, sectionDetail.description));
    }
    section.append(
      renderObjectPropertiesTable(sectionDetail.properties, state, null, detail.root === "FX" ? "fx-effect" : "schema"),
    );
    container.append(section);
  }

  return container;
}

function renderObjectPropertiesTable(
  properties: ReferenceObjectProperty[],
  state: ReferenceState,
  focusedPropertyPath: string | null,
  pathDisplayContext: ObjectPropertyPathDisplayContext = "schema",
): HTMLElement {
  const table = el("table", { className: "object__props" });
  const thead = el("thead", {});
  const headRow = el("tr", {});
  for (const heading of ["Property", "Behavior", "Value", "Set by"]) {
    headRow.append(el("th", {}, heading));
  }
  thead.append(headRow);
  table.append(thead);
  const tbody = el("tbody", {});
  for (const p of properties) {
    tbody.append(renderObjectPropertyTableRow(p, state, p.path === focusedPropertyPath, pathDisplayContext));
  }
  table.append(tbody);
  return el("div", { className: "object__props-scroll" }, table);
}

function renderObjectPropertyTableRow(
  p: ReferenceObjectProperty,
  state: ReferenceState,
  isFocusedProperty: boolean,
  pathDisplayContext: ObjectPropertyPathDisplayContext,
): HTMLElement {
  const row = el("tr", {
    className: `object__prop-row${isFocusedProperty ? " is-focused" : ""}`,
    attrs: {
      "data-property-path": p.path,
      tabindex: "-1",
      "aria-current": isFocusedProperty ? "true" : undefined,
    },
  });

  const pathCell = el("td", { className: "object__prop-cell", attrs: { "data-label": "Property" } });
  const pathDisplay = objectPropertyPathDisplay(p.path, pathDisplayContext);
  pathCell.append(el("code", {}, pathDisplay.primaryPath));
  if (pathDisplay.secondaryPath) {
    const pathLine = el("div", { className: "object__path-secondary" });
    if (pathDisplay.secondaryLabel) {
      pathLine.append(el("span", { className: "object__path-secondary-label" }, `${pathDisplay.secondaryLabel}: `));
    }
    pathLine.append(renderCopyableCode(pathDisplay.secondaryPath));
    pathCell.append(pathLine);
  }
  if (p.osc) {
    const oscLine = el("div", { className: "object__osc" });
    oscLine.append(renderCopyableCode(p.osc));
    pathCell.append(oscLine);
  }
  if (p.oscRoutes?.length) {
    pathCell.append(renderObjectRouteSummary(p.oscRoutes));
  }
  row.append(pathCell);

  const behaviorSummary = objectBehaviorSummary(p.propertyCard?.classification ?? p.classification);
  const behaviorCell = el("td", { className: "object__behavior", attrs: { "data-label": "Behavior" } });
  if (behaviorSummary) {
    behaviorCell.append(el("span", { className: "object__value-line" }, behaviorSummary));
  } else {
    behaviorCell.append(el("span", { className: "object__value-empty" }, "—"));
  }
  row.append(behaviorCell);

  const valueSummary =
    buildObjectValueCardSummaryText(p.propertyCard?.valueSummary) ??
    objectReadbackCardSummary(p.propertyCard?.readbackSummary) ??
    buildObjectValueSummaryText(p.valueMetadata) ??
    objectReadbackSummary(p.readbackMetadata);
  const valueCell = el("td", { className: "object__value", attrs: { "data-label": "Value" } });
  if (valueSummary) {
    valueCell.append(el("span", { className: "object__value-line" }, valueSummary));
  } else {
    valueCell.append(el("span", { className: "object__value-empty" }, "—"));
  }
  row.append(valueCell);

  const settersCell = el("td", { className: "object__setters-cell", attrs: { "data-label": "Set by" } });
  if (p.setters.length === 0) {
    settersCell.append(el("span", { className: "object__setters-empty" }, "—"));
  } else {
    const chipsWrap = el("div", { className: "object__setters" });
    for (const setter of p.setters) {
      const chip = el(
        "button",
        {
          className: "related-chip object__setter-chip",
          attrs: { type: "button" },
          on: { click: () => state.select(setter) },
        },
        setter,
      );
      chipsWrap.append(chip);
    }
    settersCell.append(chipsWrap);
  }
  row.append(settersCell);
  return row;
}

function renderOscRouteList(routes: ReferenceOscRoute[]): HTMLElement {
  const list = el("ul", { className: "detail__routes-list" });
  for (const route of routes) {
    const item = el("li", { className: "detail__routes-item" });
    const header = el("div", { className: "detail__route-main" });
    header.append(el("code", { className: "detail__route-path" }, formatOscRouteSignature(route)));
    header.append(renderCopyButton(route.pathPattern, "Copy OSC route"));
    item.append(header);

    const transform = route.valueTransform ? valueTransformLabel(route.valueTransform) : null;
    if (transform) {
      item.append(el("p", { className: "detail__route-targets" }, `Transform ${transform}`));
    }

    const targets = route.normalizedTargetPropertyPatterns ?? route.targetPropertyPatterns;
    if (targets?.length) {
      item.append(el("p", { className: "detail__route-targets" }, `Targets ${targets.join(", ")}`));
    }
    list.append(item);
  }
  return list;
}

function renderObjectRouteSummary(routes: ReferenceOscRoute[]): HTMLElement {
  const wrap = el("div", { className: "object__routes" });
  wrap.append(el("span", { className: "object__routes-label" }, "OSC routes"));
  const visibleRoutes = routes.slice(0, 4);
  for (const route of visibleRoutes) {
    const routeLine = el("span", { className: "object__route" });
    routeLine.append(el("code", {}, formatOscRouteSignature(route)));
    const transform = route.valueTransform ? valueTransformLabel(route.valueTransform) : null;
    if (transform) {
      routeLine.append(el("span", { className: "object__route-meta" }, transform));
    }
    wrap.append(routeLine);
  }
  const hiddenCount = routes.length - visibleRoutes.length;
  if (hiddenCount > 0) {
    wrap.append(el("span", { className: "object__route-more" }, `${hiddenCount} more routes`));
  }
  return wrap;
}

function formatOscRouteSignature(route: ReferenceOscRoute): string {
  const args = route.args.length ? route.args.join(", ") : "no args";
  return `${route.pathPattern} (${args})`;
}

export function valueTransformLabel(transform: NonNullable<ReferenceOscRoute["valueTransform"]>): string {
  switch (transform.kind) {
    case "arrayOffset":
      return transform.offset === undefined ? "array offset" : `array offset ${signedNumber(transform.offset)}`;
    case "directChannelIndex":
      return "direct channel index";
    case "divide":
      return transform.factor === undefined ? "divide" : `divide by ${transform.factor}`;
    case "multiply":
      return transform.factor === undefined ? "multiply" : `multiply by ${transform.factor}`;
    case "offset":
      return transform.amount === undefined ? "offset" : `offset ${signedNumber(transform.amount)}`;
    case "subtract":
      return transform.amount === undefined ? "subtract" : `subtract ${transform.amount}`;
    default:
      return transform.kind
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replaceAll("-", " ")
        .toLowerCase();
  }
}

function signedNumber(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

// ─────────────────────────────────────────────────────────────────
//  Object value summary
// ─────────────────────────────────────────────────────────────────

/**
 * Compact single-line summary of a property's value metadata.
 * Intentionally excludes notes, probe contexts, and per-context ranges
 * to keep the reference table readable.
 */
export function buildObjectValueSummaryText(metadata: ReferenceObjectProperty["valueMetadata"]): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  appendDistinctSummaryPart(parts, metadata.valueType);
  if (metadata.valueRange) {
    const bounds = objectValueRangeBounds(metadata.valueRange);
    appendDistinctSummaryPart(parts, bounds);
    appendDistinctSummaryPart(parts, metadata.valueRange.unit);
    if (metadata.valueRange.boundaryBehavior) {
      appendDistinctSummaryPart(
        parts,
        `${describeBoundaryBehavior(metadata.valueRange.boundaryBehavior)} outside range`,
      );
    }
  } else if (metadata.unit) {
    appendDistinctSummaryPart(parts, metadata.unit);
  }
  if (metadata.defaultValue !== undefined) appendDistinctSummaryPart(parts, `default ${String(metadata.defaultValue)}`);
  if (metadata.acceptedValues?.length) {
    appendDistinctSummaryPart(parts, metadata.acceptedValues.map(formatAcceptedValue).join(", "));
  }
  if (metadata.locationContext?.populationDependent) appendDistinctSummaryPart(parts, "location-aware");
  return parts.length > 0 ? parts.join("; ") : null;
}

export function buildObjectValueCardSummaryText(
  summary: NonNullable<ReferenceObjectProperty["propertyCard"]>["valueSummary"] | undefined,
): string | null {
  if (!summary) return null;
  const parts: string[] = [];
  appendDistinctSummaryPart(parts, summary.valueType);
  if (summary.range) {
    const bounds = objectValueCardRangeBounds(summary.range);
    appendDistinctSummaryPart(parts, bounds);
    appendDistinctSummaryPart(parts, summary.range.unit);
    if (summary.range.boundaryBehavior) {
      appendDistinctSummaryPart(parts, `${describeBoundaryBehavior(summary.range.boundaryBehavior)} outside range`);
    }
  } else if (summary.unit) {
    appendDistinctSummaryPart(parts, summary.unit);
  }
  if (summary.defaultValue !== undefined) appendDistinctSummaryPart(parts, `default ${String(summary.defaultValue)}`);
  if (summary.acceptedValueCount) appendDistinctSummaryPart(parts, `${summary.acceptedValueCount} accepted values`);
  if (summary.locationKind)
    appendDistinctSummaryPart(parts, behaviorLabel(summary.locationKind) ?? summary.locationKind);
  return parts.length > 0 ? parts.join("; ") : null;
}

function appendDistinctSummaryPart(parts: string[], part: string | undefined | null): void {
  if (!part) return;
  const normalized = part.trim().toLowerCase();
  if (parts.some((existing) => existing.trim().toLowerCase() === normalized)) return;
  parts.push(part);
}

function objectReadbackSummary(metadata: ReferenceObjectProperty["readbackMetadata"]): string | null {
  if (!metadata) return null;
  const parts = ["readback"];
  if (metadata.valueType) parts.push(metadata.valueType);
  if (metadata.observedValue !== undefined) parts.push(`observed ${String(metadata.observedValue)}`);
  if (metadata.locationContext?.populationDependent) parts.push("location-aware");
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectReadbackCardSummary(
  summary: NonNullable<ReferenceObjectProperty["propertyCard"]>["readbackSummary"] | undefined,
): string | null {
  if (!summary) return null;
  if (!summary.valueType && summary.observedValue === undefined && !summary.locationKind) return null;
  const parts = [summary.status === "readable" ? "readback" : (behaviorLabel(summary.status) ?? summary.status)];
  if (summary.valueType) parts.push(summary.valueType);
  if (summary.observedValue !== undefined) parts.push(`observed ${String(summary.observedValue)}`);
  if (summary.locationKind) parts.push(behaviorLabel(summary.locationKind) ?? summary.locationKind);
  return parts.length > 0 ? parts.join("; ") : null;
}

export function objectBehaviorSummary(classification: ReferenceObjectProperty["classification"]): string | null {
  if (!classification) return null;
  const parts = [behaviorLabel(classification.accessMode), behaviorLabel(classification.behaviorKind)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join("; ") : null;
}

function behaviorLabel(value: string | undefined): string | undefined {
  return value?.replaceAll("-", " ");
}

function objectValueRangeBounds(
  range: NonNullable<ReferenceObjectProperty["valueMetadata"]>["valueRange"],
): string | null {
  if (!range) return null;
  const { min, max, dynamicMax } = range;
  const dynamicMaxExpression = dynamicMax?.expression;
  if (min === undefined && max === undefined && !dynamicMaxExpression) return null;
  if (min !== undefined && dynamicMaxExpression) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
    }
    return `${min}..${dynamicMaxExpression}`;
  }
  if (min !== undefined && max !== undefined) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${max}`;
    }
    return `${min}..${max}`;
  }
  if (min !== undefined) return `${range.minInclusive === false ? ">" : ">="} ${min}`;
  if (dynamicMaxExpression) return `${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
  if (max !== undefined) return `${range.maxInclusive === false ? "<" : "<="} ${max}`;
  return null;
}

function objectValueCardRangeBounds(
  range: NonNullable<NonNullable<ReferenceObjectProperty["propertyCard"]>["valueSummary"]>["range"],
): string | null {
  if (!range) return null;
  const { min, max, dynamicMaxExpression } = range;
  if (min === undefined && max === undefined && !dynamicMaxExpression) return null;
  if (min !== undefined && dynamicMaxExpression) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
    }
    return `${min}..${dynamicMaxExpression}`;
  }
  if (min !== undefined && max !== undefined) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${range.maxInclusive === false ? "<" : "<="} ${max}`;
    }
    return `${min}..${max}`;
  }
  if (min !== undefined) return `${range.minInclusive === false ? ">" : ">="} ${min}`;
  if (dynamicMaxExpression) return `${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
  if (max !== undefined) return `${range.maxInclusive === false ? "<" : "<="} ${max}`;
  return null;
}

// ─────────────────────────────────────────────────────────────────
//  Reusable bits
// ─────────────────────────────────────────────────────────────────

function renderCopyButton(text: string, label: string): HTMLElement {
  const btn = el(
    "button",
    {
      className: "copy-btn",
      attrs: { type: "button", title: label, "aria-label": label },
      on: {
        click: async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const ok = await copyText(text);
          flashCopyFeedback(btn, ok);
        },
      },
    },
    el("span", { className: "copy-btn__icon", attrs: { "aria-hidden": "true" } }, "⧉"),
    el("span", { className: "copy-btn__label" }, "Copy"),
  );
  return btn;
}

function renderCopyableCode(text: string): HTMLElement {
  const wrap = el("span", { className: "copyable" });
  wrap.append(el("code", {}, text));
  const btn = el(
    "button",
    {
      className: "copy-btn copy-btn--inline",
      attrs: { type: "button", title: "Copy", "aria-label": "Copy" },
      on: {
        click: async (event) => {
          event.preventDefault();
          const ok = await copyText(text);
          flashCopyFeedback(btn, ok);
        },
      },
    },
    el("span", { className: "copy-btn__icon", attrs: { "aria-hidden": "true" } }, "⧉"),
  );
  wrap.append(btn);
  return wrap;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

function flashCopyFeedback(btn: HTMLElement, ok: boolean, successLabel = "Copied"): void {
  const label = btn.querySelector(".copy-btn__label");
  const original = label?.textContent ?? "";
  if (label) label.textContent = ok ? successLabel : "Copy failed";
  btn.classList.toggle("is-success", ok);
  btn.classList.toggle("is-error", !ok);
  window.setTimeout(() => {
    if (label && original) label.textContent = original;
    btn.classList.remove("is-success", "is-error");
  }, 1400);
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

function findRelatedCommands(
  cmd: ReferenceCommand,
  objectIndex: Map<string, ReferenceObjectProperty>,
  state: ReferenceState,
): string[] {
  if (!cmd.coverage?.setsProperty || cmd.coverage.setsProperty.length === 0) return [];
  const found = new Set<string>();
  for (const path of cmd.coverage.setsProperty) {
    const info = objectIndex.get(path);
    if (!info) continue;
    for (const setter of info.setters) {
      if (setter !== cmd.canonical && state.commandsByCanonical.has(setter)) {
        found.add(setter);
      }
    }
  }
  return [...found].sort().slice(0, 24);
}

function focusObjectProperty(root: HTMLElement, propertyPath: string): void {
  for (const row of root.querySelectorAll(".object__prop-row.is-focused")) {
    row.classList.remove("is-focused");
    row.removeAttribute("aria-current");
  }
  const next = root.querySelector<HTMLElement>(`.object__prop-row[data-property-path="${cssEscape(propertyPath)}"]`);
  if (!next) {
    root.scrollTop = 0;
    return;
  }
  next.classList.add("is-focused");
  next.setAttribute("aria-current", "true");
  next.scrollIntoView({ block: "center", behavior: "smooth" });
  next.focus({ preventScroll: true });
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\\n]/g, "\\$&");
}
