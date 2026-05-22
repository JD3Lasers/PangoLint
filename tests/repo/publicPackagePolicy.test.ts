import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { findPublicArtifactLeaks, findPublicArtifactPathLeaks } from "../../scripts/package/publicArtifactPolicy";
import { REFERENCE_SITE_PATH } from "../../src/extensionHost/packagePaths";
import { BUNDLED_PANGOSCRIPT_DATA_PATHS } from "../../src/knowledge/bundledDataPaths";

const repoRoot = process.cwd();
const packageSurfacePolicy = require("../../scripts/package/packageSurfacePolicy.cjs") as {
  allowedMcpDataPaths: Set<string>;
  allowedMcpDataDirectoryPrefixes: string[];
  expectedVsixPackagePaths: string[];
  findForbiddenMcpPackagePathLabels: (relativePath: string) => string[];
  forbiddenVsixDataPrefixes: string[];
  mcpAssetDirectories: string[];
  mcpAssetFiles: string[];
  packageSurfacePathGroups: {
    mcpAllowedDataFiles: string[];
    mcpAllowedDataDirectoryPrefixes: string[];
    mcpAssetDirectories: string[];
    mcpAssetFiles: string[];
    requiredMcpPackageFiles: string[];
    vsixPackageFiles: string[];
  };
  requiredMcpPackagePaths: string[];
};

