// Collapsible grouped command list. Commands are always grouped by
// category. Each category header is clickable — clicking expands or
// collapses that group. While a search query is active all groups
// show their commands unconditionally so results are never hidden.

import type { CommandSummary } from "../../../model/types";
import { el, setClass } from "./dom";
import type { SidebarState } from "./state";

export interface ListOptions {
  onSelect: (canonical: string) => void;
  onCopy: (canonical: string, text: string) => void;
}

let activeMenu: HTMLElement | null = null;

export function renderList(state: SidebarState, options: ListOptions): HTMLElement {
  const root = el("div", { className: "list", role: "listbox" });
  root.appendChild(renderGroupedList(state, options));
  return root;
}

// ============================================================
// Grouped collapsible list
// ============================================================

function renderGroupedList(state: SidebarState, options: ListOptions): HTMLElement {
  const viewport = el("div", { className: "list__viewport list__viewport--grouped", tabIndex: 0 });

  function paint(): void {
    while (viewport.firstChild) viewport.removeChild(viewport.firstChild);
    const groups = state.groups();
    if (groups.length === 0) {
      viewport.appendChild(renderEmptyState());
      return;
    }
    const isSearching = !!state.filter.query;
    for (const group of groups) {
      const expanded = isSearching || state.expandedCategories.has(group.category);
      viewport.appendChild(renderGroupHeader(group.category, group.commands.length, expanded, state));
      const body = el("div", { className: "group-body" });
      if (!expanded) body.style.display = "none";
      for (const command of group.commands) body.appendChild(renderRow(command, state, options));
      viewport.appendChild(body);
    }
  }

  function syncExpansion(): void {
    const isSearching = !!state.filter.query;
    const headers = viewport.querySelectorAll<HTMLElement>("[data-group]");
    for (const header of headers) {
      const category = header.getAttribute("data-group") ?? "";
      const expanded = isSearching || state.expandedCategories.has(category);
      setClass(header, "group-header--expanded", expanded);
      header.setAttribute("aria-expanded", String(expanded));
      const body = header.nextElementSibling as HTMLElement | null;
      if (body?.classList.contains("group-body")) {
        body.style.display = expanded ? "" : "none";
      }
    }
  }

  paint();

  state.subscribe((change) => {
    if (change === "init" || change === "filter") paint();
    if (change === "expand") syncExpansion();
    if (change === "selection") {
      const rows = viewport.querySelectorAll<HTMLElement>(".row");
      for (const row of rows) {
        const canonical = row.getAttribute("data-canonical") ?? "";
        setClass(row, "row--active", canonical === state.view.selectedCommand);
      }
    }
  });

  return viewport;
}

function renderGroupHeader(category: string, count: number, expanded: boolean, state: SidebarState): HTMLElement {
  const toggle = (): void => {
    if (!state.filter.query) state.toggleCategoryExpanded(category);
  };
  return el(
    "div",
    {
      className: `group-header${expanded ? " group-header--expanded" : ""}`,
      "data-group": category,
      role: "button",
      tabIndex: 0,
      "aria-expanded": String(expanded),
      on: {
        click: toggle,
        keydown: (event) => {
          const ke = event as KeyboardEvent;
          if (ke.key === "Enter" || ke.key === " ") {
            event.preventDefault();
            toggle();
          }
        },
      },
    },
    el("span", { className: "group-header__category" }, category),
    el("span", { className: "group-header__count" }, String(count)),
  );
}

// ============================================================
// Row + empty state
// ============================================================

function closeContextMenu(): void {
  if (!activeMenu) return;
  activeMenu.remove();
  activeMenu = null;
  document.removeEventListener("click", handleContextMenuOutsideClick, true);
  document.removeEventListener("keydown", handleContextMenuKeydown, true);
}

function handleContextMenuOutsideClick(event: MouseEvent): void {
  if (!activeMenu || activeMenu.contains(event.target as Node)) return;
  closeContextMenu();
}

function handleContextMenuKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
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

function showContextMenu(event: MouseEvent, command: CommandSummary, options: ListOptions): void {
  event.preventDefault();
  event.stopPropagation();
  closeContextMenu();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");
  menu.appendChild(
    menuItem("Copy command", () => {
      options.onCopy(command.canonical, command.canonical);
    }),
  );
  menu.appendChild(
    menuItem("Copy signature", () => {
      options.onCopy(command.canonical, command.signature);
    }),
  );

  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  document.body.appendChild(menu);
  activeMenu = menu;

  const firstItem = menu.querySelector<HTMLButtonElement>(".context-menu__item");
  firstItem?.focus();
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const left = Math.min(event.clientX, Math.max(0, window.innerWidth - rect.width - 4));
    const top = Math.min(event.clientY, Math.max(0, window.innerHeight - rect.height - 4));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  });
  document.addEventListener("click", handleContextMenuOutsideClick, true);
  document.addEventListener("keydown", handleContextMenuKeydown, true);
}

function renderRow(command: CommandSummary, state: SidebarState, options: ListOptions): HTMLElement {
  const isActive = state.view.selectedCommand === command.canonical;
  const row = el("div", {
    className: `row${isActive ? " row--active" : ""}`,
    role: "option",
    "data-canonical": command.canonical,
    "data-tier": command.safetyTier,
    tabIndex: 0,
    on: {
      click: () => options.onSelect(command.canonical),
      contextmenu: (event) => {
        const e = event as MouseEvent;
        showContextMenu(e, command, options);
      },
      keydown: (event) => {
        const ke = event as KeyboardEvent;
        if (ke.key === "Enter" || ke.key === " ") {
          event.preventDefault();
          options.onSelect(command.canonical);
        }
      },
    },
  });

  const nameLine = el(
    "div",
    { className: "row__name" },
    el("span", { className: "row__canonical" }, command.canonical),
    el("span", { className: "row__category" }, command.category),
  );

  const description = command.description
    ? command.description.length > 120
      ? `${command.description.slice(0, 117)}…`
      : command.description
    : `${command.signature}`;
  const descLine = el("div", { className: "row__desc" }, description);

  row.appendChild(el("div", { className: "row__body" }, nameLine, descLine));
  return row;
}

function renderEmptyState(): HTMLElement {
  return el(
    "div",
    { className: "empty" },
    el("div", { className: "empty__title" }, "No commands match the current filter."),
    el("div", { className: "empty__hint" }, "Clear the filter to see the full catalog."),
  );
}
