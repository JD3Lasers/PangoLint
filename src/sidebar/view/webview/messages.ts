// Typed message protocol between the Commands webview and its host
// (CommandsWebviewProvider in the extension). Discriminated unions in
// both directions so adding a new variant is a single TS exhaustiveness
// check away.
//
// Renderer-agnostic: this file imports only model types and declares
// shapes. The webview bundle and the host both consume these types.

import type { CommandDetail, CommandSummary } from "../../model/types";

/**
 * Filter state the webview owns and reports back so the host doesn't
 * have to mirror it. The host never instantiates this directly; it just
 * receives one in the requestDetail / requestList messages.
 */
export interface WebviewFilterState {
  query: string;
  categories: string[];
  groupByCategory: boolean;
}

/**
 * Group rendered when groupByCategory = true. The host returns these
 * pre-grouped so the webview doesn't re-implement the grouping.
 */
export interface CommandGroup {
  category: string;
  commands: CommandSummary[];
}

export interface CategorySummary {
  name: string;
  count: number;
}

/**
 * Initial payload the host pushes down on first activation. Contains
 * the full catalog so the webview can do all filtering / grouping
 * locally without round-tripping for every keystroke.
 *
 * 529 commands × ~10 fields per CommandSummary = ~50 KB of JSON.
 * VS Code's webview message bus handles that comfortably.
 */
export interface InitPayload {
  commands: CommandSummary[];
  /**
   * Distinct BEYOND categories with per-category command counts. Used by
   * the category chip strip — sorted by BEYOND tree order (the `order`
   * field from `beyond-category-tree.json`).
   */
  categories: CategorySummary[];
  /**
   * BEYOND tree order for each category name. Lower numbers appear first.
   * Categories absent from this map sort after all keyed categories.
   * Optional for compatibility with older init payloads.
   */
  categoryOrder?: Record<string, number>;
}

// ============================================================
// HOST → WEBVIEW
// ============================================================

export type HostToWebviewMessage =
  | {
      type: "init";
      payload: InitPayload;
    }
  | {
      type: "detail";
      command: string;
      detail: CommandDetail | undefined;
    }
  | {
      type: "actionResult";
      action: "insertAtCursor" | "copySignature" | "openReference";
      command: string;
      ok: boolean;
      message?: string;
    }
  | {
      /** Sent from the Objects sidebar to navigate directly to a command. */
      type: "selectCommand";
      command: string;
    };

// ============================================================
// WEBVIEW → HOST
// ============================================================

export type WebviewToHostMessage =
  | {
      type: "ready";
    }
  | {
      type: "requestDetail";
      command: string;
    }
  | {
      type: "insertAtCursor";
      command: string;
      snippet: string;
    }
  | {
      type: "copySignature";
      command: string;
      text: string;
    }
  | {
      type: "openReference";
      command: string;
    };

// ============================================================
// Helpers
// ============================================================

/**
 * Type guards used by both sides to safely narrow incoming messages.
 * Keep them total over the union variants so tsc catches missing cases
 * when a new message type is added.
 */
export function isHostToWebviewMessage(value: unknown): value is HostToWebviewMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { command?: unknown; type?: unknown };
  if (candidate.type === "selectCommand") return typeof candidate.command === "string";
  return candidate.type === "init" || candidate.type === "detail" || candidate.type === "actionResult";
}

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown };
  return (
    candidate.type === "ready" ||
    candidate.type === "requestDetail" ||
    candidate.type === "insertAtCursor" ||
    candidate.type === "copySignature" ||
    candidate.type === "openReference"
  );
}
