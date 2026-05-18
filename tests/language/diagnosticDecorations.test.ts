import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

const {
  DiagnosticSeverity,
  OverviewRulerLane,
  ThemeColor,
  Range,
  visibleEditors,
  diagnosticsByUri,
  setDecorationsCalls,
  decorationTypeDisposes,
  createTextEditorDecorationTypeMock,
  getDiagnosticsMock,
  onDidChangeDiagnosticsMock,
  onDidChangeActiveTextEditorMock,
  onDidChangeVisibleTextEditorsMock,
  onDidChangeConfigurationMock,
  getConfigurationMock,
  configValues,
} = vi.hoisted(() => {
  const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 } as const;
  const OverviewRulerLane = { Left: 1, Center: 2, Right: 4, Full: 7 } as const;

  class ThemeColor {
    constructor(public readonly id: string) {}
  }

  class Range {
    constructor(
      public startLine: number,
      public startCharacter: number,
      public endLine: number,
      public endCharacter: number,
    ) {}
  }

  type Diagnostic = {
    severity: number;
    source?: string;
    message: string;
    range: Range;
  };

  const setDecorationsCalls: Array<{
    editor: unknown;
    decorationType: { id: number };
    decorations: ReadonlyArray<{ range: Range; renderOptions?: unknown }>;
  }> = [];

  const decorationTypeDisposes: Array<{ id: number; disposed: boolean }> = [];
  let nextDecorationTypeId = 1;
  const createTextEditorDecorationTypeMock = vi.fn((options: unknown) => {
    const id = nextDecorationTypeId++;
    const tracker = { id, disposed: false, options };
    decorationTypeDisposes.push(tracker);
    return {
      id,
      dispose: () => {
        tracker.disposed = true;
      },
    };
  });

  const visibleEditors: Array<{
    document: { uri: { toString(): string }; languageId: string };
    setDecorations: ReturnType<typeof vi.fn>;
  }> = [];

  const diagnosticsByUri = new Map<string, Diagnostic[]>();
  const getDiagnosticsMock = vi.fn((uri: { toString(): string }) => diagnosticsByUri.get(uri.toString()) ?? []);

  const onDidChangeDiagnosticsMock = vi.fn((_listener: unknown) => ({ dispose: vi.fn() }));
  const onDidChangeActiveTextEditorMock = vi.fn((_listener: unknown) => ({ dispose: vi.fn() }));
  const onDidChangeVisibleTextEditorsMock = vi.fn((_listener: unknown) => ({ dispose: vi.fn() }));
  const onDidChangeConfigurationMock = vi.fn((_listener: unknown) => ({ dispose: vi.fn() }));

  const configValues: Record<string, unknown> = {};
  const getConfigurationMock = vi.fn((_section?: string) => ({
    get: <T>(key: string, fallback: T): T => (configValues[key] !== undefined ? (configValues[key] as T) : fallback),
  }));

  return {
    DiagnosticSeverity,
    OverviewRulerLane,
    ThemeColor,
    Range,
    visibleEditors,
    diagnosticsByUri,
    setDecorationsCalls,
    decorationTypeDisposes,
    createTextEditorDecorationTypeMock,
    getDiagnosticsMock,
    onDidChangeDiagnosticsMock,
    onDidChangeActiveTextEditorMock,
    onDidChangeVisibleTextEditorsMock,
    onDidChangeConfigurationMock,
    getConfigurationMock,
    configValues,
  };
});

vi.mock("vscode", () => ({
  DiagnosticSeverity,
  OverviewRulerLane,
  ThemeColor,
  Range,
  window: {
    get visibleTextEditors() {
      return visibleEditors;
    },
    createTextEditorDecorationType: createTextEditorDecorationTypeMock,
    onDidChangeActiveTextEditor: onDidChangeActiveTextEditorMock,
    onDidChangeVisibleTextEditors: onDidChangeVisibleTextEditorsMock,
  },
  languages: {
    getDiagnostics: getDiagnosticsMock,
    onDidChangeDiagnostics: onDidChangeDiagnosticsMock,
  },
  workspace: {
    getConfiguration: getConfigurationMock,
    onDidChangeConfiguration: onDidChangeConfigurationMock,
  },
}));

import { registerDiagnosticDecorations } from "../../src/language/diagnosticDecorations";

function makeEditor(uriString: string, languageId = "pangoscript"): (typeof visibleEditors)[number] {
  return {
    document: {
      uri: { toString: () => uriString },
      languageId,
    },
    setDecorations: vi.fn((decorationType, decorations) => {
      setDecorationsCalls.push({ editor: { uri: uriString }, decorationType, decorations });
    }),
  };
}

function makeDiagnostic(
  severity: number,
  line: number,
  source?: string,
): {
  severity: number;
  source?: string;
  message: string;
  range: InstanceType<typeof Range>;
} {
  return {
    severity,
    source,
    message: `severity ${severity} at line ${line}`,
    range: new Range(line, 0, line, 4),
  };
}

