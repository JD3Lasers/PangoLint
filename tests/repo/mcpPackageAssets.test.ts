import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const packageSurfacePolicy = require("../../scripts/package/packageSurfacePolicy.cjs") as {
  allowedMcpDataPaths: Set<string>;
  findForbiddenMcpPackagePathLabels: (relativePath: string) => string[];
  mcpAssetDirectories: string[];
  mcpAssetFiles: string[];
};

describe("MCP package asset copier", () => {
  it("includes reference docs needed by script-writing agents", () => {
    const script = readFileSync(path.join(repoRoot, "scripts", "package", "copyMcpData.cjs"), "utf8");

    expect(packageSurfacePolicy.mcpAssetFiles).toContain("data/pangoscript/command-property-coverage.json");
    expect(packageSurfacePolicy.mcpAssetFiles).toContain(
      "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
    );
    expect(packageSurfacePolicy.mcpAssetFiles).toContain(
      "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
    );
    expect(script).not.toContain("data/pangoscript/known-properties.json");
    expect(script).not.toContain("data/pangoscript/object-property-index.json");
    expect(packageSurfacePolicy.mcpAssetDirectories).toContain(
      "data/pangoscript/control-reference/mcp-control-reference",
    );
    expect(packageSurfacePolicy.mcpAssetFiles).toContain("data/pangoscript/control-reference/package-policy.json");
    expect(script).not.toContain('"data/pangoscript/control-reference"');
    expect(packageSurfacePolicy.mcpAssetDirectories).not.toContain(
      "data/pangoscript/control-reference/control-crosswalk",
    );
    expect(packageSurfacePolicy.mcpAssetDirectories).not.toContain(
      "data/pangoscript/control-reference/object-control-reference",
    );
    expect(packageSurfacePolicy.mcpAssetDirectories).not.toContain(
      "data/pangoscript/control-reference/osc-control-reference",
    );
    expect(packageSurfacePolicy.mcpAssetDirectories).not.toContain(
      "data/pangoscript/control-reference/command-control-reference",
    );
    expect(packageSurfacePolicy.mcpAssetDirectories).toContain("docs/references/beyond/pangoscript/command-reference");
    expect(packageSurfacePolicy.mcpAssetFiles).toContain("docs/references/beyond/pangoscript/master-object-tree.md");
    expect(packageSurfacePolicy.mcpAssetFiles).toContain("docs/references/beyond/pangoscript/object-model.md");
    expect(script).toContain("assertApprovedMcpAssetPath");
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
  });

  it("verifies the MCP tarball data surface after assets are copied", () => {
    const packageJson = readFileSync(path.join(repoRoot, "mcp", "package.json"), "utf8");
    const verifier = readFileSync(path.join(repoRoot, "scripts", "package", "verifyMcpPackageContents.cjs"), "utf8");

    expect(packageJson).toContain("verifyMcpPackageContents.cjs");
    expect(verifier).toContain("allowedMcpDataPaths");
    expect(
      packageSurfacePolicy.allowedMcpDataPaths.has(
        "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
      ),
    ).toBe(true);
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
  });
});
