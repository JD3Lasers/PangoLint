// Tiny DOM helpers - replaces a framework dependency for the webview.
// `el` is JSX-shaped without the JSX: tag name + attrs/listeners + children.

export type Child = Node | string | number | null | undefined | false | Child[];

export interface Attrs {
  className?: string;
  id?: string;
  role?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  title?: string;
  href?: string;
  tabIndex?: number;
  [key: `data-${string}`]: string | number | undefined;
  [key: `aria-${string}`]: string | undefined;
  /**
   * Inline style as a CSS-property-name → string map. Simple cases only;
   * use a class for anything beyond that.
   */
  style?: Partial<CSSStyleDeclaration>;
  /**
   * Event listeners. Keys are lowercase event names ("click", "input").
   */
  on?: Record<string, EventListener>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

function applyAttrs(node: HTMLElement, attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") {
      node.className = String(value);
      continue;
    }
    if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
      continue;
    }
    if (key === "on" && typeof value === "object") {
      for (const [event, handler] of Object.entries(value as Record<string, EventListener>)) {
        node.addEventListener(event, handler);
      }
      continue;
    }
    node.setAttribute(key, String(value));
  }
}

function appendChildren(node: HTMLElement, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
      continue;
    }
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
      continue;
    }
    node.appendChild(child);
  }
}

/**
 * Replace every child of `node` with `children`. Cheaper than
 * `node.innerHTML = ""` for nodes that hold event listeners (no
 * implicit detach + re-create cost per call).
 */
export function replaceChildren(node: HTMLElement, ...children: Child[]): void {
  while (node.firstChild) node.removeChild(node.firstChild);
  appendChildren(node, children);
}

/**
 * Toggle a boolean class on a node. Convenience wrapper over
 * classList.toggle that returns the resulting state.
 */
export function setClass(node: HTMLElement, className: string, on: boolean): void {
  node.classList.toggle(className, on);
}

/**
 * Debounce a function - used for the search input so we don't re-render
 * on every keystroke when the user is typing fast.
 */
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
  let timer: number | undefined;
  return (...args: Args) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
}
