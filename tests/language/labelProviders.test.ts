import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

const vscodeMock = vi.hoisted(() => {
  class Position {
    constructor(
      readonly line: number,
      readonly character: number,
    ) {}
  }

  class Range {
    readonly start: Position;
    readonly end: Position;

    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
      this.start = new Position(startLine, startCharacter);
      this.end = new Position(endLine, endCharacter);
    }

    contains(position: Position): boolean {
      if (position.line < this.start.line || position.line > this.end.line) return false;
      if (position.line === this.start.line && position.character < this.start.character) return false;
      if (position.line === this.end.line && position.character > this.end.character) return false;
      return true;
    }
  }

  class Location {
    constructor(
      readonly uri: unknown,
      readonly range: Range,
    ) {}
  }

  class DocumentSymbol {
    constructor(
      readonly name: string,
      readonly detail: string,
      readonly kind: number,
      readonly range: Range,
      readonly selectionRange: Range,
    ) {}
  }

  class DocumentHighlight {
    constructor(
      readonly range: Range,
      readonly kind: number,
    ) {}
  }

  class CodeLens {
    constructor(
      readonly range: Range,
      readonly command?: unknown,
    ) {}
  }

  class CompletionItem {
    detail?: string;
    insertText?: string;
    sortText?: string;

    constructor(
      readonly label: string,
      readonly kind?: number,
    ) {}
  }

  class WorkspaceEdit {
    readonly edits: Array<{ uri: unknown; range: Range; newText: string }> = [];

    replace(uri: unknown, range: Range, newText: string): void {
      this.edits.push({ uri, range, newText });
    }
  }

  return {
    CodeLens,
    CompletionItem,
    CompletionItemKind: { Reference: 18 },
    DocumentHighlight,
    DocumentHighlightKind: { Read: 2, Write: 3 },
    DocumentSymbol,
    Location,
    Position,
    Range,
    SymbolKind: { Method: 5 },
    WorkspaceEdit,
  };
});

vi.mock("vscode", () => vscodeMock);

import { PANGO_ANALYSIS_LIMITS } from "../../src/language/analysisLimits";
import {
  definitionForGotoTarget,
  documentSymbolsForScript,
  gotoLabelCompletionItems,
  labelReferenceCodeLenses,
  labelReferences,
  labelRenameEdits,
} from "../../src/language/labelProviders";
import { variableReferences } from "../../src/language/variableProviders";

describe("labelProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts script labels into document symbols", () => {
    const document = fakeDocument(["Start:", "  Brightness 50", "Loop: Goto Start"]);

    const symbols = documentSymbolsForScript(document);

    expect(symbols.map((symbol) => symbol.name)).toEqual(["Start", "Loop"]);
    expect(symbols[0].selectionRange.start.character).toBe(0);
    expect(symbols[1].range.end.character).toBe("Loop: Goto Start".length);
  });

  it("finds label references with optional declaration filtering", () => {
    const document = fakeDocument(["Start:", "  Goto Start", "  If 1 Goto Start"]);

    const refs = labelReferences(document, new vscodeMock.Position(1, 8) as unknown as vscode.Position, false);

    expect(refs?.map((location) => location.range.start.line)).toEqual([1, 2]);
  });

  it("renames label declarations and goto references together", () => {
    const document = fakeDocument(["Start:", "  Goto Start", "  If 1 Goto Start"]);

    const edit = labelRenameEdits(document, new vscodeMock.Position(0, 1) as unknown as vscode.Position, "Loop");

    const testEdit = edit as unknown as { edits: Array<{ range: { start: { line: number } }; newText: string }> };
    expect(testEdit.edits.map((entry) => [entry.range.start.line, entry.newText])).toEqual([
      [0, "Loop"],
      [1, "Loop"],
      [2, "Loop"],
    ]);
  });

  it("caps label reference code lenses on dense generated files", () => {
    const lines = Array.from(
      { length: PANGO_ANALYSIS_LIMITS.maxCodeLensLabels + 20 },
      (_, index) => `Label${index}: Brightness 50`,
    );
    const document = fakeDocument(lines);

    const lenses = labelReferenceCodeLenses(document);

    expect(lenses).toHaveLength(PANGO_ANALYSIS_LIMITS.maxCodeLensLabels);
  });

  it("does not treat declared variable goto targets as label references", () => {
    const document = fakeDocument(["var targetName", 'targetName = "DoneSection"', "goto targetName", "DoneSection:"]);

    const labelRefs = labelReferences(document, new vscodeMock.Position(2, 8) as unknown as vscode.Position, false);
    const variableRefs = variableReferences(
      document,
      new vscodeMock.Position(2, 8) as unknown as vscode.Position,
      false,
    );

    expect(labelRefs).toBeUndefined();
    expect(variableRefs?.map((location) => location.range.start.line)).toEqual([1, 2]);
  });

  it("does not resolve variable goto targets to same-named labels", () => {
    const document = fakeDocument(["var targetName", 'targetName = "DoneSection"', "targetName:", "goto targetName"]);

    const definition = definitionForGotoTarget(
      document,
      new vscodeMock.Position(3, "goto target".length) as unknown as vscode.Position,
    );

    expect(definition).toBeUndefined();
  });

  it("suggests declared labels after a goto target prefix", () => {
    const document = fakeDocument(["Start:", "Done: Exit", "Goto St"]);

    const items = gotoLabelCompletionItems(
      document,
      new vscodeMock.Position(2, "Goto St".length) as unknown as vscode.Position,
    );

    expect(items?.map((item) => String(item.label))).toEqual(["Start", "Done"]);
    expect(items?.[0].detail).toBe("Label declared on line 1");
  });

  it("suggests declared labels after a conditional goto", () => {
    const document = fakeDocument(["Loop:", "ExitSection:", "If Counter > 0 Goto Lo"]);

    const items = gotoLabelCompletionItems(
      document,
      new vscodeMock.Position(2, "If Counter > 0 Goto Lo".length) as unknown as vscode.Position,
    );

    expect(items?.map((item) => String(item.label))).toEqual(["Loop", "ExitSection"]);
  });

  it("does not suggest labels for a declared variable goto target", () => {
    const document = fakeDocument(["var targetName", "targetNameSuffix:", "DoneSection:", "goto targetName"]);

    const items = gotoLabelCompletionItems(
      document,
      new vscodeMock.Position(3, "goto targetName".length) as unknown as vscode.Position,
    );

    expect(items).toBeUndefined();
  });
});

function fakeDocument(lines: string[]): vscode.TextDocument {
  const text = lines.join("\n");
  return {
    uri: { toString: () => "file:///test.BeyondCode" },
    getText(range?: { start: { line: number; character: number }; end: { line: number; character: number } }) {
      if (!range) return text;
      if (range.start.line === range.end.line) {
        return lines[range.start.line]?.slice(range.start.character, range.end.character) ?? "";
      }
      throw new Error("multi-line ranges are not needed by this test fixture");
    },
    getWordRangeAtPosition(position: { line: number; character: number }, pattern: RegExp) {
      const line = lines[position.line] ?? "";
      for (const match of line.matchAll(new RegExp(pattern.source, "g"))) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new vscodeMock.Range(position.line, start, position.line, end);
        }
      }
      return undefined;
    },
    lineAt(line: number) {
      const lineText = lines[line] ?? "";
      return {
        range: {
          end: {
            character: lineText.length,
          },
        },
        text: lineText,
      };
    },
    lineCount: lines.length,
  } as unknown as vscode.TextDocument;
}
