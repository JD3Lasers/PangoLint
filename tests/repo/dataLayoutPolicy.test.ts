import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const planPath = path.join(repoRoot, "docs", "runbooks", "data-layout-policy.md");
const emDash = String.fromCharCode(0x2014);

describe("data layout policy", () => {
  it("documents active data groups, consumers, and package surfaces", () => {
    const plan = readFile(planPath);

    for (const text of [
      "Issue #519",
      "Current Data Inventory",
      "Target Layout",
      "Proposed Move Plan",
      "Retirement Rules",
      "Validation Commands",
      "data/pangoscript/control-reference/package-policy.json",
      "scripts/package/copyMcpData.cjs",
      "scripts/package/verifyPackageContents.ts",
      "mcp/data/",
    ]) {
      expect(plan, text).toContain(text);
    }

    for (const status of ["Active generated data", "Active generated input", "Local build or scratch output"]) {
      expect(plan, status).toContain(status);
    }
  });

  it("names validation commands before future data moves", () => {
    const plan = readFile(planPath);

    for (const command of [
      "npm run build:knowledge",
      "npm run verify:package",
      "npm --workspace mcp run verify:tarball",
      "npm run check",
      "npm ci",
    ]) {
      expect(plan, command).toContain(command);
    }
  });

  it("documents retired-file removal without requiring an archive index", () => {
    const plan = readFile(planPath);

    expect(plan).toContain("Only then remove the old file or folder.");
    expect(plan).toContain("The PR or issue must name the original path");
  });

  it("keeps new policy docs free of long dash characters", () => {
    expect(readFile(planPath)).not.toContain(emDash);
  });
});

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}
