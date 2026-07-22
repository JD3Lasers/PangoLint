// Webview app for the Objects sidebar. Renders a collapsible property
// tree (FX Effects, Cue Types, named objects) with an always-visible
// search bar, a PS/OSC format toggle, and a context menu for property
// insertion actions. Clicking a path fires insertAtCursor back to the host.

import { toBeyondOscAddress, toSetPropSnippet } from "../../../model/objectPaths";
import type { ObjectsInitPayload, ObjectsTreeNode, ObjectsWebviewToHostMessage } from "../objectsMessages";

interface VsCodeApi {
  postMessage: (message: ObjectsWebviewToHostMessage) => void;
}
declare const acquireVsCodeApi: () => VsCodeApi;

const vscode = acquireVsCodeApi();

interface LeafEntry {
  path: string;
  section: string; // top-level section label (FX Effects, Cue Types, object name)
  commands?: string[];
  propertyCard?: ObjectsTreeNode["propertyCard"];
}

type PropertyCard = NonNullable<ObjectsTreeNode["propertyCard"]>;
type ValueSummary = NonNullable<PropertyCard["valueSummary"]>;
type ValueRangeSummary = NonNullable<ValueSummary["range"]>;
type ReadbackSummary = NonNullable<PropertyCard["readbackSummary"]>;
type BehaviorClassification = NonNullable<PropertyCard["classification"]>;

let allLeaves: LeafEntry[] = [];
let sections: ObjectsTreeNode[] = [];
let treeEl: HTMLElement | null = null;
let treeContainer!: HTMLDivElement;
let currentQuery = "";
let oscMode = false;
let activeMenu: HTMLElement | null = null;

// ============================================================
// Path formatting
// ============================================================

function verifiedOscPath(path: string, propertyCard?: ObjectsTreeNode["propertyCard"]): string | undefined {
  if (!propertyCard) return toBeyondOscAddress(path);
  return propertyCard.osc;
}

function displayPath(path: string, propertyCard?: ObjectsTreeNode["propertyCard"]): string {
  return oscMode ? (verifiedOscPath(path, propertyCard) ?? path) : path;
}

// ============================================================
// Leaf collection (for search)
// ============================================================

