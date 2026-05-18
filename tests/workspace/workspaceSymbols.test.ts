import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

const { findFilesMock, readFileMock, statMock } = vi.hoisted(() => ({
  findFilesMock: vi.fn(),
  readFileMock: vi.fn(),
  statMock: vi.fn(),
}));

vi.mock("vscode", () => {
  class Range {
    constructor(
      readonly startLine: number,
      readonly startCharacter: number,
      readonly endLine: number,
      readonly endCharacter: number,
    ) {}
  }

  class Location {
    constructor(
      readonly uri: unknown,
      readonly range: Range,
    ) {}
  }

  class SymbolInformation {
    constructor(
      readonly name: string,
      readonly kind: number,
      readonly containerName: string,
      readonly location: Location,
    ) {}
  }

  return {
    Location,
    Range,
    SymbolInformation,
    SymbolKind: { Method: 5 },
    workspace: {
      findFiles: findFilesMock,
      fs: {
        readFile: readFileMock,
        stat: statMock,
      },
    },
  };
});

import { PANGO_ANALYSIS_LIMITS } from "../../src/language/analysisLimits";
import { provideWorkspaceLabelSymbols } from "../../src/workspace/workspaceSymbols";

describe("provideWorkspaceLabelSymbols", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads workspace files through vscode.workspace.fs and filters label symbols by query", async () => {
    const uri = fakeUri("file:///workspace/a.BeyondCode");
    findFilesMock.mockResolvedValue([uri]);
    statMock.mockResolvedValue({ mtime: 123 });
    readFileMock.mockResolvedValue(Buffer.from(["Start:", "Brightness 50", "Loop:", "Goto Loop"].join("\n")));

    const symbols = await provideWorkspaceLabelSymbols("loo", {
      isCancellationRequested: false,
      onCancellationRequested: vi.fn(),
    } as unknown as vscode.CancellationToken);

    expect(findFilesMock).toHaveBeenCalledWith(
      "**/*.BeyondCode",
      "{**/node_modules/**,**/.git/**,**/.vscode-test/**,**/.trash/**}",
      PANGO_ANALYSIS_LIMITS.maxWorkspaceSymbolFiles,
      expect.objectContaining({ isCancellationRequested: false }),
    );
    expect(readFileMock).toHaveBeenCalledWith(uri);
    expect(symbols.map((symbol) => symbol.name)).toEqual(["Loop"]);
  });

  it("skips oversized workspace symbol files before reading their contents", async () => {
    const uri = fakeUri("file:///workspace/huge.BeyondCode");
    findFilesMock.mockResolvedValue([uri]);
    statMock.mockResolvedValue({ mtime: 123, size: PANGO_ANALYSIS_LIMITS.maxWorkspaceSymbolFileBytes + 1 });

    const symbols = await provideWorkspaceLabelSymbols("", {
      isCancellationRequested: false,
      onCancellationRequested: vi.fn(),
    } as unknown as vscode.CancellationToken);

    expect(symbols).toEqual([]);
    expect(readFileMock).not.toHaveBeenCalled();
  });
});

function fakeUri(value: string) {
  return {
    scheme: "file",
    fsPath: value.replace("file://", ""),
    toString: () => value,
  };
}
