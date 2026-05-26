import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.join(process.cwd(), "src");
const scriptsRoot = path.join(process.cwd(), "scripts");
const mcpSourceRoot = path.join(process.cwd(), "mcp", "src");
const testsRoot = path.join(process.cwd(), "tests");

const expectedSourceFolders = [
  "extensionHost",
  "knowledge",
  "language",
  "reference",
  "runtime",
  "sidebar",
  "test",
  "workspace",
];

const expectedLayout = {
  knowledge: [
    "bundledDataPaths.ts",
    "catalog.ts",
    "catalogGaps.ts",
    "catalogLoader.ts",
    "categoryResolution.ts",
    "expressionFunctions.ts",
    "knowledgeBase.ts",
    "mcpControlReference.ts",
    "mcpKnowledgeExports.ts",
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
    "mcpLanguageExports.ts",
    "parser.ts",
    "propertyPath.ts",
    "propertyProviders.ts",
    "semanticTokens.ts",
    "usageDiagnostics.ts",
    "validationCommand.ts",
    "validationReport.ts",
    "variableProviders.ts",
  ],
  runtime: ["mcpRuntimeExports.ts", "runtimeConfig.ts", "runtimeOptions.ts"],
  workspace: [
    "userObjectCommands.ts",
    "userObjects.ts",
    "watcherView.ts",
    "workspaceRoot.ts",
    "workspaceScanScheduler.ts",
    "workspaceScanner.ts",
    "workspaceSymbols.ts",
    "workspaceTrust.ts",
  ],
  sidebar: [],
  reference: [],
  extensionHost: ["extensionIds.ts", "packagePaths.ts"],
};

