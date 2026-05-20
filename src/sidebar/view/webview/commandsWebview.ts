// Host-side WebviewViewProvider for the Commands view. Loads the
// bundled HTML/CSS/JS, sends the catalog snapshot on `ready`, and
// dispatches webview action messages to the existing
// pangolint.sidebar.* commands so the message protocol is the only
// renderer-aware contract.
//
// Confidence + sources are intentionally not surfaced (they are
// maintainer-only metadata; see the `UI: hide confidence + sources`
// commit). The CommandSummary / CommandDetail shapes already live in
// src/sidebar/model/types.ts and carry only what the user-facing
// surface should display.

import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { BeyondCategoryTree } from "../../../knowledge/categoryResolution";
import { getCommandDetail, getCommands, type SidebarCatalog } from "../../model/catalog";
import type { CommandSummary } from "../../model/types";
import { SIDEBAR_COMMAND_IDS } from "../../model/types";
import type { CategorySummary, HostToWebviewMessage, InitPayload, WebviewToHostMessage } from "./messages";
import { isWebviewToHostMessage } from "./messages";

export class CommandsWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private pendingCommand: string | undefined;
  private webviewReady = false;
  private categoryOrderCache: Record<string, number> | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly catalog: SidebarCatalog,
  ) {}

  resolveWebviewView(
    view: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = view;
    this.webviewReady = false;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media", "sidebar"),
        vscode.Uri.joinPath(this.extensionUri, "dist"),
      ],
    };
    view.webview.html = this.buildHtml(view.webview);

    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!isWebviewToHostMessage(message)) return;
      void this.handleWebviewMessage(message);
    });
  }

  /**
   * Notify the webview that the catalog data may have changed (a
   * future overlay reload, etc). Posts a fresh init payload if the
   * webview is mounted; otherwise the next `ready` will pick up the
   * current data anyway.
   */
  refresh(): void {
    this.postInit();
  }

  /**
   * Reveal the Commands panel and navigate directly to a command's
   * detail view. Called from the Objects sidebar's right-click
   * "View in Commands" action.
   */
  showCommand(canonical: string): void {
    this.pendingCommand = canonical;
    if (!this.view) {
      void vscode.commands.executeCommand("pangolint.commandsView.focus");
      return;
    }
    void vscode.commands.executeCommand("pangolint.commandsView.focus");
    this.view.show(true);
    this.flushPendingCommand();
  }

  private async handleWebviewMessage(message: WebviewToHostMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.webviewReady = true;
        this.postInit();
        this.flushPendingCommand();
        return;
      case "requestDetail":
        this.postDetail(message.command);
        return;
      case "insertAtCursor":
        await this.dispatchAndReport(
          SIDEBAR_COMMAND_IDS.insertAtCursor,
          { snippet: message.snippet },
          message.command,
          "insertAtCursor",
        );
        return;
      case "copySignature":
        await this.dispatchAndReport(
          SIDEBAR_COMMAND_IDS.copySignature,
          { text: message.text },
          message.command,
          "copySignature",
        );
        return;
      case "openReference":
        await this.openReference(message.command);
        return;
    }
  }

  private postInit(): void {
    if (!this.view) return;
    const categoryOrder = this.loadCategoryOrder();
    const summaries = getCommands(this.catalog).map(toClientSummary);
    const payload: InitPayload = {
      commands: summaries,
      categories: summarizeCategories(summaries, categoryOrder),
      categoryOrder,
    };
    void this.view.webview.postMessage({ type: "init", payload } satisfies HostToWebviewMessage);
  }

  private flushPendingCommand(): void {
    if (!this.view || !this.webviewReady || !this.pendingCommand) return;
    const command = this.pendingCommand;
    this.pendingCommand = undefined;
    void this.view.webview.postMessage({
      type: "selectCommand",
      command,
    } satisfies HostToWebviewMessage);
  }

  private loadCategoryOrder(): Record<string, number> {
    if (this.categoryOrderCache) return this.categoryOrderCache;
    try {
      const treePath = path.join(this.extensionUri.fsPath, "data", "pangoscript", "beyond-category-tree.json");
      const tree = JSON.parse(readFileSync(treePath, "utf8")) as BeyondCategoryTree;
      const order: Record<string, number> = {};
      for (const cat of tree.categories) order[cat.name] = cat.order;
      this.categoryOrderCache = order;
      return order;
    } catch {
      this.categoryOrderCache = {};
      return {};
    }
  }

  private postDetail(command: string): void {
    if (!this.view) return;
    const detail = getCommandDetail(this.catalog, command);
    void this.view.webview.postMessage({
      type: "detail",
      command,
      detail,
    } satisfies HostToWebviewMessage);
  }

  private async dispatchAndReport(
    commandId: string,
    args: unknown,
    canonical: string,
    action: "insertAtCursor" | "copySignature" | "openReference",
  ): Promise<void> {
    let ok = true;
    let errorMessage: string | undefined;
    try {
      await vscode.commands.executeCommand(commandId, args);
    } catch (error) {
      ok = false;
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    if (this.view) {
      void this.view.webview.postMessage({
        type: "actionResult",
        action,
        command: canonical,
        ok,
        message: errorMessage,
      } satisfies HostToWebviewMessage);
    }
  }

  /**
   * Delegate to the public reference-site command. The maintainer-only
   * markdown reference docs aren't shipped in the VSIX, so this opens
   * the standalone reference page in the user's default browser,
   * deep-linked to the requested canonical command.
   */
  private async openReference(canonical: string): Promise<void> {
    let ok = true;
    let errorMessage: string | undefined;
    try {
      await vscode.commands.executeCommand("pangolint.openReferenceSite", canonical);
    } catch (error) {
      ok = false;
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    if (this.view) {
      void this.view.webview.postMessage({
        type: "actionResult",
        action: "openReference",
        command: canonical,
        ok,
        message: errorMessage,
      } satisfies HostToWebviewMessage);
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "sidebar", "commands.css"));
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "sidebar-commands-webview.js"),
    );
    const nonce = generateNonce();
    return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
    <title>PangoLint Commands</title>
    <link href="${stylesUri}" rel="stylesheet" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

// ============================================================
// Helpers
// ============================================================

function toClientSummary(summary: CommandSummary): CommandSummary {
  // Defensive copy - the webview gets to mutate its own copy without
  // poisoning the catalog. (Currently the webview doesn't mutate, but
  // this keeps the contract symmetric for future expansion.)
  return {
    canonical: summary.canonical,
    kind: summary.kind,
    aliases: [...summary.aliases],
    description: summary.description,
    signature: summary.signature,
    safetyTier: summary.safetyTier,
    evidenceLevel: summary.evidenceLevel,
    category: summary.category,
  };
}

function summarizeCategories(summaries: CommandSummary[], categoryOrder: Record<string, number>): CategorySummary[] {
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    counts.set(summary.category, (counts.get(summary.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => {
      const oa = categoryOrder[a] ?? Number.MAX_SAFE_INTEGER;
      const ob = categoryOrder[b] ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.localeCompare(b);
    })
    .map(([name, count]) => ({ name, count }));
}

function generateNonce(): string {
  let result = "";
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 32; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
