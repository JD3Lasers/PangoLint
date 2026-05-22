import * as vscode from "vscode";
import { EXTENSION_CONFIG_SECTIONS, EXTENSION_SETTING_KEYS } from "../extensionHost/extensionIds";

export interface DiagnosticDecorationOptions {
  source?: string;
}

type HighlightStyle = "squiggleOnly" | "background" | "lineBackground";
type InlineMode = "off" | "warningsAndAbove" | "all";

interface Settings {
  highlightStyle: HighlightStyle;
  inlineMessages: InlineMode;
}

interface DecorationState {
  settings: Settings;
  emphasisTypes: Map<vscode.DiagnosticSeverity, vscode.TextEditorDecorationType>;
  inlineTypes: Map<vscode.DiagnosticSeverity, vscode.TextEditorDecorationType>;
}

const ALL_SEVERITIES: readonly vscode.DiagnosticSeverity[] = [
  vscode.DiagnosticSeverity.Error,
  vscode.DiagnosticSeverity.Warning,
  vscode.DiagnosticSeverity.Information,
  vscode.DiagnosticSeverity.Hint,
];

const SEVERITY_PALETTE: Record<
  vscode.DiagnosticSeverity,
  { background: string; borderTheme: string; inlineForeground: string; inlineBackground: string }
> = {
  [vscode.DiagnosticSeverity.Error]: {
    background: "rgba(255, 80, 80, 0.10)",
    borderTheme: "editorError.foreground",
    inlineForeground: "rgba(255, 130, 130, 0.95)",
    inlineBackground: "rgba(255, 80, 80, 0.12)",
  },
  [vscode.DiagnosticSeverity.Warning]: {
    background: "rgba(255, 200, 0, 0.10)",
    borderTheme: "editorWarning.foreground",
    inlineForeground: "rgba(230, 195, 100, 0.95)",
    inlineBackground: "rgba(255, 200, 0, 0.12)",
  },
  [vscode.DiagnosticSeverity.Information]: {
    background: "rgba(80, 160, 255, 0.10)",
    borderTheme: "editorInfo.foreground",
    inlineForeground: "rgba(140, 180, 230, 0.95)",
    inlineBackground: "rgba(80, 160, 255, 0.12)",
  },
  [vscode.DiagnosticSeverity.Hint]: {
    background: "rgba(160, 160, 160, 0.06)",
    borderTheme: "editorHint.foreground",
    inlineForeground: "rgba(170, 170, 170, 0.85)",
    inlineBackground: "rgba(160, 160, 160, 0.08)",
  },
};

export function registerDiagnosticDecorations(
  context: vscode.ExtensionContext,
  options: DiagnosticDecorationOptions = {},
): void {
  let state = createState(readSettings());

  const applyAll = (): void => {
    for (const editor of vscode.window.visibleTextEditors) {
      applyToEditor(editor, state, options.source);
    }
  };

  const applyForUris = (uris: readonly vscode.Uri[]): void => {
    if (uris.length === 0) return;
    const targets = new Set(uris.map((u) => u.toString()));
    for (const editor of vscode.window.visibleTextEditors) {
      if (targets.has(editor.document.uri.toString())) {
        applyToEditor(editor, state, options.source);
      }
    }
  };

  applyAll();

  context.subscriptions.push(
    { dispose: () => disposeState(state) },
    vscode.languages.onDidChangeDiagnostics((event) => applyForUris(event.uris)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) applyToEditor(editor, state, options.source);
    }),
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      for (const editor of editors) applyToEditor(editor, state, options.source);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        !event.affectsConfiguration(
          `${EXTENSION_CONFIG_SECTIONS.pangolint}.${EXTENSION_SETTING_KEYS.diagnosticsHighlightStyle}`,
        ) &&
        !event.affectsConfiguration(
          `${EXTENSION_CONFIG_SECTIONS.pangolint}.${EXTENSION_SETTING_KEYS.diagnosticsInlineMessages}`,
        )
      ) {
        return;
      }
      disposeState(state);
      state = createState(readSettings());
      applyAll();
    }),
  );
}

