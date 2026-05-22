// TreeDataProvider for the Diagnostics view. Phase 1 reads diagnostics
// from the active editor on demand (via refresh) and from VS Code's
// diagnostic-change event. Phase 3 hardens debouncing and adds the
// "Why?" docs action.

import * as vscode from "vscode";
import { PANGOSCRIPT_LANGUAGE_ID } from "../../../extensionHost/extensionIds";
import { summarizePangoLintDiagnostics } from "../../model/diagnostics";
import type { DiagnosticGroup, DiagnosticInput, DiagnosticSeverity } from "../../model/types";
import {
  buildDiagnosticDocsRow,
  buildDiagnosticEntryTreeItem,
  buildDiagnosticGroupTreeItem,
  buildEmptyMessageTreeItem,
} from "./treeItems";

type DiagnosticsNode =
  | { kind: "group"; group: DiagnosticGroup }
  | { kind: "entry"; entry: DiagnosticInput }
  | { kind: "docs"; rule: string }
  | { kind: "empty"; message: string };

export class DiagnosticsTreeProvider implements vscode.TreeDataProvider<DiagnosticsNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<DiagnosticsNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(node: DiagnosticsNode): vscode.TreeItem {
    switch (node.kind) {
      case "group":
        return buildDiagnosticGroupTreeItem(node.group);
      case "entry":
        return buildDiagnosticEntryTreeItem(node.entry);
      case "docs":
        return buildDiagnosticDocsRow(node.rule);
      case "empty":
        return buildEmptyMessageTreeItem(node.message);
    }
  }

  getChildren(node?: DiagnosticsNode): DiagnosticsNode[] {
    if (!node) {
      return this.rootNodes();
    }
    if (node.kind === "group") {
      const children: DiagnosticsNode[] = node.group.entries.map((entry) => ({ kind: "entry", entry }));
      children.push({ kind: "docs", rule: node.group.rule });
      return children;
    }
    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private rootNodes(): DiagnosticsNode[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== PANGOSCRIPT_LANGUAGE_ID) {
      // Returning [] lets viewsWelcome render the "Open a .BeyondCode
      // file" link. The "no diagnostics in active file" case stays as a
      // tree row so it stays visually inside the view rather than
      // replacing the title bar with a welcome block.
      return [];
    }
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const inputs = diagnostics.map((diagnostic) => toInput(editor.document.uri, diagnostic));
    const groups = summarizePangoLintDiagnostics(inputs);
    if (groups.length === 0) {
      return [{ kind: "empty", message: "No diagnostics in the active file." }];
    }
    return groups.map((group) => ({ kind: "group", group }));
  }
}

function toInput(uri: vscode.Uri, diagnostic: vscode.Diagnostic): DiagnosticInput {
  return {
    rule: codeToRule(diagnostic.code),
    severity: severityToString(diagnostic.severity),
    message: diagnostic.message,
    uri: uri.toString(),
    line: diagnostic.range.start.line,
    character: diagnostic.range.start.character,
    source: diagnostic.source,
  };
}

function codeToRule(code: vscode.Diagnostic["code"]): string {
  if (code === undefined || code === null) return "unknown";
  if (typeof code === "string" || typeof code === "number") return String(code);
  return String(code.value);
}

function severityToString(severity: vscode.DiagnosticSeverity): DiagnosticSeverity {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "information";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "warning";
  }
}
