import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("MCP package asset copier", () => {
  it("includes reference docs needed by script-writing agents", () => {
    const script = readFileSync(path.join(repoRoot, "scripts", "copyMcpData.cjs"), "utf8");

    expect(script).toContain("data/pangoscript/command-property-coverage.json");
    expect(script).toContain("data/pangoscript/object-tree/runtime-indexes/known-properties.json");
    expect(script).toContain("data/pangoscript/object-tree/runtime-indexes/object-property-index.json");
    expect(script).not.toContain("data/pangoscript/known-properties.json");
    expect(script).not.toContain("data/pangoscript/object-property-index.json");
    expect(script).toContain("data/pangoscript/control-reference/mcp-control-reference");
    expect(script).toContain("data/pangoscript/control-reference/package-policy.json");
    expect(script).not.toContain('"data/pangoscript/control-reference"');
    expect(script).not.toContain("data/pangoscript/control-reference/control-crosswalk");
    expect(script).not.toContain("data/pangoscript/control-reference/object-control-reference");
    expect(script).not.toContain("data/pangoscript/control-reference/osc-control-reference");
    expect(script).not.toContain("data/pangoscript/control-reference/command-control-reference");
    expect(script).toContain("docs/references/beyond/pangoscript/command-reference");
    expect(script).toContain("docs/references/beyond/pangoscript/master-object-tree.md");
    expect(script).toContain("docs/references/beyond/pangoscript/object-model.md");
    expect(script).toContain("assertApprovedMcpAssetPath");
    expect(script).toContain("refused maintainer-only asset path");
    expect(script).toContain("data/pangoscript/object-tree/source-facts/");
    expect(script).toContain("data/pangoscript/object-tree/evidence/");
    expect(script).toContain("data/pangoscript/object-tree/audits/");
    expect(script).toContain("data/pangoscript/object-tree/package-projections/");
  });

  it("verifies the MCP tarball data surface after assets are copied", () => {
    const packageJson = readFileSync(path.join(repoRoot, "mcp", "package.json"), "utf8");
    const verifier = readFileSync(path.join(repoRoot, "scripts", "verifyMcpPackageContents.cjs"), "utf8");

    expect(packageJson).toContain("verifyMcpPackageContents.cjs");
    expect(verifier).toContain("allowedMcpDataPaths");
    expect(verifier).toContain("data/pangoscript/object-tree/runtime-indexes/object-property-index.json");
    expect(verifier).toContain("data/pangoscript/object-tree/source-facts/");
    expect(verifier).toContain("data/pangoscript/object-tree/evidence/");
    expect(verifier).toContain("data/pangoscript/object-tree/audits/");
    expect(verifier).toContain("data/pangoscript/object-tree/package-projections/");
  });
});
