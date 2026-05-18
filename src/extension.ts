import * as vscode from "vscode";
import { loadBundledCatalog } from "./knowledge/catalogLoader";
import { loadBundledObjectPropertyIndex } from "./knowledge/objectPropertyIndex";
import { loadBundledPropertyIndex, mergedPropertyIndex, type PropertyIndex } from "./knowledge/propertyIndex";
import { documentAnalysisLimitReason } from "./language/analysisLimits";
import { encodeColor, findColorMatches } from "./language/colorDecorations";
import {
  buildKnowledgeByName,
  commandCompletionItems,
  commandHoverForPosition,
  signatureHelpForLinePrefix,
} from "./language/commandProviders";
import { toVsCodeDiagnostics } from "./language/diagnosticAdapters";
import { registerDiagnosticDecorations } from "./language/diagnosticDecorations";
import { lintPangoScript } from "./language/diagnostics";
import { buildSelectionRange, fullDocumentRange } from "./language/documentRanges";
import { formatPangoScript } from "./language/formatter";
import { inlayHintsForRange } from "./language/inlayHints";
import {
  definitionForGotoTarget,
  documentSymbolsForScript,
  labelHighlights,
  labelReferenceCodeLenses,
  labelReferences,
} from "./language/labelProviders";
import { propertyPathAtPosition } from "./language/propertyPath";
import {
  codeActionsForUnknownRoot,
  hoverForPropertyPath,
  propertyCompletionsForPrefix,
  quickFixesForPropertyTypos,
  quickFixesForUnknownCommand,
} from "./language/propertyProviders";
import { classifySemanticTokens, TOKEN_MODIFIERS, TOKEN_TYPES } from "./language/semanticTokens";
import {
  formatValidationReport,
  type ValidationReportDiagnostic,
  type ValidationSeverity,
} from "./language/validationReport";
import { prepareRenameDispatch, provideRenameEditsDispatch, variableReferences } from "./language/variableProviders";
import { augmentHoverWithLiveValue, registerBeyondRuntimeCommands } from "./runtime/runtimeCommands";
import { buildRuntimeIndex, type ValidatedRootsCache } from "./runtime/validateObjects";
import { registerSidebar } from "./sidebar/view/treeview/register";
import {
  addUserObject,
  emptyUserObjectsRegistry,
  loadUserObjects,
  removeUserObject,
  type UserObjectKind,
  type UserObjectsRegistry,
} from "./workspace/userObjects";
import { type WatchEntry, WatcherTreeProvider } from "./workspace/watcherView";
import { firstFileWorkspaceFolderPath } from "./workspace/workspaceRoot";
import { scanWorkspaceForUserObjects } from "./workspace/workspaceScanner";
import { createWorkspaceScanScheduler } from "./workspace/workspaceScanScheduler";
import { clearWorkspaceSymbolCacheForUri, provideWorkspaceLabelSymbols } from "./workspace/workspaceSymbols";
import { requireWorkspaceTrust } from "./workspace/workspaceTrust";

const LANGUAGE_ID = "pangoscript";

const SEMANTIC_TOKENS_LEGEND = new vscode.SemanticTokensLegend([...TOKEN_TYPES], [...TOKEN_MODIFIERS]);

