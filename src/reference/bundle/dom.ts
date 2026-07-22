// Tiny DOM helpers - keeps the bundle dependency-free while still
// letting render code stay declarative.

type AttrValue = string | number | boolean | null | undefined;

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

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export function buildHighlightSegments(text: string, query: string, wholeMatch = false): HighlightSegment[] {
  if (!query) return [{ text, matched: false }];
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  if (wholeMatch) return [{ text, matched: haystack.includes(needle) }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) {
      segments.push({ text: text.slice(cursor), matched: false });
      break;
    }
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx), matched: false });
    segments.push({ text: text.slice(idx, idx + query.length), matched: true });
    cursor = idx + query.length;
  }
  return segments;
}

/** Highlight a case-insensitive match inside a string. */
export function highlight(text: string, query: string, wholeMatch = false): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const segment of buildHighlightSegments(text, query, wholeMatch)) {
    if (!segment.matched) {
      frag.append(segment.text);
      continue;
    }
    const mark = el("mark", { className: "hl" });
    mark.textContent = segment.text;
    frag.append(mark);
  }
  return frag;
}

export function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\\n]/g, "\\$&");
}
