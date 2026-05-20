// Tiny DOM helpers - keeps the bundle dependency-free while still
// letting render code stay declarative.

export type AttrValue = string | number | boolean | null | undefined;

export interface ElOptions {
  className?: string;
  id?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, AttrValue>;
  on?: Record<string, EventListener>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.id) node.id = options.id;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      if (v === false || v == null) continue;
      node.setAttribute(k, v === true ? "" : String(v));
    }
  }
  if (options.on) {
    for (const [event, handler] of Object.entries(options.on)) {
      node.addEventListener(event, handler);
    }
  }
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): (...args: A) => void {
  let id: number | undefined;
  return (...args: A) => {
    if (id !== undefined) window.clearTimeout(id);
    id = window.setTimeout(() => fn(...args), wait);
  };
}

/** Highlight a substring match (case-insensitive) inside a string. */
export function highlight(text: string, query: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!query) {
    frag.append(text);
    return frag;
  }
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) {
      frag.append(text.slice(cursor));
      break;
    }
    if (idx > cursor) frag.append(text.slice(cursor, idx));
    const mark = el("mark", { className: "hl" });
    mark.textContent = text.slice(idx, idx + query.length);
    frag.append(mark);
    cursor = idx + query.length;
  }
  return frag;
}
