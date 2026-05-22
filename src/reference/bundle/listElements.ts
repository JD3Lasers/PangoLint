import { el } from "./dom";

export function emptyListMessage(text: string): HTMLElement {
  return el("div", { className: "list__empty" }, text);
}

export function listGroupHeading(name: string, count: number, description?: string): HTMLElement {
  const label = el("span", { className: "list__group-name" }, name);
  if (description) {
    label.append(el("span", { className: "list__group-desc" }, description));
  }
  return el(
    "div",
    { className: "list__group-heading", attrs: { role: "heading", "aria-level": "3" } },
    label,
    el("span", { className: "list__group-count" }, String(count)),
  );
}
