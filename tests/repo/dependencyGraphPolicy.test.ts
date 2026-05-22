import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = require("../../package.json") as {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const dependencyCruiserConfigPath = path.join(process.cwd(), "config", "dependency-cruiser.cjs");

describe("dependency graph policy", () => {
  it("provides a repeatable import boundary audit", () => {
    expect(packageJson.devDependencies).toHaveProperty("dependency-cruiser");
    expect(packageJson.scripts?.["audit:imports"]).toBe(
      "dependency-cruise --config config/dependency-cruiser.cjs src mcp/src tests scripts",
    );
    expect(packageJson.scripts?.["graph:imports"]).toBe(
      "dependency-cruise --config config/dependency-cruiser.cjs --output-type mermaid src mcp/src tests scripts",
    );
    expect(packageJson.scripts?.["check:public"]).toContain("npm run audit:imports");
    expect(packageJson.scripts?.check).toContain("npm run check:public");
    expect(existsSync(dependencyCruiserConfigPath), "config/dependency-cruiser.cjs").toBe(true);
    expect(readFileSync(path.join(process.cwd(), ".vscodeignore"), "utf8")).toContain("config/**");
  });

  it("names the enforced source boundaries", () => {
    const config = require("../../config/dependency-cruiser.cjs") as {
      forbidden?: Array<{ name?: string; to?: { path?: string; pathNot?: string[] } }>;
    };
    const ruleNames = (config.forbidden ?? []).map((rule) => rule.name).sort();
    const mcpSourceRule = config.forbidden?.find((rule) => rule.name === "mcp-imports-vsix-source-through-mcp-exports");

    expect(ruleNames).toContain("mcp-imports-vsix-source-through-mcp-exports");
    expect(ruleNames).toContain("vsix-source-does-not-import-mcp-source");
    expect(ruleNames).toContain("browser-code-does-not-import-node-builtins");
    expect(ruleNames).toContain("source-does-not-import-build-output");
    expect(mcpSourceRule?.to?.path).toBe("^src/");
    expect(mcpSourceRule?.to?.pathNot).toEqual([
      "^src/knowledge/mcpKnowledgeExports\\.ts$",
      "^src/language/mcpLanguageExports\\.ts$",
      "^src/runtime/mcpRuntimeExports\\.ts$",
    ]);
  });
});
