import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import type { CommandCatalog, CommandEntry } from "../../src/knowledge/catalog";
import { PANGO_ANALYSIS_LIMITS } from "../../src/language/analysisLimits";

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
  }

  class CodeAction {
    edit?: unknown;
    diagnostics?: unknown[];
    isPreferred?: boolean;

    constructor(
      readonly title: string,
      readonly kind: string,
    ) {}
  }

  class WorkspaceEdit {
    readonly edits: Array<{ uri: unknown; range: Range; newText: string }> = [];

    replace(uri: unknown, range: Range, newText: string): void {
      this.edits.push({ uri, range, newText });
    }
  }

  class CompletionItem {
    detail?: string;
    insertText?: string;

    constructor(
      readonly label: string,
      readonly kind: number,
    ) {}
  }

  class MarkdownString {
    value = "";
    isTrusted = false;

    appendMarkdown(value: string): void {
      this.value += value;
    }
  }

  class Hover {
    constructor(
      readonly contents: MarkdownString,
      readonly range: Range,
    ) {}
  }

  return {
    CodeAction,
    CodeActionKind: { QuickFix: "quickfix", SourceFixAll: "source.fixAll" },
    CompletionItem,
    CompletionItemKind: { Property: 10, Module: 9, Value: 12, EnumMember: 19 },
    Hover,
    MarkdownString,
    Range,
    WorkspaceEdit,
  };
});

vi.mock("vscode", () => vscodeMock);

import { buildPropertyIndex } from "../../src/knowledge/propertyIndex";
import {
  hoverForPropertyPath,
  propertyCompletionsForPrefix,
  quickFixesForPropertyTypos,
  quickFixesForUnknownCommand,
} from "../../src/language/propertyProviders";

describe("propertyProviders quick fixes", () => {
  it("keeps direct root properties separate from indexed properties", () => {
    const index = buildPropertyIndex({
      schemaVersion: 1,
      schemas: [
        {
          object: "Projector",
          isArray: true,
          propertyCount: 2,
          properties: ["Name"],
          rootProperties: ["Count"],
          sharedWithAliases: 0,
        },
      ],
    });

    expect(propertyCompletionsForPrefix("Projector.", index)?.map((item) => item.label)).toEqual(["Count", "0"]);
    expect(propertyCompletionsForPrefix("Projector.0.", index)?.map((item) => item.label)).toEqual(["Name"]);
    expect(propertyCompletionsForPrefix("Projector.Count.", index)).toEqual([]);
    expect(propertyCompletionsForPrefix("Projector.count.", index)).toEqual([]);

    const hover = hoverForPropertyPath("Projector.Count", 12, index, 0) as unknown as {
      contents: { value: string };
    };
    expect(hover.contents.value).toContain("Verified property on **Projector**.");
    expect(hover.contents.value).not.toContain("(indexed)");
  });

  it("ranks unknown-command quick fixes against the full bundled command catalog", () => {
    const catalog = commandCatalog([
      command("Exit"),
      ...Array.from({ length: PANGO_ANALYSIS_LIMITS.maxPropertyTypoCandidates + 20 }, (_, index) =>
        command(`FillerCommand${index}`),
      ),
      command("Write"),
    ]);
    const diagnostic = diagnosticFor("unknown-command", "Unknown PangoScript command 'Writ'.", 0, 0, 4);
    const document = fakeDocument("Writ");

    const actions = quickFixesForUnknownCommand(document, [diagnostic], catalog);

    expect(actions[0]?.title).toBe("Replace with 'Write'");
  });

  it("labels capped multi-property edits as partial instead of fix-all", () => {
    const diagnostics = Array.from({ length: PANGO_ANALYSIS_LIMITS.maxQuickFixDiagnostics + 1 }, (_, index) =>
      diagnosticFor("property-typo", `Did you mean Master.Good${index}?`, index, 0, 10),
    );
    const document = fakeDocument("Master.Bad");

    const actions = quickFixesForPropertyTypos(document, diagnostics);
    const batch = actions.find((action) => action.title.startsWith("PangoLint: fix first"));

    expect(batch?.title).toBe(
      `PangoLint: fix first ${PANGO_ANALYSIS_LIMITS.maxQuickFixDiagnostics} property typos in file`,
    );
    expect(batch?.kind).toBe(vscodeMock.CodeActionKind.QuickFix);
  });
});

function command(name: string): CommandEntry {
  return {
    aliases: [name],
    canonical: name,
    description: "",
    example: name,
    rawLine: name,
  };
}

function commandCatalog(commands: CommandEntry[]): CommandCatalog {
  const byName = new Map<string, CommandEntry>();
  for (const entry of commands) {
    for (const alias of entry.aliases) {
      byName.set(alias.toLowerCase(), entry);
    }
  }
  return { commands, byName };
}

function diagnosticFor(code: string, message: string, line: number, start: number, length: number): vscode.Diagnostic {
  return {
    code,
    message,
    range: new vscodeMock.Range(line, start, line, start + length),
    source: "PangoLint",
  } as unknown as vscode.Diagnostic;
}

function fakeDocument(text: string): vscode.TextDocument {
  return {
    uri: { toString: () => "file:///test.BeyondCode" },
    getText(range?: { start: { character: number }; end: { character: number } }) {
      if (!range) return text;
      return text.slice(range.start.character, range.end.character);
    },
  } as unknown as vscode.TextDocument;
}