function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTIONS.pangolint);
  const highlightStyle = config.get<HighlightStyle>(EXTENSION_SETTING_KEYS.diagnosticsHighlightStyle, "lineBackground");
  const inlineMessages = config.get<InlineMode>(EXTENSION_SETTING_KEYS.diagnosticsInlineMessages, "off");
  return { highlightStyle, inlineMessages };
}

function createState(settings: Settings): DecorationState {
  const emphasisTypes = new Map<vscode.DiagnosticSeverity, vscode.TextEditorDecorationType>();
  if (settings.highlightStyle !== "squiggleOnly") {
    for (const severity of ALL_SEVERITIES) {
      emphasisTypes.set(severity, createEmphasisType(severity, settings.highlightStyle));
    }
  }

  const inlineTypes = new Map<vscode.DiagnosticSeverity, vscode.TextEditorDecorationType>();
  if (settings.inlineMessages !== "off") {
    for (const severity of severitiesForInline(settings.inlineMessages)) {
      inlineTypes.set(severity, createInlineType(severity));
    }
  }

  return { settings, emphasisTypes, inlineTypes };
}

function disposeState(state: DecorationState): void {
  for (const decorationType of state.emphasisTypes.values()) decorationType.dispose();
  for (const decorationType of state.inlineTypes.values()) decorationType.dispose();
  state.emphasisTypes.clear();
  state.inlineTypes.clear();
}

function severitiesForInline(mode: InlineMode): readonly vscode.DiagnosticSeverity[] {
  if (mode === "warningsAndAbove") {
    return [vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning];
  }
  if (mode === "all") return ALL_SEVERITIES;
  return [];
}

function createEmphasisType(
  severity: vscode.DiagnosticSeverity,
  highlightStyle: Exclude<HighlightStyle, "squiggleOnly">,
): vscode.TextEditorDecorationType {
  const palette = SEVERITY_PALETTE[severity];
  const isWholeLine = highlightStyle === "lineBackground";
  return vscode.window.createTextEditorDecorationType({
    isWholeLine,
    backgroundColor: palette.background,
    borderColor: new vscode.ThemeColor(palette.borderTheme),
    borderStyle: "solid",
    borderWidth: isWholeLine ? "0 0 0 2px" : "0",
    overviewRulerColor: new vscode.ThemeColor(palette.borderTheme),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });
}

function createInlineType(severity: vscode.DiagnosticSeverity): vscode.TextEditorDecorationType {
  const palette = SEVERITY_PALETTE[severity];
  return vscode.window.createTextEditorDecorationType({
    after: {
      color: palette.inlineForeground,
      backgroundColor: palette.inlineBackground,
      margin: "0 0 0 2em",
      fontStyle: "italic",
    },
  });
}

function applyToEditor(editor: vscode.TextEditor, state: DecorationState, sourceFilter: string | undefined): void {
  const all = vscode.languages.getDiagnostics(editor.document.uri);
  const filtered = sourceFilter ? all.filter((d) => d.source === sourceFilter) : all;
  const bySeverity = new Map<vscode.DiagnosticSeverity, vscode.Diagnostic[]>();
  for (const severity of ALL_SEVERITIES) bySeverity.set(severity, []);
  for (const diagnostic of filtered) {
    const list = bySeverity.get(diagnostic.severity);
    if (list) list.push(diagnostic);
  }

  for (const severity of ALL_SEVERITIES) {
    const diagnostics = bySeverity.get(severity) ?? [];
    const emphasisType = state.emphasisTypes.get(severity);
    if (emphasisType) {
      editor.setDecorations(
        emphasisType,
        diagnostics.map((d) => ({ range: d.range })),
      );
    }
    const inlineType = state.inlineTypes.get(severity);
    if (inlineType) {
      editor.setDecorations(
        inlineType,
        diagnostics.map((d) => ({
          range: d.range,
          renderOptions: { after: { contentText: ` ${d.message}` } },
        })),
      );
    }
  }
}
