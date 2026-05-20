// Detail overlay panel. Slides in over the list when a command is
// selected. Carries the back button, the command's signature /
// parameters / example, and the action buttons that post messages back
// to the extension host.
//
// Sources and confidence are intentionally NOT rendered - they live in
// commands.overlay.json as maintainer-only metadata.

import type { CommandDetail, ParameterDetail } from "../../../model/types";
import { el, replaceChildren } from "./dom";
import type { SidebarState } from "./state";

export interface DetailOptions {
  onBack: () => void;
  onInsert: (canonical: string, snippet: string) => void;
  onCopy: (canonical: string, text: string) => void;
  onOpenReference: (canonical: string) => void;
}

export function renderDetail(state: SidebarState, options: DetailOptions): HTMLElement {
  const root = el("div", { className: "detail", role: "complementary" });

  const back = el(
    "button",
    {
      className: "detail__back",
      type: "button",
      title: "Back to command list",
      "aria-label": "Back to command list",
      on: { click: () => options.onBack() },
    },
    "← Back",
  );
  const header = el("div", { className: "detail__header" }, back);
  const body = el("div", { className: "detail__body" });
  root.appendChild(header);
  root.appendChild(body);

  function paint(): void {
    if (state.view.selectedCommand === null) {
      replaceChildren(body);
      return;
    }
    if (state.view.detailLoading) {
      replaceChildren(body, el("div", { className: "detail__loading" }, "Loading…"));
      return;
    }
    if (!state.view.detail) {
      replaceChildren(
        body,
        el("div", { className: "detail__empty" }, `No detail available for "${state.view.selectedCommand}".`),
      );
      return;
    }
    replaceChildren(body, ...renderDetailBody(state.view.detail, options));
  }
  paint();

  state.subscribe((change) => {
    if (change === "selection" || change === "detail") paint();
  });

  return root;
}

function renderDetailBody(detail: CommandDetail, options: DetailOptions): HTMLElement[] {
  const out: HTMLElement[] = [];

  // Title row: command name + tier + category.
  out.push(
    el(
      "div",
      { className: "detail__title" },
      el("h2", { className: "detail__name" }, detail.canonical),
      el("span", { className: "detail__category" }, detail.category),
    ),
  );

  if (detail.description) {
    out.push(el("p", { className: "detail__description" }, detail.description));
  }

  // Signatures (often just one, but commands like AddSms have several).
  for (const sig of detail.signatures.length > 0
    ? detail.signatures
    : [{ signature: detail.signature, parameters: [] }]) {
    out.push(
      el(
        "div",
        { className: "detail__signature-block" },
        el("h3", { className: "detail__h3" }, "Signature"),
        el("pre", { className: "detail__signature" }, el("code", {}, sig.signature)),
        sig.description ? el("p", { className: "detail__sig-desc" }, sig.description) : null,
        sig.parameters.length > 0 ? renderParameterTable(sig.parameters) : null,
      ),
    );
  }

  if (detail.setsProperty.length > 0) {
    const list = el("ul", { className: "detail__properties" });
    for (const path of detail.setsProperty) {
      list.appendChild(el("li", {}, el("code", { className: "detail__property" }, path)));
    }
    out.push(
      el("div", { className: "detail__properties-block" }, el("h3", { className: "detail__h3" }, "Writes"), list),
    );
  }

  // Example block (only show if it differs from the signature).
  if (detail.example && detail.example !== detail.signature) {
    out.push(
      el(
        "div",
        { className: "detail__example-block" },
        el("h3", { className: "detail__h3" }, "Example"),
        el("pre", { className: "detail__example" }, el("code", {}, detail.example)),
      ),
    );
  }

  if (detail.notes.length > 0) {
    const list = el("ul", { className: "detail__notes" });
    for (const note of detail.notes) {
      list.appendChild(el("li", {}, note.text));
    }
    out.push(el("div", { className: "detail__notes-block" }, el("h3", { className: "detail__h3" }, "Notes"), list));
  }

  if (detail.tags.length > 0) {
    const tagRow = el("div", { className: "detail__tags" });
    for (const tag of detail.tags) {
      tagRow.appendChild(el("span", { className: "detail__tag" }, tag));
    }
    out.push(tagRow);
  }

  // Action bar - the user-facing reason the panel exists. Posts to the
  // extension host which dispatches to the registered command IDs.
  out.push(
    el(
      "div",
      { className: "detail__actions" },
      el(
        "button",
        {
          className: "detail__action detail__action--primary",
          type: "button",
          on: { click: () => options.onInsert(detail.canonical, detail.example) },
        },
        "Insert at cursor",
      ),
      el(
        "button",
        {
          className: "detail__action",
          type: "button",
          on: {
            click: () => options.onCopy(detail.canonical, detail.signatures[0]?.signature ?? detail.signature),
          },
        },
        "Copy signature",
      ),
      el(
        "button",
        {
          className: "detail__action",
          type: "button",
          on: { click: () => options.onOpenReference(detail.canonical) },
        },
        "View in full reference",
      ),
    ),
  );

  return out;
}

function renderParameterTable(parameters: ParameterDetail[]): HTMLElement {
  const table = el("table", { className: "detail__parameters" });
  const thead = el(
    "thead",
    {},
    el(
      "tr",
      {},
      el("th", {}, "Name"),
      el("th", {}, "Type"),
      el("th", {}, "Required"),
      el("th", {}, "Range"),
      el("th", {}, "Description"),
    ),
  );
  table.appendChild(thead);
  const tbody = el("tbody", {});
  for (const param of parameters) {
    tbody.appendChild(
      el(
        "tr",
        {},
        el("td", { className: "detail__param-name" }, param.name),
        el("td", {}, param.type),
        el("td", {}, param.required ? "yes" : "no"),
        el("td", {}, formatParameterRange(param)),
        el("td", {}, param.description ?? ""),
      ),
    );
  }
  table.appendChild(tbody);
  return table;
}

function formatParameterRange(param: ParameterDetail): string {
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
  valueRange: NonNullable<ParameterDetail["valueRange"]>,
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

function formatAcceptedValue(value: NonNullable<ParameterDetail["acceptedValues"]>[number]): string {
  return value.label ? `${value.value}=${value.label}` : String(value.value);
}

function describeBoundaryBehavior(behavior: NonNullable<ParameterDetail["valueRange"]>["boundaryBehavior"]): string {
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
      return "unknown";
  }
}