const expectedSidebarSubfolders: Record<string, string[]> = {
  model: [
    "actions.ts",
    "catalog.ts",
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

const expectedKnowledgeSubfolders: Record<string, string[]> = {
  "cue-properties": [
    "cueCommonProperties.ts",
    "cuePropertyPaths.ts",
    "cuePropertyTypes.ts",
    "cueTypes.ts",
    "parametricImageShapes.ts",
  ],
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

const expectedReferenceSubfolders: Record<string, string[]> = {
  bundle: [
    "detail",
    "dom.ts",
    "list.ts",
    "listElements.ts",
    "main.ts",
    "nav.ts",
    "object-tree",
    "router.ts",
    "safetyTierDisplay.ts",
    "search.ts",
    "state.ts",
    "tsconfig.json",
    "types.ts",
  ],
  "bundle/detail": [
    "commandDetail.ts",
    "copyControls.ts",
    "detailColumn.ts",
    "objectDetail.ts",
    "objectPropertyFocus.ts",
    "objectPropertySummary.ts",
    "oscRouteDetail.ts",
  ],
  "bundle/object-tree": [
    "cueTypeReference.ts",
    "fxEffectReference.ts",
    "objectPropertySections.ts",
    "objectTreeDetailReference.ts",
    "objectTreeListRows.ts",
    "objectTreeNavigation.ts",
    "objectTreeRows.ts",
    "objectTreeSearch.ts",
    "objectTreeTypes.ts",
    "universeComponentReference.ts",
  ],
};

const expectedRuntimeSubfolders: Record<string, string[]> = {
  commandBatch: ["lintGate.ts", "objectValueAssignment.ts", "runScript.ts", "runScriptWithOscCapture.ts"],
  osc: ["osc.ts", "oscCapture.ts", "oscPortLock.ts"],
  readback: [
    "beyondReadback.ts",
    "nodeReadbackTransport.ts",
    "readbackOscCallbacks.ts",
    "readbackPropertyPath.ts",
    "readbackRequestId.ts",
    "readbackScriptLines.ts",
    "readbackTalk.ts",
    "readbackTypes.ts",
    "validateObjects.ts",
  ],
  talk: ["talkTcp.ts", "talkUdp.ts"],
  vscode: ["runtimeCommands.ts", "validationCommands.ts"],
};

const expectedExtensionHostSubfolders: Record<string, string[]> = {
  suite: ["extension.test.ts", "index.ts", "sidebar.test.ts"],
};

const expectedObjectPropertyIndexScriptModules = [
  "README.md",
  "objectPropertyIndexCommandMetadata.ts",
  "objectPropertyIndexEntries.ts",
  "objectPropertyIndexMetadata.ts",
  "objectPropertyIndexPaths.ts",
  "objectPropertyIndexSearchText.ts",
  "objectPropertyIndexSourceFacts.ts",
  "objectPropertyIndexTypes.ts",
  "objectPropertyIndexValidation.ts",
];

const expectedScriptRootEntries = [
  "README.md",
  "build",
  "knowledge",
  "objectTree",
  "package",
  "release",
  "runtime",
  "workflow",
];

const expectedScriptFolders: Record<string, string[]> = {
  build: ["buildIcon.cjs", "buildReferenceSite.ts", "referenceSite"],
  "build/referenceSite": [
    "README.md",
    "buildReferenceCatalog.ts",
    "referenceCatalogTypes.ts",
    "referenceHtmlFile.ts",
    "referenceInputFiles.ts",
    "referenceRendererBundle.ts",
  ],
  knowledge: ["generateKnowledgeBase.ts", "lintCorpus.ts", "reportCatalogGaps.ts"],
  objectTree: [
    "generateKnownProperties.ts",
    "generateMcpControlReference.ts",
    "generateObjectBehaviorAudit.ts",
    "generateObjectDataQualityAudit.ts",
    "generateObjectPropertyIndex.ts",
    "objectDataQualityConsistency.ts",
    "propertyIndex",
    "validateObjectRangeEvidence.ts",
  ],
  "objectTree/propertyIndex": expectedObjectPropertyIndexScriptModules,
  package: [
    "copyMcpData.cjs",
    "packageSurfacePolicy.cjs",
    "publicArtifactPolicy.ts",
    "verifyMcpPackageContents.cjs",
    "verifyPackageContents.ts",
    "writeVsixSha256.cjs",
  ],
  release: [
    "checkPrVersionBump.cjs",
    "checkReleasePreflight.cjs",
    "releaseSemver.cjs",
    "releaseVersion.cjs",
    "watchReleaseArtifacts.cjs",
  ],
  runtime: ["liveBeyondSmokeLib.ts", "runLiveBeyondSmoke.ts"],
  workflow: ["checkPullRequestReady.cjs", "startIssueWork.cjs"],
};

const expectedMcpToolRegistrationModules = [
  "commandKnowledgeTools.ts",
  "objectTreeKnowledgeTools.ts",
  "propertyControlTools.ts",
  "runtimeReadTools.ts",
  "runtimeWriteTools.ts",
  "scriptAnalysisTools.ts",
  "toolRegistrationResult.ts",
  "toolRegistrationTypes.ts",
];

const allowedMcpVsixSourceImports = new Set([
  "src/knowledge/mcpKnowledgeExports",
  "src/language/mcpLanguageExports",
  "src/runtime/mcpRuntimeExports",
]);

const mcpVsixSourceImportPattern = /^src\/(?:knowledge|language|runtime)\//;

const expectedKnowledgeDataTestFiles = [
  "commandKnowledgeData.test.ts",
  "controlReferenceData.test.ts",
  "knowledgeBase.test.ts",
  "objectBehaviorMetadataData.test.ts",
  "objectDataLayoutMigration.test.ts",
  "objectPropertyClassificationData.test.ts",
  "objectReadbackMetadataData.test.ts",
  "readKnowledgeTestData.ts",
];

const expectedObjectValueMetadataTestFiles = ["cue-and-zone.test.ts", "device.test.ts"];

const expectedRuntimeReadbackTestFiles = [
  "beyondConnection.test.ts",
  "nodeReadbackTransport.test.ts",
  "readBeyondProperty.test.ts",
  "readbackRequest.test.ts",
  "verifyCommandWrite.test.ts",
];

const expectedKnowledgeFixtureFiles = ["objectMetadataPathGroups.ts"];

function readTypeScriptFiles(folderPath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(folderPath, { withFileTypes: true })) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...readTypeScriptFiles(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

function importPathsFromTypeScript(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  return [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

function repoPathForRelativeImport(filePath: string, importPath: string): string | undefined {
  if (!importPath.startsWith(".")) return undefined;
  return path.relative(process.cwd(), path.resolve(path.dirname(filePath), importPath)).replaceAll(path.sep, "/");
}

describe("source layout", () => {
  it("keeps production modules grouped by responsibility under src", () => {
    const rootTypeScriptFiles = readdirSync(sourceRoot)
      .filter((entry) => entry.endsWith(".ts"))
      .sort();

    expect(rootTypeScriptFiles).toEqual(["extension.ts"]);
    expect(
      readdirSync(sourceRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(expectedSourceFolders);

    for (const [folder, files] of Object.entries(expectedLayout)) {
      const folderPath = path.join(sourceRoot, folder);
      expect(existsSync(path.join(folderPath, "README.md")), `${folder}/README.md`).toBe(true);
      expect(
        readdirSync(folderPath)
          .filter((entry) => entry.endsWith(".ts"))
          .sort(),
      ).toEqual(files);
    }

    const referencePath = path.join(sourceRoot, "reference");
    expect(readdirSync(referencePath).sort()).toEqual(["README.md", "bundle", "styles.css"]);
    for (const [subfolder, files] of Object.entries(expectedReferenceSubfolders)) {
      const subfolderPath = path.join(referencePath, subfolder);
      expect(existsSync(subfolderPath), `reference/${subfolder}/`).toBe(true);
      expect(readdirSync(subfolderPath).sort()).toEqual(files);
    }

    const knowledgePath = path.join(sourceRoot, "knowledge");
    for (const [subfolder, files] of Object.entries(expectedKnowledgeSubfolders)) {
      const subfolderPath = path.join(knowledgePath, subfolder);
      expect(existsSync(subfolderPath), `knowledge/${subfolder}/`).toBe(true);
      expect(
        readdirSync(subfolderPath)
          .filter((entry) => entry.endsWith(".ts"))
          .sort(),
      ).toEqual(files);
    }

    const runtimePath = path.join(sourceRoot, "runtime");
    for (const [subfolder, files] of Object.entries(expectedRuntimeSubfolders)) {
      const subfolderPath = path.join(runtimePath, subfolder);
      expect(existsSync(subfolderPath), `runtime/${subfolder}/`).toBe(true);
      expect(
        readdirSync(subfolderPath)
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

  it("keeps extension-host tests isolated under src/test", () => {
    const extensionHostTestPath = path.join(sourceRoot, "test");

    expect(existsSync(path.join(extensionHostTestPath, "README.md")), "test/README.md").toBe(true);
    expect(
      readdirSync(extensionHostTestPath)
        .filter((entry) => entry.endsWith(".ts"))
        .sort(),
    ).toEqual(["runTests.ts"]);

    for (const [subfolder, files] of Object.entries(expectedExtensionHostSubfolders)) {
      const subfolderPath = path.join(extensionHostTestPath, subfolder);
      expect(existsSync(subfolderPath), `test/${subfolder}/`).toBe(true);
      expect(
        readdirSync(subfolderPath)
          .filter((entry) => entry.endsWith(".ts"))
          .sort(),
      ).toEqual(files);
    }
  });
});

describe("script layout", () => {
  it("keeps repository scripts grouped by task area", () => {
    expect(readdirSync(scriptsRoot).sort()).toEqual(expectedScriptRootEntries);

    for (const [folder, entries] of Object.entries(expectedScriptFolders)) {
      const folderPath = path.join(scriptsRoot, folder);
      expect(existsSync(folderPath), `scripts/${folder}/`).toBe(true);
      expect(readdirSync(folderPath).sort()).toEqual(entries);
    }
  });
});

describe("MCP source layout", () => {
  it("splits MCP tool registration by product area", () => {
    const folderPath = path.join(mcpSourceRoot, "tools", "registration");

    expect(
      readdirSync(folderPath)
        .filter((entry) => entry.endsWith(".ts"))
        .sort(),
    ).toEqual(expectedMcpToolRegistrationModules);
  });

  it("keeps MCP imports from VSIX source behind shared product exports", () => {
    const directVsixSourceImports = readTypeScriptFiles(mcpSourceRoot).flatMap((filePath) =>
      importPathsFromTypeScript(filePath)
        .map((importPath) => repoPathForRelativeImport(filePath, importPath))
        .filter((importPath): importPath is string => importPath !== undefined)
        .filter((importPath) => mcpVsixSourceImportPattern.test(importPath))
        .filter((importPath) => !allowedMcpVsixSourceImports.has(importPath))
        .map((importPath) => `${path.relative(process.cwd(), filePath)} -> ${importPath}`),
    );

    expect(directVsixSourceImports).toEqual([]);
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

  it("keeps large knowledge-data checks split by evidence area", () => {
    const knowledgePath = path.join(testsRoot, "knowledge");
    const objectValueMetadataPath = path.join(knowledgePath, "object-value-metadata");
    const fixturePath = path.join(testsRoot, "fixtures", "knowledge");

    expect(
      readdirSync(knowledgePath)
        .filter((entry) => expectedKnowledgeDataTestFiles.includes(entry) || entry === "knowledgeBaseData.test.ts")
        .sort(),
    ).toEqual(expectedKnowledgeDataTestFiles);
    expect(readdirSync(objectValueMetadataPath).sort()).toEqual(expectedObjectValueMetadataTestFiles);
    expect(existsSync(path.join(knowledgePath, "objectValueMetadataCueAndZoneData.test.ts"))).toBe(false);
    expect(existsSync(path.join(knowledgePath, "objectValueMetadataDeviceData.test.ts"))).toBe(false);
    expect(readdirSync(fixturePath).sort()).toEqual(expectedKnowledgeFixtureFiles);
    expect(existsSync(path.join(knowledgePath, "knowledgeBaseData.test.ts"))).toBe(false);
  });

  it("keeps runtime readback tests split by public behavior", () => {
    const runtimePath = path.join(testsRoot, "runtime");
    const readbackPath = path.join(runtimePath, "readback");

    expect(readdirSync(readbackPath).sort()).toEqual(expectedRuntimeReadbackTestFiles);
    expect(existsSync(path.join(runtimePath, "beyondReadback.test.ts"))).toBe(false);
    expect(existsSync(path.join(runtimePath, "beyondReadbackTransport.test.ts"))).toBe(false);
  });
});
