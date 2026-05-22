import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const approvedRootFiles = [
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".markdownlint-cli2.jsonc",
  ".markdownlint.json",
  ".vscode-test.mjs",
  ".vscodeignore",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "NOTICE.md",
  "README.md",
  "biome.json",
  "language-configuration.json",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "tsconfig.test.json",
  "vitest.config.ts",
];

const approvedConfigFiles = ["config/dependency-cruiser.cjs", "config/knip.json"];

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean).sort();
}

describe("root file policy", () => {
  it("keeps tracked root files on the approved repository surface", () => {
    const rootFiles = trackedFiles().filter((file) => !file.includes("/"));

    expect(rootFiles).toEqual(approvedRootFiles);
  });

  it("keeps script-addressed audit configuration under config", () => {
    const configFiles = trackedFiles().filter((file) => file.startsWith("config/"));

    expect(configFiles).toEqual(approvedConfigFiles);
  });
});
