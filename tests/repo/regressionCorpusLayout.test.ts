import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const regressionRoot = path.join(process.cwd(), "docs", "references", "beyond", "pangoscript", "linter-regressions");

function beyondCodeFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir).filter((entry) => entry.endsWith(".BeyondCode"));
}

function callbackLines(text: string, kind: "expected" | "observed"): string[] {
  const re = new RegExp(`^//\\s*PangoLint ${kind} callback:\\s*(.+?)\\s*$`, "gim");
  return [...text.matchAll(re)].map((match) => match[1]);
}

describe("linter regression corpus layout", () => {
  it("keeps pass, fail, advisory, and candidate tiers with the current regression corpus", () => {
    for (const tier of ["pass", "fail", "advisory", "candidate"]) {
      expect(existsSync(path.join(regressionRoot, tier)), `${tier}/`).toBe(true);
    }

    const filesByTier = new Map(
      ["pass", "fail", "advisory", "candidate"].map((tier) => [tier, beyondCodeFiles(path.join(regressionRoot, tier))]),
    );
    const allFiles = [...filesByTier.values()].flat();

    const promotedPassFixtures = [
      "arithmetic-comparison-test.BeyondCode",
      "branch-merge-two-path-test.BeyondCode",
      "comparison-not-equal-test.BeyondCode",
      "conditional-exit-test.BeyondCode",
      "extvalue-editor-default-test.BeyondCode",
      "extvalue-editor-property-assignment-test.BeyondCode",
      "multi-var-declaration-test.BeyondCode",
      "waitformidi-extvalue-test.BeyondCode",
    ];

    for (const fixture of promotedPassFixtures) {
      expect(filesByTier.get("pass")).toContain(fixture);
      expect(filesByTier.get("candidate")).not.toContain(fixture);
    }

    const promotedFailFixtures = ["deltavalue-editor-spaced-property-command-test.BeyondCode"];

    for (const fixture of promotedFailFixtures) {
      expect(filesByTier.get("fail")).toContain(fixture);
      expect(filesByTier.get("candidate")).not.toContain(fixture);
    }
    expect(allFiles).toHaveLength(50);
    expect(new Set(allFiles).size).toBe(allFiles.length);
  });

  it("keeps promoted runtime pass-fixture expected callbacks aligned with observed BEYOND output", () => {
    const acceptedRuntimeDirs = [path.join(regressionRoot, "pass"), path.join(regressionRoot, "advisory")];

    for (const dir of acceptedRuntimeDirs) {
      for (const file of beyondCodeFiles(dir)) {
        const text = readFileSync(path.join(dir, file), "utf8");
        if (!text.includes("BEYOND validation")) continue;

        const expected = callbackLines(text, "expected");
        const observed = callbackLines(text, "observed");

        expect(expected, `${file} expected callbacks`).not.toHaveLength(0);
        expect(observed, `${file} observed callbacks`).toEqual(expected);
      }
    }
  });
});
