import { cssEscape, el, highlight } from "../dom";
import { emptyListMessage, listGroupHeading } from "../listElements";
import type { ObjectReferenceSection, ObjectSection, ReferenceState } from "../state";
import { filterObjectReferenceRows } from "./objectTreeSearch";
import type { ObjectPropertyReferenceDetail, ObjectPropertyReferenceRow } from "./objectTreeTypes";

export interface ObjectTreeReferenceListOptions {
  rows: ObjectPropertyReferenceRow[];
  details: ObjectPropertyReferenceDetail[];
  section: ObjectReferenceSection;
  state: ReferenceState;
  query: string;
  listBox: HTMLElement;
  counter: HTMLElement;
  emptyText: string;
  noMatchText: string;
  afterSelect?: () => void;
}

export function renderObjectTreeReferenceRows(options: ObjectTreeReferenceListOptions): void {
  const filtered = filterObjectReferenceRows(options.rows, options.details, options.query);
  options.counter.textContent = options.query
    ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}`
    : `${options.rows.length} ${options.rows.length === 1 ? "entry" : "entries"}`;
  if (!options.rows.length) {
    options.listBox.append(emptyListMessage(options.emptyText));
    return;
  }
  if (!filtered.length) {
    options.listBox.append(emptyListMessage(options.noMatchText));
    return;
  }
  const groupedRows = groupObjectReferenceRows(filtered);
  for (const group of groupedRows) {
    if (group.label) options.listBox.append(listGroupHeading(group.label, group.rows.length));
    const ul = el("ul", { className: "list__items", attrs: { role: "list" } });
    for (const row of group.rows) {
      ul.append(renderObjectReferenceRow(row, options.section, options.state, options.query, options.afterSelect));
    }
    options.listBox.append(ul);
  }
  requestAnimationFrame(() =>
    highlightObjectReferenceSelection(options.listBox, options.state.selectedObjectReference),
  );
}

function groupObjectReferenceRows(
  rows: ObjectPropertyReferenceRow[],
): Array<{ label: string | null; rows: ObjectPropertyReferenceRow[] }> {
  if (!rows.some((row) => row.group)) return [{ label: null, rows }];
  const groups: Array<{ label: string | null; rows: ObjectPropertyReferenceRow[] }> = [];
  for (const row of rows) {
    const label = row.group ?? "Other";
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.rows.push(row);
    } else {
      groups.push({ label, rows: [row] });
    }
  }
  return groups;
}

function renderObjectReferenceRow(
  row: ObjectPropertyReferenceRow,
  section: ObjectReferenceSection,
  state: ReferenceState,
  query: string,
  afterSelect: (() => void) | undefined,
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
  name.append(highlight(row.label, query, true));
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
    afterSelect?.();
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

export function isObjectReferenceSection(section: ObjectSection): section is ObjectReferenceSection {
  return section === "fx" || section === "cue-types" || section === "universe-components";
}

export function highlightObjectReferenceSelection(
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
    next.scrollIntoView({ block: "nearest", behavior: "auto" });
  }
}
