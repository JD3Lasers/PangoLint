import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { version: string };

const docs = [
  ["MCP README", path.join(repoRoot, "mcp", "README.md")],
  ["agent integration runbook", path.join(repoRoot, "docs", "runbooks", "agent-integration.md")],
] as const;

const sourceBuildDocs = [
  ...docs,
  ["manual Markdown", path.join(repoRoot, "docs", "manual.md")],
  ["manual HTML", path.join(repoRoot, "docs", "manual.html")],
] as const;

describe("MCP install docs", () => {
  it.each(docs)("documents GitHub Release and local tarball install paths in %s", (_label, filePath) => {
    const text = readFileSync(filePath, "utf8");
    const tarball = `pangolint-mcp-${packageJson.version}.tgz`;

    expect(text).toContain("GitHub Release");
    expect(text).toContain(`npm install -g ./${tarball}`);
    expect(text).toContain("npm run package:mcp");
    expect(text).toContain(`npm install -g ./mcp/${tarball}`);
    expect(text).toContain("npm install -g pangolint-mcp");
  });

  it.each(sourceBuildDocs)("documents the Node.js 20+ source-build requirement in %s", (_label, filePath) => {
    expect(readFileSync(filePath, "utf8")).toContain("Node.js 20+");
  });
});
