// Single entry point that wires the sidebar TreeView renderer into the
// extension host. Owns provider construction, view registration, the
// pangolint.sidebar.* command bindings, and the active-editor /
// diagnostics-change subscriptions that keep the Diagnostics view fresh.

import * as vscode from "vscode";
import { EXTENSION_VIEW_IDS, PANGOSCRIPT_LANGUAGE_ID } from "../../../extensionHost/extensionIds";
import { DIAGNOSTIC_DOCS_PATH } from "../../../extensionHost/packagePaths";
import { EXPRESSION_FUNCTIONS } from "../../../knowledge/expressionFunctions";
import type { PangoKnowledgeBase } from "../../../knowledge/knowledgeBase";
import type { ObjectPropertyIndex } from "../../../knowledge/objectPropertyIndex";
import type { PropertyIndex } from "../../../knowledge/propertyIndex";
import { leadingCommandName } from "../../../language/commandLine";
import { buildKnowledgeByName } from "../../../language/commandProviders";
import { buildSidebarCatalog } from "../../model/catalog";
import { buildSidebarObjects } from "../../model/objects";
import {
  type CopySignaturePayload,
  type InsertAtCursorPayload,
  type OpenDiagnosticDocsPayload,
  type OpenReferencePayload,
  type RevealDiagnosticPayload,
  SIDEBAR_COMMAND_IDS,
} from "../../model/types";
import { CommandsWebviewProvider } from "../webview/commandsWebview";
import { ObjectsWebviewProvider } from "../webview/objectsWebview";
import { DiagnosticsTreeProvider } from "./diagnosticsView";

export interface RegisterSidebarOptions {
  knowledgeBase: PangoKnowledgeBase;
  propertyIndex: PropertyIndex;
  objectPropertyIndex: ObjectPropertyIndex;
}

export function registerSidebar(context: vscode.ExtensionContext, options: RegisterSidebarOptions): void {
  const catalog = buildSidebarCatalog(options.knowledgeBase, {
    expressionFunctions: EXPRESSION_FUNCTIONS,
  });
  const objects = buildSidebarObjects(options.propertyIndex);
  const knowledgeByName = buildKnowledgeByName(options.knowledgeBase);

  const commandsWebviewProvider = new CommandsWebviewProvider(context.extensionUri, catalog);
  const objectsWebviewProvider = new ObjectsWebviewProvider(
    context.extensionUri,
    objects,
    options.objectPropertyIndex,
    options.knowledgeBase,
    commandsWebviewProvider,
  );
  const diagnosticsProvider = new DiagnosticsTreeProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(EXTENSION_VIEW_IDS.commands, commandsWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewViewProvider(EXTENSION_VIEW_IDS.objects, objectsWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider(EXTENSION_VIEW_IDS.diagnostics, diagnosticsProvider),
    vscode.languages.onDidChangeDiagnostics(() => diagnosticsProvider.refresh()),
    vscode.window.onDidChangeActiveTextEditor(() => diagnosticsProvider.refresh()),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.refresh, () => {
      commandsWebviewProvider.refresh();
      objectsWebviewProvider.refresh();
      diagnosticsProvider.refresh();
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.insertAtCursor, async (payload: InsertAtCursorPayload) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== PANGOSCRIPT_LANGUAGE_ID) {
        void vscode.window.showWarningMessage("PangoLint: open a .BeyondCode file before inserting.");
        return;
      }
      await editor.edit((edit) => edit.insert(editor.selection.active, payload.snippet));
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.copySignature, async (payload: CopySignaturePayload) => {
      await vscode.env.clipboard.writeText(payload.text);
      await vscode.window.showInformationMessage(`PangoLint: copied "${payload.text}".`);
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.openReference, async (payload: OpenReferencePayload) => {
      const target = payload.target;
      if (!target) return;
      const uri = looksLikeUrl(target) ? vscode.Uri.parse(target) : vscode.Uri.file(target);
      await vscode.env.openExternal(uri);
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.revealDiagnostic, async (payload: RevealDiagnosticPayload) => {
      const uri = vscode.Uri.parse(payload.uri);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      const position = new vscode.Position(payload.line, payload.character);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }),
    vscode.commands.registerCommand(
      SIDEBAR_COMMAND_IDS.openDiagnosticDocs,
      async (payload: OpenDiagnosticDocsPayload) => {
        const docUri = vscode.Uri.joinPath(context.extensionUri, ...DIAGNOSTIC_DOCS_PATH);
        try {
          const document = await vscode.workspace.openTextDocument(docUri);
          const editor = await vscode.window.showTextDocument(document, { preview: true });
          const ruleHeadingLine = findRuleHeadingLine(document, payload.rule);
          if (ruleHeadingLine !== -1) {
            const position = new vscode.Position(ruleHeadingLine, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
          }
        } catch {
          await vscode.window.showInformationMessage(
            `PangoLint: diagnostic '${payload.rule}' - reference not available in this build.`,
          );
        }
      },
    ),
    // The Commands webview owns its own filter input now; these
    // command IDs remain registered so existing keybindings / palette
    // entries don't break, but they no-op on the webview.
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.filterCommands, async () => {
      // Intentional no-op: the webview hosts its own search input.
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.clearFilter, () => {
      // Intentional no-op: handled inside the webview.
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.insertSelectedCommand, async () => {
      // Intentional no-op: the webview wires its own action buttons.
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.showCommand, (payload: unknown) => {
      const canonical = showCommandPayloadCanonical(payload);
      if (!canonical) return;
      commandsWebviewProvider.showCommand(canonical);
    }),
    vscode.commands.registerCommand(SIDEBAR_COMMAND_IDS.showCommandAtCursor, () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const pos = editor.selection.active;
      const line = editor.document.lineAt(pos.line).text;
      const command = leadingCommandName(line);
      if (!command) return;
      const entry = knowledgeByName.get(command.name.toLowerCase());
      if (!entry) {
        void vscode.window.showInformationMessage("PangoLint: no known command at cursor position.");
        return;
      }
      commandsWebviewProvider.showCommand(entry.canonical);
    }),
  );
}

function findRuleHeadingLine(document: vscode.TextDocument, rule: string): number {
  const headingRegex = new RegExp(`^##\\s+${escapeRegex(rule)}\\s*$`);
  for (let i = 0; i < document.lineCount; i += 1) {
    if (headingRegex.test(document.lineAt(i).text)) return i;
  }
  return -1;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksLikeUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function showCommandPayloadCanonical(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const canonical = (payload as { canonical?: unknown }).canonical;
  return typeof canonical === "string" && canonical.trim() ? canonical : undefined;
}
