// BEYOND Watcher: TreeView in the sidebar showing pinned property paths
// and their last-fetched values. Driven by manual refresh (button on the
// view title) - fetches via readBeyondProperty rather than RegisterOscFeedback
// to avoid the leak-until-BEYOND-restart issue noted in the runtime standards.
//
// Pinned paths persist across sessions in workspace state so the panel
// survives reloads.

import * as vscode from "vscode";
import { EXTENSION_CONFIG_SECTIONS, EXTENSION_WORKSPACE_STATE_KEYS } from "../extensionHost/extensionIds";
import type { OscArg, OscMessage } from "../runtime/osc/osc";
import { readBeyondProperty } from "../runtime/readback/beyondReadback";
import { getBeyondRuntimeConfig } from "../runtime/runtimeConfig";
import { readbackOptionsFromRuntimeConfig } from "../runtime/runtimeOptions";

export interface WatchEntry {
  kind?: "property" | "callback";
  path: string;
  value?: number | string;
  args?: OscArg[];
  typeTags?: string;
  fetchedAt?: number;
  error?: string;
}

export class WatcherTreeProvider implements vscode.TreeDataProvider<WatchEntry> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private entries: WatchEntry[];
  private callbackEntries: WatchEntry[] = [];
  private refreshInFlight: Promise<void> | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    const persisted = context.workspaceState.get<string[]>(EXTENSION_WORKSPACE_STATE_KEYS.watchedPaths, []);
    this.entries = persisted.map((path) => ({ path }));
  }

  getTreeItem(entry: WatchEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(entry.path, vscode.TreeItemCollapsibleState.None);
    if (entry.kind === "callback") {
      const ageS = entry.fetchedAt ? Math.round((Date.now() - entry.fetchedAt) / 1000) : 0;
      item.description = `${entry.typeTags ? `(${entry.typeTags}) ` : ""}${JSON.stringify(entry.args ?? [])}${ageS > 0 ? ` (${ageS}s ago)` : ""}`;
      item.iconPath = new vscode.ThemeIcon("symbol-event");
      item.contextValue = "oscCallback";
      item.tooltip = `${entry.path} ${item.description}`;
      return item;
    }
    if (entry.error) {
      item.description = `error: ${entry.error}`;
      item.iconPath = new vscode.ThemeIcon("warning");
    } else if (entry.value !== undefined) {
      const ageS = entry.fetchedAt ? Math.round((Date.now() - entry.fetchedAt) / 1000) : 0;
      item.description = `= ${entry.value}${ageS > 0 ? ` (${ageS}s ago)` : ""}`;
      item.iconPath = new vscode.ThemeIcon("symbol-property");
    } else {
      item.description = "(not yet fetched)";
      item.iconPath = new vscode.ThemeIcon("circle-outline");
    }
    item.contextValue = "watchedProperty";
    item.tooltip = entry.path;
    return item;
  }

  getChildren(): WatchEntry[] {
    return [...this.callbackEntries, ...this.entries];
  }

  pin(path: string): void {
    if (this.entries.some((e) => e.path === path)) {
      void vscode.window.showInformationMessage(`PangoLint: '${path}' is already pinned.`);
      return;
    }
    this.entries.push({ path });
    void this.persist();
    this._onDidChangeTreeData.fire();
  }

  unpin(entry: WatchEntry): void {
    this.entries = this.entries.filter((e) => e.path !== entry.path);
    void this.persist();
    this._onDidChangeTreeData.fire();
  }

  unpinAll(): void {
    this.entries = [];
    this.callbackEntries = [];
    void this.persist();
    this._onDidChangeTreeData.fire();
  }

  recordOscCallbacks(messages: readonly OscMessage[]): void {
    if (messages.length === 0) {
      return;
    }
    const now = Date.now();
    const nextEntries = messages.map((message) => ({
      kind: "callback" as const,
      path: message.address,
      typeTags: message.typeTags,
      args: message.args,
      fetchedAt: now,
    }));
    this.callbackEntries = [...nextEntries, ...this.callbackEntries].slice(0, 20);
    this._onDidChangeTreeData.fire();
  }

  /** Refetch every pinned property one at a time so OSC listener binds do not overlap. */
  async refresh(): Promise<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.refreshEntries().finally(() => {
      this.refreshInFlight = undefined;
    });
    return this.refreshInFlight;
  }

  private async refreshEntries(): Promise<void> {
    const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.beyond);
    const readbackOptions = readbackOptionsFromRuntimeConfig(getBeyondRuntimeConfig(config));

    for (const entry of this.entries) {
      try {
        const result = await readBeyondProperty({
          propertyPath: entry.path,
          ...readbackOptions,
        });
        if (result.ok) {
          entry.value = result.value;
          entry.error = undefined;
        } else {
          entry.error = result.error ?? "fetch failed";
        }
      } catch (e) {
        entry.error = e instanceof Error ? e.message : String(e);
      }
      entry.fetchedAt = Date.now();
    }
    this._onDidChangeTreeData.fire();
  }

  private async persist(): Promise<void> {
    await this.context.workspaceState.update(
      EXTENSION_WORKSPACE_STATE_KEYS.watchedPaths,
      this.entries.map((e) => e.path),
    );
  }
}
