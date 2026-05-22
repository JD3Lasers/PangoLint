import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = require("../../package.json") as {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type KnipWorkspaceConfig = {
  entry?: string[];
  project?: string[];
};

type KnipConfig = {
  ignoreIssues?: Record<string, string[]>;
  rules?: Record<string, string>;
  treatConfigHintsAsErrors?: boolean;
  workspaces?: Record<string, KnipWorkspaceConfig>;
};

const knipConfigPath = path.join(process.cwd(), "config", "knip.json");

describe("unused code audit policy", () => {
  it("provides a repeatable unused-code audit without adding it to the full gate", () => {
    expect(packageJson.devDependencies).toHaveProperty("knip");
    expect(packageJson.scripts?.["audit:unused"]).toBe("knip --config config/knip.json --reporter compact");
    expect(packageJson.scripts?.check ?? "").not.toContain("audit:unused");
    expect(existsSync(knipConfigPath), "config/knip.json").toBe(true);
    expect(readFileSync(path.join(process.cwd(), ".vscodeignore"), "utf8")).toContain("config/**");
  });

  it("names the VSIX, MCP, test, script, and workflow audit surfaces", () => {
    const config = JSON.parse(readFileSync(knipConfigPath, "utf8")) as KnipConfig;
    const rootWorkspace = config.workspaces?.["."];

    expect(rootWorkspace?.entry).toEqual(
      expect.arrayContaining([
        ".vscode-test.mjs",
        "src/test/runTests.ts",
        "tests/**/*.test.ts",
        ".github/workflows/*.yml",
      ]),
    );
    expect(rootWorkspace?.project).toEqual(
      expect.arrayContaining(["src/**/*.ts", "scripts/**/*.ts", "scripts/**/*.cjs", "tests/**/*.ts"]),
    );
    expect(config.workspaces?.mcp).toBeDefined();
    expect(config.workspaces?.mcp?.project).toEqual(expect.arrayContaining(["src/**/*.ts", "tests/**/*.ts"]));
    expect(config.treatConfigHintsAsErrors).toBe(true);
    expect(config.rules?.exports ?? "error").toBe("error");
    expect(config.rules?.types ?? "error").toBe("error");
    expect(config.ignoreIssues?.["scripts/package/packageSurfacePolicy.cjs"]).toEqual(["exports"]);
  });
});
