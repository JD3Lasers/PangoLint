import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const specPath = path.join(repoRoot, "docs", "specs", "2026-05-17-repo-architecture-baseline.md");
const emDash = String.fromCharCode(0x2014);

describe("repo architecture baseline", () => {
  it("documents required repo areas and package staging roles", () => {
    const spec = readFile(specPath);

    for (const text of [
      "Status: Governing source of truth",
      "Top-Level Folder Map",
      "VS Code Extension Source Map",
      "MCP Workspace Source Map",
      "PangoScript Data Map",
      "Ignored Local Input And Generated Artifact Policy",
      "Nonconforming Path Register",
      "`src/`",
      "`mcp/`",
      "`data/pangoscript/`",
      "`docs/specs/`",
      "`docs/runbooks/`",
      "`mcp/data/`",
      "`mcp/docs/`",
      "`mcp/LICENSE`",
      "`src/reference/README.md`",
      "`src/test/README.md`",
      "`tests/repo/sourceLayout.test.ts`",
    ]) {
      expect(spec, text).toContain(text);
    }
  });

  it("records data cleanup rules for active Object Tree metadata", () => {
    const spec = readFile(specPath);

    for (const text of [
      "source facts",
      "generated runtime indexes",
      "package projections",
      "evidence",
      "audit outputs",
      "optional maintainer input",
      "Retired tracked paths",
      "`object-tree/source-facts/value-metadata/zone/visualization-id-range.json`",
      "Active but non-final",
      "Do not move remaining Object Tree metadata",
      "replacement path",
      "tests prove old paths are unused",
    ]) {
      expect(spec, text).toContain(text);
    }
  });

  it("keeps the architecture spec free of long dash characters", () => {
    expect(readFile(specPath)).not.toContain(emDash);
  });
});

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}
