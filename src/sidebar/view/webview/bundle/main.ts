// Webview app entry. Bootstraps state, renders filters / list / detail
// overlay, and translates user actions into messages the extension host
// dispatches to the existing pangolint.sidebar.* command handlers.

import type { CommandSummary } from "../../../model/types";
import type { HostToWebviewMessage, WebviewToHostMessage } from "../messages";
import { isHostToWebviewMessage } from "../messages";
import { renderDetail } from "./detail";
import { el, replaceChildren, setClass } from "./dom";
import { renderFilters } from "./filters";
import { renderList } from "./list";
import { SidebarState } from "./state";
import { formatCatalogStatus } from "./status";

interface VsCodeApi {
  postMessage: (message: WebviewToHostMessage) => void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

const vscodeApi = acquireVsCodeApi();
const state = new SidebarState();

function postMessage(message: WebviewToHostMessage): void {
  vscodeApi.postMessage(message);
}

function showToast(message: string, kind: "ok" | "warn" = "ok"): void {
  state.setToast(kind, message);
  // Auto-clear after 1.8s - long enough to read, short enough that
  // rapid action sequences (insert ↦ copy ↦ next command) don't feel
  // delayed.
  window.setTimeout(() => state.clearToast(), 1800);
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!isHostToWebviewMessage(message)) return;
  handleHostMessage(message);
});

function handleHostMessage(message: HostToWebviewMessage): void {
  switch (message.type) {
    case "init":
      state.setCatalog(message.payload);
      return;
    case "detail":
      state.setDetail(message.command, message.detail);
      return;
    case "selectCommand":
      state.selectCommand(message.command);
      postMessage({ type: "requestDetail", command: message.command });
      return;
    case "actionResult":
      if (message.ok) {
        const verb = actionVerb(message.action);
        showToast(`${verb} ${message.command}`);
      } else {
        showToast(message.message ?? "Action failed", "warn");
      }
      return;
  }
}

type ActionResultMessage = Extract<HostToWebviewMessage, { type: "actionResult" }>;
type ActionKind = ActionResultMessage["action"];

function actionVerb(action: ActionKind): string {
  switch (action) {
    case "insertAtCursor":
      return "Inserted";
    case "copySignature":
      return "Copied";
    case "openReference":
      return "Opened reference for";
  }
}

// ============================================================
// Bootstrap DOM
// ============================================================

function bootstrap(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const filters = renderFilters(state);
  const list = renderList(state, {
    onSelect: (canonical) => {
      state.selectCommand(canonical);
      postMessage({ type: "requestDetail", command: canonical });
    },
    onCopy: (canonical, text) => postMessage({ type: "copySignature", command: canonical, text }),
  });
  const detail = renderDetail(state, {
    onBack: () => state.selectCommand(null),
    onInsert: (canonical, snippet) => postMessage({ type: "insertAtCursor", command: canonical, snippet }),
    onCopy: (canonical, text) => postMessage({ type: "copySignature", command: canonical, text }),
    onOpenReference: (canonical) => postMessage({ type: "openReference", command: canonical }),
  });

  const status = el("div", { className: "status", role: "status", "aria-live": "polite" });
  const toast = el("div", { className: "toast", role: "alert", "aria-live": "polite" });

  // Layout: filters on top, list/detail in the middle (only one
  // visible at a time), status at the bottom.
  const layout = el(
    "div",
    { className: "layout" },
    filters,
    el("div", { className: "panel panel--list" }, list),
    el("div", { className: "panel panel--detail" }, detail),
    status,
    toast,
  );
  replaceChildren(root, layout);

  state.subscribe((change) => {
    if (change === "init" || change === "filter") {
      replaceChildren(status, formatCatalogStatus(state.list(), state.getCatalog()?.commands ?? []));
    }
    if (change === "selection") {
      const isOpen = state.view.selectedCommand !== null;
      setClass(layout, "layout--detail-open", isOpen);
    }
    if (change === "toast") {
      if (state.view.toast) {
        replaceChildren(toast, state.view.toast.message);
        setClass(toast, "toast--ok", state.view.toast.kind === "ok");
        setClass(toast, "toast--warn", state.view.toast.kind === "warn");
        setClass(toast, "toast--visible", true);
      } else {
        setClass(toast, "toast--visible", false);
      }
    }
  });

  postMessage({ type: "ready" });
}

document.addEventListener("DOMContentLoaded", bootstrap);

// Re-export for tests (the bundle entry is also imported as a module).
export type { CommandSummary };
