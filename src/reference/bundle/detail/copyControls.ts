import { el } from "../dom";

export function renderCopyButton(text: string, label: string): HTMLElement {
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

export function renderCopyableCode(text: string): HTMLElement {
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
    // Fall through to legacy path.
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