function collectLeaves(nodes: ObjectsTreeNode[], seen: Set<string>, topSection: string): void {
  for (const node of nodes) {
    const section = topSection !== "" ? topSection : node.label;
    if (node.path !== undefined) {
      const key = `${section}\0${node.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allLeaves.push({
        path: node.path,
        section,
        commands: node.commands,
        propertyCard: node.propertyCard,
      });
    }
    if (node.children) collectLeaves(node.children, seen, section);
  }
}

// ============================================================
// DOM builders
// ============================================================

function closeContextMenu(): void {
  if (!activeMenu) return;
  activeMenu.remove();
  activeMenu = null;
  document.removeEventListener("click", handleContextMenuOutsideClick, true);
  document.removeEventListener("keydown", handleContextMenuKeydown, true);
}

function handleContextMenuOutsideClick(e: MouseEvent): void {
  if (!activeMenu || activeMenu.contains(e.target as Node)) return;
  closeContextMenu();
}

function handleContextMenuKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    closeContextMenu();
  }
}

function menuItem(label: string, onActivate: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-menu__item";
  button.textContent = label;
  button.setAttribute("role", "menuitem");
  button.addEventListener("click", () => {
    onActivate();
    closeContextMenu();
  });
  return button;
}

function showContextMenu(
  e: MouseEvent,
  path: string,
  commands?: string[],
  propertyCard?: ObjectsTreeNode["propertyCard"],
): void {
  e.preventDefault();
  e.stopPropagation();
  closeContextMenu();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");
  menu.appendChild(
    menuItem("Insert at cursor", () => {
      vscode.postMessage({ type: "insertAtCursor", snippet: displayPath(path, propertyCard) });
    }),
  );
  menu.appendChild(
    menuItem("Copy path", () => {
      vscode.postMessage({ type: "copyPath", text: displayPath(path, propertyCard) });
    }),
  );
  menu.appendChild(
    menuItem("Insert as SetProp", () => {
      vscode.postMessage({ type: "insertAtCursor", snippet: toSetPropSnippet(path) });
    }),
  );
  if (commands?.length) {
    menu.appendChild(
      menuItem("Jump to command", () => {
        vscode.postMessage({ type: "jumpToCommand", commands });
      }),
    );
  }

  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  document.body.appendChild(menu);
  activeMenu = menu;

  const firstItem = menu.querySelector<HTMLButtonElement>(".context-menu__item");
  firstItem?.focus();
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const left = Math.min(e.clientX, Math.max(0, window.innerWidth - rect.width - 4));
    const top = Math.min(e.clientY, Math.max(0, window.innerHeight - rect.height - 4));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  });
  document.addEventListener("click", handleContextMenuOutsideClick, true);
  document.addEventListener("keydown", handleContextMenuKeydown, true);
}

function metadataSummary(summary: ValueSummary | undefined): string | undefined {
  if (!summary) return undefined;
  const parts: string[] = [];
  if (summary.valueType) parts.push(summary.valueType);
  if (summary.range) {
    const { unit, boundaryBehavior } = summary.range;
    const bounds = formatValueRangeBounds(summary.range);
    if (bounds) parts.push(unit ? `${bounds} ${unit}` : bounds);
    if (boundaryBehavior) parts.push(boundaryBehavior);
  } else if (summary.unit) {
    parts.push(summary.unit);
  }
  const locationLabel = visibleLocationKind(summary.locationKind);
  if (locationLabel) parts.push(locationLabel);
  return parts.filter(Boolean).join("; ");
}

function readbackSummary(summary: ReadbackSummary | undefined): string | undefined {
  if (!summary) return undefined;
  const locationLabel = visibleLocationKind(summary.locationKind);
  const accessMechanism = readbackAccessMechanismLabel(summary.accessMechanism);
  if (!summary.valueType && !locationLabel && !accessMechanism) return undefined;
  const parts = [summary.status === "readable" ? "readback" : (behaviorLabel(summary.status) ?? summary.status)];
  if (accessMechanism) parts.push(accessMechanism);
  if (summary.valueType) parts.push(summary.valueType);
  if (locationLabel) parts.push(locationLabel);
  return parts.filter(Boolean).join("; ");
}

function readbackAccessMechanismLabel(accessMechanism: string | undefined): string | undefined {
  if (accessMechanism === "pangoscript-expression") return "PangoScript expression";
  if (accessMechanism === "osc-object-bus") return "OSC object bus";
  return undefined;
}

function behaviorSummary(classification: BehaviorClassification | undefined): string | undefined {
  if (!classification) return undefined;
  const parts = [behaviorLabel(classification.accessMode), behaviorLabel(classification.behaviorKind)].filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function behaviorLabel(value: string | undefined): string | undefined {
  if (value === "computed-status") return "status";
  return value?.replaceAll("-", " ");
}

function visibleLocationKind(locationKind: string | undefined): string | undefined {
  if (!locationKind || locationKind === "indexed-root") return undefined;
  return behaviorLabel(locationKind) ?? locationKind;
}

function formatValueRangeBounds(range: ValueRangeSummary): string | undefined {
  const { min, max, dynamicMaxExpression } = range;
  if (min === undefined && max === undefined && !dynamicMaxExpression) return undefined;
  if (min !== undefined && dynamicMaxExpression) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${
        range.maxInclusive === false ? "<" : "<="
      } ${dynamicMaxExpression}`;
    }
    return `${min}..${dynamicMaxExpression}`;
  }
  if (min !== undefined && max !== undefined) {
    if (range.minInclusive === false || range.maxInclusive === false) {
      return `${range.minInclusive === false ? ">" : ">="} ${min} and ${
        range.maxInclusive === false ? "<" : "<="
      } ${max}`;
    }
    return `${min}..${max}`;
  }
  if (min !== undefined) return `${range.minInclusive === false ? ">" : ">="} ${min}`;
  if (dynamicMaxExpression) return `${range.maxInclusive === false ? "<" : "<="} ${dynamicMaxExpression}`;
  return `${range.maxInclusive === false ? "<" : "<="} ${max}`;
}

function propTitle(commands: string[] | undefined, propertyCard: ObjectsTreeNode["propertyCard"]): string {
  const actions = commands?.length
    ? "Click to insert. Right-click to copy, SetProp, or view command actions."
    : "Click to insert. Right-click to copy or SetProp.";
  const summary = metadataSummary(propertyCard?.valueSummary);
  const readback = readbackSummary(propertyCard?.readbackSummary);
  const behavior = behaviorSummary(propertyCard?.classification);
  return [
    actions,
    behavior ? `Behavior: ${behavior}.` : undefined,
    summary ? `Value: ${summary}.` : undefined,
    readback ? `Readback: ${readback}.` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function propItem(
  path: string,
  indent: number,
  commands?: string[],
  propertyCard?: ObjectsTreeNode["propertyCard"],
): HTMLElement {
  const div = document.createElement("div");
  div.className = "prop";
  if (commands?.length) div.classList.add("prop--has-commands");
  div.style.paddingLeft = `${indent}px`;
  const pathEl = document.createElement("span");
  pathEl.className = "prop__path";
  pathEl.textContent = displayPath(path, propertyCard);
  div.appendChild(pathEl);
  const summary = metadataSummary(propertyCard?.valueSummary);
  if (summary) {
    const metadataEl = document.createElement("span");
    metadataEl.className = "prop__meta";
    metadataEl.textContent = summary;
    div.appendChild(metadataEl);
  }
  const readback = readbackSummary(propertyCard?.readbackSummary);
  if (readback) {
    const readbackEl = document.createElement("span");
    readbackEl.className = "prop__meta";
    readbackEl.textContent = readback;
    div.appendChild(readbackEl);
  }
  const behavior = behaviorSummary(propertyCard?.classification);
  if (behavior) {
    const behaviorEl = document.createElement("span");
    behaviorEl.className = "prop__meta";
    behaviorEl.textContent = behavior;
    div.appendChild(behaviorEl);
  }
  div.title = propTitle(commands, propertyCard);
  div.tabIndex = 0;
  div.setAttribute("role", "button");
  const insert = (): void => {
    vscode.postMessage({ type: "insertAtCursor", snippet: displayPath(path, propertyCard) });
  };
  div.addEventListener("click", insert);
  div.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      insert();
    }
  });
  div.addEventListener("contextmenu", (e: MouseEvent) => showContextMenu(e, path, commands, propertyCard));
  return div;
}

