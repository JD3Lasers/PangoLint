import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.join(process.cwd(), "src");
const testsRoot = path.join(process.cwd(), "tests");

const expectedLayout = {
  knowledge: [
    "catalog.ts",
    "catalogGaps.ts",
    "catalogLoader.ts",
    "categoryResolution.ts",
    "cueProperties.ts",
    "expressionFunctions.ts",
    "knowledgeBase.ts",
    "mcpControlReference.ts",
    "objectPropertyCards.ts",
    "objectPropertyIndex.ts",
    "objectRangeEvidence.ts",
    "parameterMetadata.ts",
    "propertyIndex.ts",
    "propertyMappingCoverage.ts",
  ],
  language: [
    "analysisLimits.ts",
    "colorDecorations.ts",
    "commandLine.ts",
    "commandProviders.ts",
    "diagnosticAdapters.ts",
    "diagnosticDecorations.ts",
    "diagnostics.ts",
    "documentRanges.ts",
    "formatter.ts",
    "inlayHints.ts",
    "labelProviders.ts",
    "parser.ts",
    "propertyPath.ts",
    "propertyProviders.ts",
    "semanticTokens.ts",
    "usageDiagnostics.ts",
    "validationReport.ts",
    "variableProviders.ts",
  ],
  runtime: [
    "beyondReadback.ts",
    "lintGate.ts",
    "objectValueAssignment.ts",
    "osc.ts",
    "oscCapture.ts",
    "oscPortLock.ts",
    "runScript.ts",
    "runScriptWithOscCapture.ts",
    "runtimeCommands.ts",
    "runtimeConfig.ts",
    "talkUdp.ts",
    "validateObjects.ts",
    "validationCommands.ts",
  ],
  workspace: [
    "userObjects.ts",
    "watcherView.ts",
    "workspaceRoot.ts",
    "workspaceScanScheduler.ts",
    "workspaceScanner.ts",
    "workspaceSymbols.ts",
    "workspaceTrust.ts",
  ],
  sidebar: [],
};

const expectedSidebarSubfolders: Record<string, string[]> = {
  model: [
    "actions.ts",
    "catalog.ts",
    "cueMenu.ts",
    "diagnostics.ts",
    "formatting.ts",
    "fxMenu.ts",
    "fxMenuData.ts",
    "objectPaths.ts",
    "objects.ts",
    "types.ts",
  ],
  // Commands and Objects are rendered by webviews. See view/webview/.
  // Diagnostics keeps the TreeView renderer.
  "view/treeview": ["diagnosticsView.ts", "register.ts", "treeItems.ts"],
  "view/webview": ["commandsWebview.ts", "messages.ts", "objectsMessages.ts", "objectsWebview.ts"],
  "view/webview/bundle": ["detail.ts", "dom.ts", "filters.ts", "list.ts", "main.ts", "state.ts", "status.ts"],
  "view/webview/objects-bundle": ["main.ts"],
};

const expectedLanguageSubfolders: Record<string, string[]> = {
  diagnostics: [
    "beyondCompatibilityDiagnostics.ts",
    "commandDiagnostics.ts",
    "controlFlowDiagnostics.ts",
    "diagnosticLimits.ts",
    "pangoDiagnostic.ts",
    "pangoscriptTextSearch.ts",
    "propertyPathDiagnostics.ts",
    "stringDistance.ts",
    "variableReadDiagnostics.ts",
  ],
};

describe("source layout", () => {
  it("keeps production modules grouped by responsibility under src", () => {
    const rootTypeScriptFiles = readdirSync(sourceRoot)
      .filter((entry) => entry.endsWith(".ts"))
      .sort();

    expect(rootTypeScriptFiles).toEqual(["extension.ts"]);

    for (const [folder, files] of Object.entries(expectedLayout)) {
      const folderPath = path.join(sourceRoot, folder);
      expect(existsSync(path.join(folderPath, "README.md")), `${folder}/README.md`).toBe(true);
      expect(
        readdirSync(folderPath)
          .filter((entry) => entry.endsWith(".ts"))
          .sort(),
      ).toEqual(files);
    }

    const sidebarPath = path.join(sourceRoot, "sidebar");
    for (const [subfolder, files] of Object.entries(expectedSidebarSubfolders)) {
      const subfolderPath = path.join(sidebarPath, subfolder);
      expect(existsSync(subfolderPath), `sidebar/${subfolder}/`).toBe(true);
      expect(
        readdirSync(subfolderPath)
          .filter((entry) => entry.endsWith(".ts"))
          .sort(),
      ).toEqual(files);
    }

    const languagePath = path.join(sourceRoot, "language");
    for (const [subfolder, files] of Object.entries(expectedLanguageSubfolders)) {
      const subfolderPath = path.join(languagePath, subfolder);
      expect(existsSync(path.join(subfolderPath, "README.md")), `language/${subfolder}/README.md`).toBe(true);
      expect(
        readdirSync(subfolderPath)
          .filter((entry) => entry.endsWith(".ts"))
          .sort(),
      ).toEqual(files);
    }
  });
});

describe("test layout", () => {
  it("keeps Vitest files grouped by product area", () => {
    const rootTestFiles = readdirSync(testsRoot)
      .filter((entry) => entry.endsWith(".test.ts"))
      .sort();

    expect(rootTestFiles).toEqual([]);
    const expectedTestFolders = [
      "fixtures",
      "knowledge",
      "language",
      "reference",
      "repo",
      "runtime",
      "sidebar",
      "workspace",
    ];
    expect(
      readdirSync(testsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(expectedTestFolders);
  });
});
