export function focusObjectProperty(root: HTMLElement, propertyPath: string): void {
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