function buildNodeEl(node: ObjectsTreeNode, depth: number): HTMLElement {
  const indent = 8 + depth * 12;

  if (node.path !== undefined) {
    return propItem(node.path, indent, node.commands, node.propertyCard);
  }

  if (!node.children?.length) {
    // Informational leaf (e.g. FX effect with no matching properties)
    const div = document.createElement("div");
    div.className = "leaf";
    div.style.paddingLeft = `${indent}px`;
    div.textContent = node.label;
    return div;
  }

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.className = "section__hd";
  summary.style.paddingLeft = `${indent}px`;

  const lbl = document.createElement("span");
  lbl.className = "section__label";
  lbl.textContent = node.label;
  summary.appendChild(lbl);

  if (node.description) {
    const desc = document.createElement("span");
    desc.className = "section__desc";
    desc.textContent = node.description;
    summary.appendChild(desc);
  }

  details.appendChild(summary);

  const body = document.createElement("div");
  for (const child of node.children) body.appendChild(buildNodeEl(child, depth + 1));
  details.appendChild(body);

  return details;
}

function buildTreeEl(nodes: ObjectsTreeNode[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "tree";
  for (const n of nodes) wrap.appendChild(buildNodeEl(n, 0));
  return wrap;
}

function buildFilterEl(q: string): HTMLElement {
  const lower = q.toLowerCase();
  const matches = allLeaves.filter(({ path, propertyCard }) => {
    const oscPath = verifiedOscPath(path, propertyCard);
    return path.toLowerCase().includes(lower) || Boolean(oscPath?.toLowerCase().includes(lower));
  });

  const wrap = document.createElement("div");
  wrap.className = "tree";

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No matching properties.";
    wrap.appendChild(empty);
    return wrap;
  }

  // Group by top-level section so the user knows what each path belongs to.
  const bySection = new Map<string, LeafEntry[]>();
  for (const entry of matches) {
    let bucket = bySection.get(entry.section);
    if (bucket === undefined) {
      bucket = [];
      bySection.set(entry.section, bucket);
    }
    bucket.push(entry);
  }
  for (const [section, entries] of bySection) {
    const hd = document.createElement("div");
    hd.className = "filter-hd";
    hd.textContent = section;
    wrap.appendChild(hd);
    for (const { path, commands, propertyCard } of entries) {
      wrap.appendChild(propItem(path, 8, commands, propertyCard));
    }
  }
  return wrap;
}

// ============================================================
// Render
// ============================================================

function render(): void {
  treeContainer.textContent = "";
  const el = currentQuery ? buildFilterEl(currentQuery) : treeEl;
  if (el) treeContainer.appendChild(el);
}

// ============================================================
// Message handler
// ============================================================

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const msg = event.data as { type: string; payload?: ObjectsInitPayload };
  if (msg.type === "init" && msg.payload) {
    sections = msg.payload.sections;
    allLeaves = [];
    collectLeaves(sections, new Set(), "");
    treeEl = buildTreeEl(sections);
    render();
  }
});

// ============================================================
// Bootstrap
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");
  if (!root) return;

  treeContainer = document.createElement("div");
  treeContainer.className = "viewport";

  const input = document.createElement("input");
  input.type = "search";
  input.className = "search";
  input.placeholder = "Filter properties…";
  input.setAttribute("aria-label", "Filter properties");

  let timer: ReturnType<typeof setTimeout> | null = null;
  input.addEventListener("input", () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      currentQuery = input.value.trim();
      render();
    }, 60);
  });

  const modeBtn = document.createElement("button");
  modeBtn.type = "button";
  modeBtn.className = "mode-btn";
  modeBtn.textContent = "OSC";
  modeBtn.title = "Toggle between PangoScript (dot) and OSC (slash) path format";
  modeBtn.addEventListener("click", () => {
    oscMode = !oscMode;
    modeBtn.classList.toggle("mode-btn--active", oscMode);
    // Rebuild the tree so property text reflects the new format.
    treeEl = buildTreeEl(sections);
    render();
  });

  const searchRow = document.createElement("div");
  searchRow.className = "search-row";
  searchRow.appendChild(input);
  searchRow.appendChild(modeBtn);

  root.appendChild(searchRow);
  root.appendChild(treeContainer);

  vscode.postMessage({ type: "ready" });
});