describe("public package path policy", () => {
  it("derives shipped package paths from named package surface groups", () => {
    const groups = packageSurfacePolicy.packageSurfacePathGroups;

    expect(packageSurfacePolicy.allowedMcpDataPaths).toEqual(new Set(groups.mcpAllowedDataFiles));
    expect(packageSurfacePolicy.allowedMcpDataDirectoryPrefixes).toEqual(groups.mcpAllowedDataDirectoryPrefixes);
    expect(packageSurfacePolicy.mcpAssetDirectories).toBe(groups.mcpAssetDirectories);
    expect(packageSurfacePolicy.mcpAssetFiles).toBe(groups.mcpAssetFiles);
    expect(packageSurfacePolicy.requiredMcpPackagePaths).toEqual([
      ...groups.requiredMcpPackageFiles,
      ...groups.mcpAllowedDataFiles,
    ]);
    expect(packageSurfacePolicy.expectedVsixPackagePaths).toBe(groups.vsixPackageFiles);

    expect(groups.vsixPackageFiles).toContain(BUNDLED_PANGOSCRIPT_DATA_PATHS.commandsMerged);
    expect(groups.vsixPackageFiles).toContain(BUNDLED_PANGOSCRIPT_DATA_PATHS.objectPropertyIndex);
    expect(groups.vsixPackageFiles).toContain(REFERENCE_SITE_PATH.join("/"));
    expect(groups.mcpAllowedDataFiles).toContain(BUNDLED_PANGOSCRIPT_DATA_PATHS.mcpPropertyControls);
  });

  it("flags maintainer-only paths before packaging", () => {
    expect(
      findPublicArtifactPathLeaks([
        "data/pangoscript/control-reference/probes/check.cjs",
        "data/pangoscript/control-reference/maintainer-evidence/notes.json",
        "data/pangoscript/object-tree/source-facts/object-paths.json",
        "data/pangoscript/object-tree/evidence/value/issue-216-zone.json",
        "data/pangoscript/object-tree/audits/behavior/issue-216-object-behavior-audit.json",
        "data/pangoscript/object-tree/package-projections/full-object-tree.json",
      ]).map((leak) => leak.label),
    ).toEqual([
      "local probe directory",
      "maintainer-only evidence directory",
      "Object Tree source facts",
      "Object Tree evidence",
      "Object Tree audit output",
      "Object Tree package projection",
    ]);

    expect(
      findPublicArtifactPathLeaks([
        "data/pangoscript/control-reference/package-policy.json",
        "data/pangoscript/control-reference/control-crosswalk/property-control-index.json",
        "docs/references/diagnostics/README.md",
      ]),
    ).toEqual([]);
  });

  it("keeps maintainer-only inputs ignored by git and VSIX packaging", () => {
    const gitignore = readFile(".gitignore");
    const vscodeignore = readFile(".vscodeignore");

    for (const pattern of [".vscode/settings.json", "data/*.json", "_site/"]) {
      expect(gitignore).toContain(pattern);
    }
    expect(gitignore).not.toContain("**/probes/");

    for (const pattern of [
      "data/**",
      "!data/pangoscript/beyond-category-tree.json",
      "!data/pangoscript/commands.merged.json",
      "!data/pangoscript/command-property-coverage.json",
      "data/pangoscript/object-tree/source-facts/**",
      "data/pangoscript/object-tree/evidence/**",
      "data/pangoscript/object-tree/audits/**",
      "data/pangoscript/object-tree/package-projections/**",
      "!data/pangoscript/object-tree/runtime-indexes/**",
      "_site/**",
    ]) {
      expect(vscodeignore).toContain(pattern);
    }
    expect(vscodeignore).not.toContain("**/probes/**");
  });

  it("wires path policy into VSIX and MCP package verification paths", () => {
    expect(readFile("scripts/package/verifyPackageContents.ts")).toContain("findPublicArtifactPathLeaks");
    expect(readFile("scripts/package/verifyPackageContents.ts")).toContain("packageSurfacePolicy.cjs");

    const copyMcpData = readFile("scripts/package/copyMcpData.cjs");
    expect(copyMcpData).toContain("assertApprovedMcpAssetPath");
    expect(copyMcpData).toContain("packageSurfacePolicy.cjs");
  });

  it("pins VSIX data packaging to the approved runtime and reference surface", () => {
    const verifyPackageContents = readFile("scripts/package/verifyPackageContents.ts");
    const vscodeignore = readFile(".vscodeignore");

    expect(verifyPackageContents).toContain("findForbiddenVsixPackagePathLabels");
    expect(packageSurfacePolicy.forbiddenVsixDataPrefixes).toContain("data/pangoscript/control-reference/");
    expect(packageSurfacePolicy.forbiddenVsixDataPrefixes).toContain("data/pangoscript/object-behavior-audits/");
    expect(packageSurfacePolicy.forbiddenVsixDataPrefixes).toContain("data/pangoscript/object-tree/source-facts/");
    expect(packageSurfacePolicy.forbiddenVsixDataPrefixes).toContain("data/pangoscript/object-tree/evidence/");
    expect(packageSurfacePolicy.forbiddenVsixDataPrefixes).toContain("data/pangoscript/object-tree/audits/");
    expect(packageSurfacePolicy.forbiddenVsixDataPrefixes).toContain(
      "data/pangoscript/object-tree/package-projections/",
    );
    expect(verifyPackageContents).not.toContain("controlReferencePackagePaths");
    expect(verifyPackageContents).not.toContain("packageFiles(");

    expect(vscodeignore).toContain("data/**");
    expect(vscodeignore).toContain("!data/pangoscript/object-tree/runtime-indexes/**");
    expect(vscodeignore).not.toMatch(/^!data\/$/m);
    expect(vscodeignore).not.toMatch(/^!data\/pangoscript\/$/m);
    expect(vscodeignore).not.toMatch(/^!data\/pangoscript\/object-tree\/$/m);
    expect(vscodeignore).not.toMatch(/^!docs\/$/m);
    expect(vscodeignore).not.toMatch(/^!media\/$/m);
    expect(vscodeignore).not.toContain("data/pangoscript/object-behavior-audits/**");
    expect(vscodeignore).not.toContain("!data/pangoscript/control-reference/**");
  });

  it("pins MCP tarball data packaging to approved runtime and compact reference data", () => {
    const packageJson = readFile("mcp/package.json");
    const copyMcpData = readFile("scripts/package/copyMcpData.cjs");
    const verifyMcpPackageContents = readFile("scripts/package/verifyMcpPackageContents.cjs");

    expect(packageJson).toContain("verifyMcpPackageContents.cjs");
    expect(copyMcpData).toContain("assertApprovedMcpAssetPath");
    expect(
      packageSurfacePolicy.findForbiddenMcpPackagePathLabels("data/pangoscript/object-tree/source-facts/a.json"),
    ).toContain("Object Tree source facts");
    expect(
      packageSurfacePolicy.findForbiddenMcpPackagePathLabels("data/pangoscript/object-tree/evidence/a.json"),
    ).toContain("Object Tree evidence");
    expect(
      packageSurfacePolicy.findForbiddenMcpPackagePathLabels("data/pangoscript/object-tree/audits/a.json"),
    ).toContain("Object Tree audit output");
    expect(
      packageSurfacePolicy.findForbiddenMcpPackagePathLabels("data/pangoscript/object-tree/package-projections/a.json"),
    ).toContain("Object Tree package projection");
    expect(verifyMcpPackageContents).toContain("allowedMcpDataPaths");
    expect(
      packageSurfacePolicy.allowedMcpDataPaths.has(
        "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
      ),
    ).toBe(true);
    expect(
      packageSurfacePolicy.allowedMcpDataPaths.has(
        "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
      ),
    ).toBe(true);
    expect(
      packageSurfacePolicy.allowedMcpDataPaths.has(
        "data/pangoscript/control-reference/mcp-control-reference/property-controls.json",
      ),
    ).toBe(true);
  });

  it("keeps build:knowledge usable when optional maintainer command exports are absent", () => {
    const generateKnowledgeBase = readFile("scripts/knowledge/generateKnowledgeBase.ts");

    expect(generateKnowledgeBase).toContain("data/pangoscript/commands.generated.json");
  });

  it("keeps tracked text files free of private source strings", () => {
    const leaks = listTrackedTextFiles().flatMap((relativePath) =>
      findPublicArtifactLeaks(readFile(relativePath)).map((leak) => `${relativePath}: ${leak.label}`),
    );

    expect(leaks).toEqual([]);
  }, 30_000);

  it("keeps command-reference examples rendered as markdown code blocks", () => {
    const issues = listTrackedTextFiles()
      .filter((relativePath) => relativePath.startsWith("docs/references/beyond/pangoscript/command-reference/"))
      .filter((relativePath) => relativePath.endsWith(".md"))
      .flatMap((relativePath) => findMarkdownExampleIndentIssues(relativePath, readFile(relativePath)));

    expect(issues).toEqual([]);
  });
});

function readFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function listTrackedTextFiles(): string[] {
  return listTrackedFiles().filter(
    (relativePath) => !/\.(?:gif|ico|jpg|jpeg|pdf|png|tgz|vsix|webp|zip)$/i.test(relativePath),
  );
}

function listTrackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((relativePath) => existsSync(path.join(repoRoot, relativePath)));
}

function findMarkdownExampleIndentIssues(relativePath: string, content: string): string[] {
  const issues: string[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== "Example:") continue;

    for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const trimmed = line.trim();
      if (trimmed === "") continue;
      if (
        /^(?:#{2,3}\s|Parameters:|Evidence note:|Readback:|Readback paths:|Property mapping:|Safety:|Related:)/.test(
          trimmed,
        )
      )
        break;

      const leadingSpaces = line.match(/^( *)/)?.[1].length ?? 0;
      if (leadingSpaces < 4) {
        issues.push(`${relativePath}:${lineIndex + 1}: example code line must use four leading spaces`);
      }
    }
  }
  return issues;
}
