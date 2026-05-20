import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type BeyondCategoryTree,
  parseDocFrontmatter,
  validateDocCategories,
} from "../../src/knowledge/categoryResolution";

describe("parseDocFrontmatter", () => {
  it("reads category and order from a typical reference doc", () => {
    const md = [
      "---",
      "category: Cue clicking",
      "order: 2",
      "---",
      "# Cue clicking",
      "",
      "### StartCue",
      "Body of the entry.",
      "### StartCueMulti",
      "More body.",
    ].join("\n");
    const parsed = parseDocFrontmatter(md);
    expect(parsed.category).toBe("Cue clicking");
    expect(parsed.order).toBe(2);
    expect(parsed.headings).toEqual(["StartCue", "StartCueMulti"]);
  });

  it("returns null category when frontmatter missing", () => {
    const md = "# A doc\n\n### SomeCmd";
    const parsed = parseDocFrontmatter(md);
    expect(parsed.category).toBeUndefined();
    expect(parsed.headings).toEqual(["SomeCmd"]);
  });

  it("ignores ## (section) headings - only ### are commands", () => {
    const md = ["---", "category: FX", "order: 14", "---", "# FX", "", "## Bulk", "", "### StopFX"].join("\n");
    const parsed = parseDocFrontmatter(md);
    expect(parsed.headings).toEqual(["StopFX"]);
  });
});

describe("validateDocCategories", () => {
  const tree: BeyondCategoryTree = {
    categories: [
      { name: "Cue clicking", order: 2, items: [] },
      { name: "FX", order: 14, items: [] },
    ],
  };

  it("succeeds when every doc category matches a tree category", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-doc-test-"));
    try {
      writeFileSync(join(dir, "cue-clicking.md"), "---\ncategory: Cue clicking\norder: 2\n---\n# Cue clicking\n");
      writeFileSync(join(dir, "fx.md"), "---\ncategory: FX\norder: 14\n---\n# FX\n");
      const errors = validateDocCategories(dir, tree);
      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports docs whose category is not in the tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-doc-test-"));
    try {
      writeFileSync(join(dir, "wrong.md"), "---\ncategory: Bogus\norder: 99\n---\n# Wrong\n");
      const errors = validateDocCategories(dir, tree);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Bogus");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports docs whose order does not match the category tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-doc-test-"));
    try {
      writeFileSync(join(dir, "cue-clicking.md"), "---\ncategory: Cue clicking\norder: 99\n---\n# Cue clicking\n");
      const errors = validateDocCategories(dir, tree);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("order 99");
      expect(errors[0]).toContain("category order 2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports duplicate doc files for the same BEYOND category", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-doc-test-"));
    try {
      writeFileSync(join(dir, "cue-clicking-a.md"), "---\ncategory: Cue clicking\norder: 2\n---\n# Cue clicking\n");
      writeFileSync(
        join(dir, "cue-clicking-b.md"),
        "---\ncategory: Cue clicking\norder: 2\n---\n# Cue clicking again\n",
      );
      const errors = validateDocCategories(dir, tree);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("duplicates");
      expect(errors[0]).toContain("cue-clicking-a.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
