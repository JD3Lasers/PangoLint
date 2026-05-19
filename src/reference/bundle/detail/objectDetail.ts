import { el } from "../dom";
import type { ObjectPropertyReferenceDetail } from "../objectTree";
import type { ReferenceState } from "../state";
import type { ReferenceObject, ReferenceObjectProperty } from "../types";
import { renderCopyableCode } from "./copyControls";
import {
  buildObjectValueCardSummaryParts,
  buildObjectValueSummaryParts,
  objectBehaviorSummaryParts,
  objectReadbackCardSummary,
  objectReadbackSummary,
} from "./objectPropertySummary";
import { renderObjectRouteSummary } from "./oscRouteDetail";

export type ObjectPropertyPathDisplayContext = "schema" | "fx-effect" | "universe-component";

export interface ObjectPropertyPathDisplay {
  primaryPath: string;
  secondaryLabel: string | null;
  secondaryPath: string | null;
}

export function objectPropertyPathDisplay(
  path: string,
  context: ObjectPropertyPathDisplayContext,
  pathDisplayPrefix?: string,
): ObjectPropertyPathDisplay {
  const quickFxCellPathPrefix = "FX.N.N.N.";
  if (context === "fx-effect" && path.startsWith(quickFxCellPathPrefix) && path.length > quickFxCellPathPrefix.length) {
    return {
      primaryPath: path.slice(quickFxCellPathPrefix.length),
      secondaryLabel: "QuickFX cell path",
      secondaryPath: path,
    };
  }
  if (
    context === "universe-component" &&
    pathDisplayPrefix &&
    path.startsWith(`${pathDisplayPrefix}.`) &&
    path.length > pathDisplayPrefix.length + 1
  ) {
    return {
      primaryPath: path.slice(pathDisplayPrefix.length + 1),
      secondaryLabel: "Object Tree path",
      secondaryPath: path,
    };
  }
  return { primaryPath: path, secondaryLabel: null, secondaryPath: null };
}

export function renderObjectDetail(obj: ReferenceObject, state: ReferenceState): HTMLElement {
  const container = el("article", { className: "detail" });

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

export function renderObjectReferenceDetail(detail: ObjectPropertyReferenceDetail, state: ReferenceState): HTMLElement {
  const container = el("article", { className: "detail" });

  const header = el("header", { className: "detail__header" });
  const titleRow = el("div", { className: "detail__title-row" });
  const title = el("h1", { className: "detail__title" }, detail.label);
  title.append(
    el("span", { className: "detail__kind" }, detail.detailKind ?? (detail.root === "WS" ? "cue type" : "FX effect")),
  );
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
      renderObjectPropertiesTable(
        sectionDetail.properties,
        state,
        null,
        detail.pathDisplayContext ?? (detail.root === "FX" ? "fx-effect" : "schema"),
        detail.pathDisplayPrefix,
      ),
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
  pathDisplayPrefix?: string,
): HTMLElement {
  const table = el("table", { className: "object__props" });
  const thead = el("thead", {});
  const headRow = el("tr", {});
  for (const heading of ["Property", "Behavior", "Value", "Format", "Set by"]) {
    headRow.append(el("th", {}, heading));
  }
  thead.append(headRow);
  table.append(thead);
  const tbody = el("tbody", {});
  for (const p of properties) {
    tbody.append(
      renderObjectPropertyTableRow(p, state, p.path === focusedPropertyPath, pathDisplayContext, pathDisplayPrefix),
    );
  }
  table.append(tbody);
  return el("div", { className: "object__props-scroll" }, table);
}

function renderObjectPropertyTableRow(
  p: ReferenceObjectProperty,
  state: ReferenceState,
  isFocusedProperty: boolean,
  pathDisplayContext: ObjectPropertyPathDisplayContext,
  pathDisplayPrefix?: string,
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
  const pathDisplay = objectPropertyPathDisplay(p.path, pathDisplayContext, pathDisplayPrefix);
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

  const classification = p.propertyCard?.classification ?? p.classification;
  const behaviorParts = objectBehaviorSummaryParts(classification);
  const behaviorCell = el("td", { className: "object__behavior", attrs: { "data-label": "Behavior" } });
  if (behaviorParts.length > 0) {
    for (const behaviorPart of behaviorParts) {
      behaviorCell.append(el("span", { className: "object__behavior-line" }, behaviorPart));
    }
  } else {
    behaviorCell.append(emptyObjectValue("object__value-empty"));
  }
  row.append(behaviorCell);

  const valueDisplayOptions = {
    hideUnknownBoundaryBehavior: classification?.accessMode === "read-only",
  };
  const valueDisplay =
    buildObjectValueCardSummaryParts(p.propertyCard?.valueSummary, valueDisplayOptions) ??
    buildObjectValueSummaryParts(p.valueMetadata, valueDisplayOptions);
  const readbackSummary =
    objectReadbackCardSummary(p.propertyCard?.readbackSummary) ?? objectReadbackSummary(p.readbackMetadata);
  const valueParts =
    valueDisplay && valueDisplay.valueParts.length > 0
      ? valueDisplay.valueParts
      : readbackSummary
        ? [readbackSummary]
        : [];
  const valueCell = el("td", { className: "object__value", attrs: { "data-label": "Value" } });
  if (valueParts.length > 0) {
    for (const valuePart of valueParts) {
      valueCell.append(el("span", { className: "object__value-line" }, valuePart));
    }
  } else {
    valueCell.append(emptyObjectValue("object__value-empty"));
  }
  row.append(valueCell);

  const formatCell = el("td", { className: "object__format", attrs: { "data-label": "Format" } });
  if (valueDisplay && valueDisplay.formatParts.length > 0) {
    formatCell.append(el("span", { className: "object__value-line" }, valueDisplay.formatParts.join("; ")));
  } else {
    formatCell.append(emptyObjectValue("object__value-empty"));
  }
  row.append(formatCell);

  const settersCell = el("td", { className: "object__setters-cell", attrs: { "data-label": "Set by" } });
  if (p.setters.length === 0) {
    settersCell.append(emptyObjectValue("object__setters-empty"));
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

function emptyObjectValue(className: string): HTMLElement {
  return el("span", { className }, String.fromCharCode(0x2014));
}
