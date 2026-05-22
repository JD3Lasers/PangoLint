import { describe, expect, it } from "vitest";

const policy = require("../../scripts/package/packageSurfacePolicy.cjs") as {
  allowedMcpDataPaths: Set<string>;
  expectedVsixPackagePaths: string[];
  forbiddenMcpDataPrefixes: Array<[string, string]>;
  forbiddenVsixDataPrefixes: string[];
  isApprovedMcpAssetPath: (relativePath: string) => boolean;
  findForbiddenPackagePathLabels: (relativePath: string) => string[];
};

describe("package surface policy", () => {
  it("names the approved VSIX and MCP runtime data surfaces", () => {
    expect(policy.expectedVsixPackagePaths).toContain("data/pangoscript/commands.merged.json");
    expect(policy.expectedVsixPackagePaths).toContain(
      "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
    );
    expect(
      policy.allowedMcpDataPaths.has("data/pangoscript/control-reference/mcp-control-reference/property-controls.json"),
    ).toBe(true);
  });

  it("blocks maintainer-only Object Tree data from public packages", () => {
    expect(policy.isApprovedMcpAssetPath("data/pangoscript/object-tree/source-facts/object-paths.json")).toBe(false);
    expect(policy.isApprovedMcpAssetPath("data/pangoscript/object-tree/evidence/value/example.json")).toBe(false);
    expect(policy.findForbiddenPackagePathLabels("data/pangoscript/object-tree/audits/readback/report.json")).toContain(
      "Object Tree audit output",
    );
  });
});