export function activate(context: vscode.ExtensionContext): void {
  const loadResult = loadBundledCatalog(context.extensionPath);
  if (loadResult.error) {
    void vscode.window.showWarningMessage(`PangoLint: ${loadResult.error}`);
  }
  const catalog = loadResult.catalog;
  const knowledgeByName = buildKnowledgeByName(loadResult.knowledgeBase);
  const propertyLoad = loadBundledPropertyIndex(context.extensionPath);
  if (propertyLoad.error) {
    console.warn(`PangoLint property index: ${propertyLoad.error}`);
  }
  const bundledPropertyIndex = propertyLoad.index;
  const objectPropertyLoad = loadBundledObjectPropertyIndex(context.extensionPath);
  if (objectPropertyLoad.error) {
    console.warn(`PangoLint object property index: ${objectPropertyLoad.error}`);
  }

  // User-defined objects: persistent registry at .pangolint/user-objects.json
  // (workspace-rooted). Each entry classifies an unknown root as a universe,
  // zone alias, or master alias. Universes get their property surface
  // discovered by scanning .BeyondCode files in the workspace; aliases
  // inherit the canonical Zone or Master schema directly.
  let workspaceFolder = firstFileWorkspaceFolderPath(vscode.workspace.workspaceFolders);
  let userObjectsRegistry: UserObjectsRegistry = vscode.workspace.isTrusted
    ? loadUserObjects(workspaceFolder).registry
    : emptyUserObjectsRegistry();
  let workspaceIndex: PropertyIndex = mergedPropertyIndex();
  // Session-scoped cache of roots confirmed via on-demand BEYOND readback
  // validation. Lives only as long as the extension host; no persistence
  // on disk.
  const validatedRootsCache: ValidatedRootsCache = new Map();
  let runtimeIndex: PropertyIndex = buildRuntimeIndex(validatedRootsCache, bundledPropertyIndex);
  let propertyIndex: PropertyIndex = mergedPropertyIndex(runtimeIndex, workspaceIndex, bundledPropertyIndex);
  let workspaceScanGeneration = 0;
  let activeWorkspaceScan: { cancelled: boolean } | undefined;
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("PangoLint");
  const validationOutput = vscode.window.createOutputChannel("PangoLint: Validation");
  const watcher = new WatcherTreeProvider(context);

  const refreshDiagnostics = (document: vscode.TextDocument): void => {
    if (document.languageId !== LANGUAGE_ID) {
      return;
    }
    diagnosticCollection.set(
      document.uri,
      toVsCodeDiagnostics(
        lintPangoScript(document.getText(), catalog, knowledgeByName, propertyIndex, objectPropertyLoad.index),
      ),
    );
  };
  const refreshOpenDocumentDiagnostics = (): void => {
    for (const document of vscode.workspace.textDocuments) {
      refreshDiagnostics(document);
    }
  };

  const refreshUserObjects = async (): Promise<void> => {
    const generation = ++workspaceScanGeneration;
    if (activeWorkspaceScan) activeWorkspaceScan.cancelled = true;
    if (!vscode.workspace.isTrusted) {
      activeWorkspaceScan = undefined;
      userObjectsRegistry = emptyUserObjectsRegistry();
      workspaceIndex = mergedPropertyIndex();
      propertyIndex = mergedPropertyIndex(runtimeIndex, workspaceIndex, bundledPropertyIndex);
      refreshOpenDocumentDiagnostics();
      return;
    }
    const scanState = { cancelled: false };
    activeWorkspaceScan = scanState;
    const scannedWorkspaceFolder = workspaceFolder;
    const nextRegistry = loadUserObjects(scannedWorkspaceFolder).registry;
    const folderScopedUniverses = vscode.workspace
      .getConfiguration("pangolint")
      .get<boolean>("folderScopedUniverses", true);
    let nextWorkspaceIndex: Awaited<ReturnType<typeof scanWorkspaceForUserObjects>>;
    try {
      nextWorkspaceIndex = await scanWorkspaceForUserObjects(
        scannedWorkspaceFolder,
        nextRegistry,
        bundledPropertyIndex,
        {
          folderScopedUniverses,
          isCancellationRequested: () =>
            scanState.cancelled || generation !== workspaceScanGeneration || scannedWorkspaceFolder !== workspaceFolder,
        },
      );
    } finally {
      if (activeWorkspaceScan === scanState) activeWorkspaceScan = undefined;
    }
    if (generation !== workspaceScanGeneration || scannedWorkspaceFolder !== workspaceFolder) return;
    userObjectsRegistry = nextRegistry;
    workspaceIndex = nextWorkspaceIndex.index;
    propertyIndex = mergedPropertyIndex(runtimeIndex, workspaceIndex, bundledPropertyIndex);
    refreshOpenDocumentDiagnostics();
  };

  const refreshRuntimeIndex = (): void => {
    runtimeIndex = buildRuntimeIndex(validatedRootsCache, bundledPropertyIndex);
    propertyIndex = mergedPropertyIndex(runtimeIndex, workspaceIndex, bundledPropertyIndex);
    refreshOpenDocumentDiagnostics();
  };
  const refreshWorkspaceRoot = (): void => {
    const nextWorkspaceFolder = firstFileWorkspaceFolderPath(vscode.workspace.workspaceFolders);
    if (nextWorkspaceFolder === workspaceFolder) return;
    workspaceFolder = nextWorkspaceFolder;
    void refreshUserObjects();
  };

  for (const document of vscode.workspace.textDocuments) {
    refreshDiagnostics(document);
  }
  void refreshUserObjects();
  const workspaceScanScheduler = createWorkspaceScanScheduler(refreshUserObjects);

  context.subscriptions.push(
    diagnosticCollection,
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnosticCollection.delete(document.uri)),
    vscode.workspace.onDidChangeWorkspaceFolders(refreshWorkspaceRoot),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void refreshUserObjects();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("pangolint.folderScopedUniverses")) {
        void refreshUserObjects();
      }
    }),
    vscode.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        const formatted = formatPangoScript(document.getText());
        if (formatted === document.getText()) {
          return [];
        }
        return [vscode.TextEdit.replace(fullDocumentRange(document), formatted)];
      },
    }),
    vscode.languages.registerSelectionRangeProvider(LANGUAGE_ID, {
      provideSelectionRanges(document, positions): vscode.SelectionRange[] {
        return positions.map((pos) => buildSelectionRange(document, pos));
      },
    }),
    vscode.languages.registerCodeLensProvider(LANGUAGE_ID, {
      provideCodeLenses(document, token): vscode.CodeLens[] {
        if (token.isCancellationRequested) return [];
        if (!vscode.workspace.getConfiguration("pangolint").get<boolean>("codeLens.labelReferences", false)) {
          return [];
        }
        return labelReferenceCodeLenses(document);
      },
    }),
    vscode.languages.registerDocumentRangeFormattingEditProvider(LANGUAGE_ID, {
      provideDocumentRangeFormattingEdits(document, range): vscode.TextEdit[] {
        // Expand the range to whole lines — partial-line formatting would
        // break the line-by-line conservative formatter's contract.
        const wholeLines = new vscode.Range(
          range.start.line,
          0,
          range.end.line,
          document.lineAt(range.end.line).text.length,
        );
        const original = document.getText(wholeLines);
        const formatted = formatPangoScript(original);
        if (formatted === original) return [];
        return [vscode.TextEdit.replace(wholeLines, formatted)];
      },
    }),
    vscode.languages.registerCompletionItemProvider(LANGUAGE_ID, {
      provideCompletionItems(): vscode.CompletionItem[] {
        return commandCompletionItems(catalog, knowledgeByName);
      },
    }),
    vscode.languages.registerHoverProvider(LANGUAGE_ID, {
      provideHover(document, position): vscode.Hover | undefined {
        return commandHoverForPosition(document, position, knowledgeByName);
      },
    }),
    vscode.languages.registerCompletionItemProvider(
      LANGUAGE_ID,
      {
        provideCompletionItems(document, position): vscode.CompletionItem[] | undefined {
          const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
          const completions = propertyCompletionsForPrefix(linePrefix, propertyIndex);
          return completions ?? undefined;
        },
      },
      ".",
    ),
    vscode.languages.registerHoverProvider(LANGUAGE_ID, {
      async provideHover(document, position): Promise<vscode.Hover | undefined> {
        const line = document.lineAt(position.line).text;
        const base = hoverForPropertyPath(line, position.character, propertyIndex, position.line);
        if (!base) return base;
        const config = vscode.workspace.getConfiguration("pangolint.beyond");
        if (!config.get<boolean>("liveHoverValues", false)) return base;
        const path = propertyPathAtPosition(document, position);
        if (!path) return base;
        return await augmentHoverWithLiveValue(base, path);
      },
    }),
    vscode.languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
      provideDocumentSymbols(document): vscode.DocumentSymbol[] {
        return documentSymbolsForScript(document);
      },
    }),
    vscode.languages.registerDefinitionProvider(LANGUAGE_ID, {
      provideDefinition(document, position): vscode.Definition | undefined {
        return definitionForGotoTarget(document, position);
      },
    }),
    vscode.languages.registerDocumentHighlightProvider(LANGUAGE_ID, {
      provideDocumentHighlights(document, position): vscode.DocumentHighlight[] | undefined {
        return labelHighlights(document, position);
      },
    }),
    vscode.languages.registerReferenceProvider(LANGUAGE_ID, {
      provideReferences(document, position, context): vscode.Location[] | undefined {
        return (
          labelReferences(document, position, context.includeDeclaration) ??
          variableReferences(document, position, context.includeDeclaration)
        );
      },
    }),
    vscode.languages.registerRenameProvider(LANGUAGE_ID, {
      prepareRename(document, position): vscode.Range | undefined {
        return prepareRenameDispatch(document, position);
      },
      provideRenameEdits(document, position, newName): vscode.WorkspaceEdit | undefined {
        return provideRenameEditsDispatch(document, position, newName, catalog);
      },
    }),
    vscode.languages.registerWorkspaceSymbolProvider({
      provideWorkspaceSymbols: (query, token) => provideWorkspaceLabelSymbols(query, token),
    }),
    vscode.languages.registerDocumentSemanticTokensProvider(
      LANGUAGE_ID,
      {
        provideDocumentSemanticTokens(document, token): vscode.SemanticTokens {
          const builder = new vscode.SemanticTokensBuilder(SEMANTIC_TOKENS_LEGEND);
          if (token.isCancellationRequested) return builder.build();
          for (const tok of classifySemanticTokens(document.getText(), catalog, propertyIndex)) {
            if (token.isCancellationRequested) break;
            builder.push(tok.line, tok.start, tok.length, tok.typeId, tok.modifiers);
          }
          return builder.build();
        },
      },
      SEMANTIC_TOKENS_LEGEND,
    ),
    vscode.languages.registerInlayHintsProvider(LANGUAGE_ID, {
      provideInlayHints(document, range, token): vscode.InlayHint[] {
        if (token.isCancellationRequested) return [];
        return inlayHintsForRange(document, range, knowledgeByName);
      },
    }),
    vscode.languages.registerColorProvider(LANGUAGE_ID, {
      provideDocumentColors(document): vscode.ColorInformation[] {
        if (documentAnalysisLimitReason(document.getText())) return [];
        const out: vscode.ColorInformation[] = [];
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
          const text = document.lineAt(lineNumber).text;
          for (const m of findColorMatches(text, lineNumber)) {
            const range = new vscode.Range(m.line, m.start, m.line, m.start + m.length);
            const color = new vscode.Color(m.red / 255, m.green / 255, m.blue / 255, 1);
            const info = new vscode.ColorInformation(range, color);
            // Stash the format + literal so provideColorPresentations can
            // round-trip without re-parsing.
            (info as { _format?: string })._format = m.format;
            (info as { _literal?: string })._literal = m.literal;
            out.push(info);
          }
        }
        return out;
      },
      provideColorPresentations(color, context): vscode.ColorPresentation[] {
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        const stash = context.range
          ? (context as unknown as { _format?: string; _literal?: string })
          : ({} as { _format?: string; _literal?: string });
        // VS Code drops our stashed metadata between provideDocumentColors
        // and provideColorPresentations — recover format/literal by re-
        // scanning the line at the picker's range.
        const document = context.document;
        const line = document.lineAt(context.range.start.line).text;
        const matches = findColorMatches(line, context.range.start.line);
        const exact = matches.find(
          (m) => m.start === context.range.start.character && m.start + m.length === context.range.end.character,
        );
        const format =
          exact?.format ?? (stash._format as ReturnType<typeof findColorMatches>[number]["format"]) ?? "ColorBGR";
        const literal = exact?.literal ?? stash._literal ?? "0x000000";
        const replacement = encodeColor(r, g, b, format, literal);
        const presentation = new vscode.ColorPresentation(replacement);
        presentation.textEdit = vscode.TextEdit.replace(context.range, replacement);
        return [presentation];
      },
    }),
    vscode.languages.registerCodeActionsProvider(
      LANGUAGE_ID,
      {
        provideCodeActions(document, range, context, token): vscode.CodeAction[] | undefined {
          if (token.isCancellationRequested) return undefined;
          const line = document.lineAt(range.start.line).text;
          const out: vscode.CodeAction[] = [];
          const unknownRoot = vscode.workspace.isTrusted
            ? codeActionsForUnknownRoot(line, range.start.character, propertyIndex)
            : undefined;
          if (unknownRoot) out.push(...unknownRoot);
          out.push(...quickFixesForPropertyTypos(document, context.diagnostics));
          out.push(...quickFixesForUnknownCommand(document, context.diagnostics, catalog));
          return out.length > 0 ? out : undefined;
        },
      },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.SourceFixAll] },
    ),
    vscode.languages.registerSignatureHelpProvider(
      LANGUAGE_ID,
      {
        provideSignatureHelp(document, position): vscode.SignatureHelp | undefined {
          const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
          return signatureHelpForLinePrefix(linePrefix, knowledgeByName);
        },
      },
      " ",
      ",",
    ),
    validationOutput,
    vscode.commands.registerCommand("pangolint.validateCurrentScript", async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document || document.languageId !== LANGUAGE_ID) {
        void vscode.window.showWarningMessage("Open a PangoScript document before validating.");
        return;
      }
      refreshDiagnostics(document);
      const diagnostics = diagnosticCollection.get(document.uri) ?? [];
      const count = diagnostics.length;
      validationOutput.clear();
      validationOutput.appendLine(
        formatValidationReport({
          documentName: vscode.workspace.asRelativePath(document.uri, false),
          diagnostics: diagnostics.map(toValidationReportDiagnostic),
        }),
      );
      if (count > 0) {
        validationOutput.show(true);
      }
      const picked = await vscode.window.showInformationMessage(
        count === 0 ? "PangoLint: no diagnostics found." : `PangoLint: ${count} diagnostic(s) found.`,
        "Show Diagnostics",
        "Show Output",
        "Open Problems",
      );
      if (picked === "Show Diagnostics") {
        await vscode.commands.executeCommand("pangolint.diagnosticsView.focus");
      } else if (picked === "Show Output") {
        validationOutput.show(true);
      } else if (picked === "Open Problems") {
        await vscode.commands.executeCommand("workbench.panel.markers.view.focus");
      }
    }),
    vscode.commands.registerCommand("pangolint.addUserObject", async (name: string, kind: UserObjectKind) => {
      if (!requireWorkspaceTrust("user-object registry writes")) return;
      if (!workspaceFolder) {
        void vscode.window.showWarningMessage("PangoLint: open a workspace folder first.");
        return;
      }
      try {
        addUserObject(workspaceFolder, name, kind);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`PangoLint: ${message}`);
        return;
      }
      await refreshUserObjects();
      void vscode.window.showInformationMessage(`PangoLint: added '${name}' as ${kind}.`);
    }),
    vscode.commands.registerCommand("pangolint.removeUserObject", async () => {
      if (!requireWorkspaceTrust("user-object registry writes")) return;
      if (!workspaceFolder) {
        void vscode.window.showWarningMessage("PangoLint: open a workspace folder first.");
        return;
      }
      const names = userObjectsRegistry.names();
      if (names.length === 0) {
        void vscode.window.showInformationMessage("PangoLint: no user objects to remove.");
        return;
      }
      const picked = await vscode.window.showQuickPick(names, {
        placeHolder: "Pick a user object to remove",
      });
      if (!picked) return;
      removeUserObject(workspaceFolder, picked);
      await refreshUserObjects();
      void vscode.window.showInformationMessage(`PangoLint: removed '${picked}' from user objects.`);
    }),
    vscode.commands.registerCommand("pangolint.showUserObjects", () => {
      const lines: string[] = [`PangoLint user objects (${userObjectsRegistry.size()} entries):`, ""];
      for (const name of userObjectsRegistry.names()) {
        const entry = userObjectsRegistry.get(name);
        lines.push(`  ${name}  [${entry?.kind ?? "?"}]`);
      }
      void vscode.window.showInformationMessage(lines.join("\n"), { modal: true });
    }),
  );
  registerBeyondRuntimeCommands(context, {
    validatedRootsCache,
    getPropertyIndex: () => propertyIndex,
    onValidatedRootsChanged: refreshRuntimeIndex,
    onCapturedOscMessages: (messages) => watcher.recordOscCallbacks(messages),
    lintScriptText: (text) => lintPangoScript(text, catalog, knowledgeByName, propertyIndex, objectPropertyLoad.index),
  });
  registerDiagnosticDecorations(context, { source: "PangoLint" });

  // Auto-rescan workspace when .BeyondCode files change so the universe
  // scanner picks up new button names without requiring the user to
  // re-add the universe via the code action. Also drops stale entries
  // from the workspace symbol cache when files are deleted.
  const fsWatcher = vscode.workspace.createFileSystemWatcher("**/*.BeyondCode");
  const onBeyondCodeChange = (uri: vscode.Uri): void => {
    clearWorkspaceSymbolCacheForUri(uri);
    if (!vscode.workspace.isTrusted) return;
    workspaceScanScheduler.schedule();
  };
  context.subscriptions.push(
    workspaceScanScheduler,
    fsWatcher,
    fsWatcher.onDidCreate(onBeyondCodeChange),
    fsWatcher.onDidChange(onBeyondCodeChange),
    fsWatcher.onDidDelete(onBeyondCodeChange),
  );

  // PangoLint sidebar — Commands / Objects / Diagnostics views in the
  // activity-bar container. Phase 1 renders flat lists; later phases add
  // inline detail children + MarkdownString tooltips.
  registerSidebar(context, {
    knowledgeBase: loadResult.knowledgeBase,
    propertyIndex: bundledPropertyIndex,
    objectPropertyIndex: objectPropertyLoad.index,
  });

  // BEYOND Watcher panel — pinned property paths with manual refresh.
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("pangolintWatcher", watcher),
    vscode.commands.registerCommand("pangolint.pinToWatcher", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        void vscode.window.showErrorMessage("PangoLint: Open a .BeyondCode file before pinning.");
        return;
      }
      const path = propertyPathAtPosition(editor.document, editor.selection.active);
      if (!path) {
        void vscode.window.showWarningMessage(
          "PangoLint: Place the cursor on a property path (e.g. Master.Brightness) before pinning.",
        );
        return;
      }
      watcher.pin(path);
      void vscode.commands.executeCommand("pangolintWatcher.focus");
    }),
    vscode.commands.registerCommand("pangolint.unpinFromWatcher", (entry: WatchEntry) => watcher.unpin(entry)),
    vscode.commands.registerCommand("pangolint.refreshWatcher", () =>
      requireWorkspaceTrust("BEYOND Watcher refreshes")
        ? vscode.window.withProgress({ location: { viewId: "pangolintWatcher" } }, () => watcher.refresh())
        : undefined,
    ),
    vscode.commands.registerCommand("pangolint.clearWatcher", () => watcher.unpinAll()),
  );

  // Open the standalone PangoScript reference site in the user's
  // default browser. The HTML is built at extension build time
  // (`npm run build:reference`) from the same `data/pangoscript/*.json`
  // the runtime reads, so the reference page never drifts from the
  // catalog the extension itself enforces.
  context.subscriptions.push(
    vscode.commands.registerCommand("pangolint.openReferenceSite", async (arg?: string | { canonical?: string }) => {
      const canonical = typeof arg === "string" ? arg : typeof arg === "object" ? arg?.canonical : undefined;
      const baseUri = vscode.Uri.joinPath(context.extensionUri, "media", "reference", "pangoscript-reference.html");
      const target = canonical ? baseUri.with({ fragment: `cmd=${encodeURIComponent(canonical)}` }) : baseUri;
      try {
        await vscode.env.openExternal(target);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`PangoLint: could not open reference site (${message}).`);
      }
    }),
  );
}

export function deactivate(): void {
  // No persistent resources are held outside command execution.
}

function toValidationReportDiagnostic(diagnostic: vscode.Diagnostic): ValidationReportDiagnostic {
  return {
    severity: validationSeverity(diagnostic.severity),
    code: diagnosticCodeValue(diagnostic),
    message: diagnostic.message,
    line: diagnostic.range.start.line,
    character: diagnostic.range.start.character,
  };
}

function validationSeverity(severity: vscode.DiagnosticSeverity): ValidationSeverity {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Information:
      return "information";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "warning";
  }
}

function diagnosticCodeValue(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code;
  if (typeof code === "string" || typeof code === "number") return String(code);
  if (code && typeof code === "object" && "value" in code) return String(code.value);
  return "unknown";
}
