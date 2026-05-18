import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { findPublicArtifactLeaks, findPublicArtifactPathLeaks } from "../../scripts/publicArtifactPolicy";

const repoRoot = process.cwd();

describe("public package path policy", () => {
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
    expect(readFile("scripts/verifyPackageContents.ts")).toContain("findPublicArtifactPathLeaks");

    const copyMcpData = readFile("scripts/copyMcpData.cjs");
    expect(copyMcpData).toContain("assertApprovedMcpAssetPath");
    expect(copyMcpData).toContain("forbiddenMcpAssetPathPatterns");
    expect(copyMcpData).toContain("refused maintainer-only asset path");
  });

  it("pins VSIX data packaging to the approved runtime and reference surface", () => {
    const verifyPackageContents = readFile("scripts/verifyPackageContents.ts");
    const vscodeignore = readFile(".vscodeignore");

    expect(verifyPackageContents).toContain("unapprovedVsixDataPrefixes");
    expect(verifyPackageContents).toContain("data/pangoscript/control-reference/");
    expect(verifyPackageContents).toContain("data/pangoscript/object-behavior-audits/");
    expect(verifyPackageContents).toContain("data/pangoscript/object-tree/source-facts/");
    expect(verifyPackageContents).toContain("data/pangoscript/object-tree/evidence/");
    expect(verifyPackageContents).toContain("data/pangoscript/object-tree/audits/");
    expect(verifyPackageContents).toContain("data/pangoscript/object-tree/package-projections/");
    expect(verifyPackageContents).toContain("data/pangoscript/object-tree/runtime-indexes/known-properties.json");
    expect(verifyPackageContents).toContain("data/pangoscript/object-tree/runtime-indexes/object-property-index.json");
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
    const copyMcpData = readFile("scripts/copyMcpData.cjs");
    const verifyMcpPackageContents = readFile("scripts/verifyMcpPackageContents.cjs");

    expect(packageJson).toContain("verifyMcpPackageContents.cjs");
    expect(copyMcpData).toContain("assertApprovedMcpAssetPath");
    expect(copyMcpData).toContain("data/pangoscript/object-tree/source-facts/");
    expect(copyMcpData).toContain("data/pangoscript/object-tree/evidence/");
    expect(copyMcpData).toContain("data/pangoscript/object-tree/audits/");
    expect(copyMcpData).toContain("data/pangoscript/object-tree/package-projections/");
    expect(verifyMcpPackageContents).toContain("allowedMcpDataPaths");
    expect(verifyMcpPackageContents).toContain("data/pangoscript/object-tree/runtime-indexes/known-properties.json");
    expect(verifyMcpPackageContents).toContain(
      "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
    );
    expect(verifyMcpPackageContents).toContain(
      "data/pangoscript/control-reference/mcp-control-reference/property-controls.json",
    );
    expect(verifyMcpPackageContents).toContain("data/pangoscript/object-tree/source-facts/");
    expect(verifyMcpPackageContents).toContain("data/pangoscript/object-tree/evidence/");
    expect(verifyMcpPackageContents).toContain("data/pangoscript/object-tree/audits/");
    expect(verifyMcpPackageContents).toContain("data/pangoscript/object-tree/package-projections/");
  });

  it("keeps build:knowledge usable when optional maintainer command exports are absent", () => {
    const generateKnowledgeBase = readFile("scripts/generateKnowledgeBase.ts");

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
