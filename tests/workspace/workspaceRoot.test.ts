import { describe, expect, it } from "vitest";

import { firstFileWorkspaceFolderPath } from "../../src/workspace/workspaceRoot";

describe("firstFileWorkspaceFolderPath", () => {
  it("returns the first file-backed workspace folder path", () => {
    expect(
      firstFileWorkspaceFolderPath([
        { uri: { scheme: "vscode-remote", fsPath: "/remote" } },
        { uri: { scheme: "file", fsPath: "/local-a" } },
        { uri: { scheme: "file", fsPath: "/local-b" } },
      ]),
    ).toBe("/local-a");
  });

  it("returns an empty string when no local file-backed folder is available", () => {
    expect(firstFileWorkspaceFolderPath(undefined)).toBe("");
    expect(firstFileWorkspaceFolderPath([{ uri: { scheme: "vscode-remote", fsPath: "/remote" } }])).toBe("");
  });
});