beforeEach(() => {
  visibleEditors.length = 0;
  diagnosticsByUri.clear();
  setDecorationsCalls.length = 0;
  decorationTypeDisposes.length = 0;
  for (const key of Object.keys(configValues)) delete configValues[key];
  createTextEditorDecorationTypeMock.mockClear();
  getDiagnosticsMock.mockClear();
  onDidChangeDiagnosticsMock.mockClear();
  onDidChangeActiveTextEditorMock.mockClear();
  onDidChangeVisibleTextEditorsMock.mockClear();
  onDidChangeConfigurationMock.mockClear();
  getConfigurationMock.mockClear();
});

describe("registerDiagnosticDecorations", () => {
  it("groups diagnostics by severity and applies decorations to each visible editor", () => {
    const uri = "file:///a.BeyondCode";
    const editor = makeEditor(uri);
    visibleEditors.push(editor);
    diagnosticsByUri.set(uri, [
      makeDiagnostic(DiagnosticSeverity.Error, 1, "PangoLint"),
      makeDiagnostic(DiagnosticSeverity.Error, 2, "PangoLint"),
      makeDiagnostic(DiagnosticSeverity.Warning, 5, "PangoLint"),
    ]);

    const subscriptions: Array<{ dispose(): void }> = [];
    registerDiagnosticDecorations({ subscriptions } as unknown as vscode.ExtensionContext, { source: "PangoLint" });

    // One setDecorations call per severity (4 severities) for the single editor.
    expect(editor.setDecorations).toHaveBeenCalledTimes(4);
    const ranges = editor.setDecorations.mock.calls.map(
      ([, decorations]) => (decorations as Array<{ range: InstanceType<typeof Range> }>).length,
    );
    // 2 errors + 1 warning + 0 information + 0 hint, in some order.
    expect(ranges.sort()).toEqual([0, 0, 1, 2]);
  });

  it("filters by source so foreign diagnostics do not produce decorations", () => {
    const uri = "file:///b.BeyondCode";
    const editor = makeEditor(uri);
    visibleEditors.push(editor);
    diagnosticsByUri.set(uri, [
      makeDiagnostic(DiagnosticSeverity.Error, 1, "OtherLinter"),
      makeDiagnostic(DiagnosticSeverity.Warning, 2, "PangoLint"),
    ]);

    const subscriptions: Array<{ dispose(): void }> = [];
    registerDiagnosticDecorations({ subscriptions } as unknown as vscode.ExtensionContext, { source: "PangoLint" });

    const totalRanges = editor.setDecorations.mock.calls.reduce(
      (sum, [, decorations]) => sum + (decorations as unknown[]).length,
      0,
    );
    // Only the warning passes the filter.
    expect(totalRanges).toBe(1);
  });

  it("creates no severity decoration types when highlightStyle is squiggleOnly", () => {
    configValues["diagnostics.highlightStyle"] = "squiggleOnly";

    const subscriptions: Array<{ dispose(): void }> = [];
    registerDiagnosticDecorations({ subscriptions } as unknown as vscode.ExtensionContext);

    expect(createTextEditorDecorationTypeMock).not.toHaveBeenCalled();
  });

  it("creates one inline decoration type per severity when inlineMessages is enabled", () => {
    configValues["diagnostics.highlightStyle"] = "lineBackground";
    configValues["diagnostics.inlineMessages"] = "all";

    const subscriptions: Array<{ dispose(): void }> = [];
    registerDiagnosticDecorations({ subscriptions } as unknown as vscode.ExtensionContext);

    // 4 severities * 2 styles (emphasis + inline) = 8.
    expect(createTextEditorDecorationTypeMock).toHaveBeenCalledTimes(8);
  });

  it("emits inline 'after' contentText only for warnings and errors when inlineMessages is warningsAndAbove", () => {
    const uri = "file:///c.BeyondCode";
    const editor = makeEditor(uri);
    visibleEditors.push(editor);
    diagnosticsByUri.set(uri, [
      makeDiagnostic(DiagnosticSeverity.Error, 1, "PangoLint"),
      makeDiagnostic(DiagnosticSeverity.Warning, 2, "PangoLint"),
      makeDiagnostic(DiagnosticSeverity.Hint, 3, "PangoLint"),
    ]);
    configValues["diagnostics.inlineMessages"] = "warningsAndAbove";

    const subscriptions: Array<{ dispose(): void }> = [];
    registerDiagnosticDecorations({ subscriptions } as unknown as vscode.ExtensionContext, { source: "PangoLint" });

    // Find decoration calls that include `after` render options (the inline ones).
    const inlineDecorations = editor.setDecorations.mock.calls.flatMap(([, decorations]) =>
      (decorations as Array<{ renderOptions?: { after?: { contentText?: string } } }>).filter(
        (d) => d.renderOptions?.after?.contentText !== undefined,
      ),
    );
    expect(inlineDecorations).toHaveLength(2);
  });

  it("registers listeners for diagnostics, editor, and configuration events", () => {
    const subscriptions: Array<{ dispose(): void }> = [];
    registerDiagnosticDecorations({ subscriptions } as unknown as vscode.ExtensionContext);

    expect(onDidChangeDiagnosticsMock).toHaveBeenCalledTimes(1);
    expect(onDidChangeActiveTextEditorMock).toHaveBeenCalledTimes(1);
    expect(onDidChangeVisibleTextEditorsMock).toHaveBeenCalledTimes(1);
    expect(onDidChangeConfigurationMock).toHaveBeenCalledTimes(1);
    expect(subscriptions.length).toBeGreaterThan(0);
  });
});
