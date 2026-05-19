import { el } from "../dom";
import type { ReferenceState } from "../state";
import type { ReferenceCommand, ReferenceForm, ReferenceObjectProperty, ReferenceParameter } from "../types";
import { renderCopyButton } from "./copyControls";
import { describeBoundaryBehavior, formatAcceptedValue } from "./objectPropertySummary";
import { renderOscRouteList } from "./oscRouteDetail";

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

export function renderCommandDetail(
  cmd: ReferenceCommand,
  objectIndex: Map<string, ReferenceObjectProperty>,
  state: ReferenceState,
): HTMLElement {
  const container = el("article", { className: "detail" });

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

  if (cmd.description) {
    container.append(el("p", { className: "detail__description" }, cmd.description));
  }

  if (cmd.forms.length > 0) {
    const section = el("section", { className: "detail__section" });
    section.append(el("h2", { className: "detail__h" }, cmd.forms.length === 1 ? "Signature" : "Signatures"));
    for (const form of cmd.forms) {
      section.append(renderForm(form));
    }
    container.append(section);
  }

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
