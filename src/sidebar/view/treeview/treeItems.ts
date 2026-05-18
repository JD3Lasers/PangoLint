// The single seam where renderer-agnostic sidebar model types are turned
// into vscode.TreeItem instances for the Diagnostics view.
// Per the engineering standards model/view split, no other file in
// src/sidebar/view/treeview/ should construct TreeItems directly — they
// go through these helpers.

import * as vscode from "vscode";
import { type DiagnosticGroup, type DiagnosticInput, SIDEBAR_COMMAND_IDS } from "../../model/types";

export function buildDiagnosticGroupTreeItem(group: DiagnosticGroup): vscode.TreeItem {
  const item = new vscode.TreeItem(group.rule, vscode.TreeItemCollapsibleState.Expanded);
  item.description = `${group.count} ${group.count === 1 ? "issue" : "issues"}`;
  item.iconPath = new vscode.ThemeIcon(severityIcon(group.severity));
  item.contextValue = "pangolint.sidebar.diagnosticGroup";
  return item;
}

export function buildDiagnosticEntryTreeItem(entry: DiagnosticInput): vscode.TreeItem {
  const item = new vscode.TreeItem(entry.message, vscode.TreeItemCollapsibleState.None);
  item.description = `Line ${entry.line + 1}`;
  item.iconPath = new vscode.ThemeIcon(severityIcon(entry.severity));
  item.contextValue = "pangolint.sidebar.diagnosticEntry";
  item.command = {
    command: SIDEBAR_COMMAND_IDS.revealDiagnostic,
    title: "Reveal diagnostic",
    arguments: [{ uri: entry.uri, line: entry.line, character: entry.character }],
  };
  return item;
}

export function buildDiagnosticDocsRow(rule: string): vscode.TreeItem {
  const item = new vscode.TreeItem("Why?", vscode.TreeItemCollapsibleState.None);
  item.description = "Open docs";
  item.iconPath = new vscode.ThemeIcon("question");
  item.tooltip = `Open the diagnostics reference for ${rule}.`;
  item.contextValue = "pangolint.sidebar.diagnosticDocs";
  item.command = {
    command: SIDEBAR_COMMAND_IDS.openDiagnosticDocs,
    title: "Open diagnostic docs",
    arguments: [{ rule }],
  };
  return item;
}

export function buildEmptyMessageTreeItem(message: string): vscode.TreeItem {
  const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon("info");
  return item;
}

function severityIcon(severity: string): string {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "information":
      return "info";
    case "hint":
      return "lightbulb";
    default:
      return "circle-outline";
  }
}
