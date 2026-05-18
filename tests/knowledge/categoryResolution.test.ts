import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type BeyondCategoryTree,
  resolveCategoriesStrict,
  resolveCategoryMap,
  resolveCommandCategory,
  validateDocCategories,
  validateDocCategoryPlacement,
  validateDocHeadingsInCatalog,
  validateOverlayCategories,
} from "../../src/knowledge/categoryResolution";

const fixtureTree: BeyondCategoryTree = {
  categories: [
    {
      name: "General",
      order: 1,
      items: [{ label: "Blackout", canonical: "BlackOut" }],
    },
    {
      name: "Cue clicking",
      order: 2,
      items: [
        { label: "Start cue", canonical: "StartCue" },
        { label: "Stop cue", canonical: "StopCue" },
      ],
    },
    {
      name: "Main toolbar",
      order: 4,
      items: [{ label: 'Click "Transition" button', canonical: "Transition", crossref: true }],
    },
    {
      name: "Transition",
      order: 5,
      items: [{ label: "Enable Transition", canonical: "Transition", primary: true }],
    },
  ],
};

describe("resolveCategoryMap", () => {
  it("maps single-occurrence canonicals to their parent category", () => {
    const map = resolveCategoryMap(fixtureTree);
    expect(map.get("blackout")).toBe("General");
    expect(map.get("startcue")).toBe("Cue clicking");
    expect(map.get("stopcue")).toBe("Cue clicking");
  });

  it("maps multi-occurrence canonicals to the primary item's parent category", () => {
    const map = resolveCategoryMap(fixtureTree);
    expect(map.get("transition")).toBe("Transition");
  });

  it("ignores crossref items when resolving", () => {
    const map = resolveCategoryMap(fixtureTree);
    expect(map.get("transition")).not.toBe("Main toolbar");
  });

  it("does not include items without a canonical", () => {
    const treeWithDead: BeyondCategoryTree = {
      categories: [
        {
          name: "How to stop?",
          order: 3,
          items: [{ label: "Stop Projector by name" }],
        },
      ],
    };
    const map = resolveCategoryMap(treeWithDead);
    expect(map.size).toBe(0);
  });
});

describe("resolveCommandCategory", () => {
  const tree: BeyondCategoryTree = {
    categories: [
      {
        name: "General",
        order: 1,
        items: [{ label: "Blackout", canonical: "BlackOut" }],
      },
      {
        name: "FX",
        order: 14,
        items: [{ label: "Stop FX", canonical: "StopFX" }],
      },
    ],
  };
  const map = resolveCategoryMap(tree);

  it("returns the tree-resolved category for in-tree canonicals", () => {
    expect(resolveCommandCategory("BlackOut", undefined, map)).toEqual({
      category: "General",
      source: "tree",
    });
  });

  it("overlay wins over tree", () => {
    expect(resolveCommandCategory("BlackOut", "Code", map)).toEqual({ category: "Code", source: "overlay" });
  });

  it("returns undefined category when neither overlay nor tree resolves", () => {
    expect(resolveCommandCategory("UnknownCmd", undefined, map)).toEqual({
      category: undefined,
      source: "unresolved",
    });
  });
});

describe("validateOverlayCategories", () => {
  const tree: BeyondCategoryTree = {
    categories: [
      { name: "General", order: 1, items: [] },
      { name: "FX", order: 14, items: [] },
    ],
  };

  it("accepts categories that match a tree name", () => {
    const errors = validateOverlayCategories({ Foo: "General", Bar: "FX" }, tree);
    expect(errors).toEqual([]);
  });

  it("rejects categories that do not match any tree name", () => {
    const errors = validateOverlayCategories(
      { Foo: "Other", Bar: "general" }, // wrong case
      tree,
    );
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("Foo");
    expect(errors[1]).toContain("Bar");
  });
});

describe("resolveCategoriesStrict", () => {
  const tree: BeyondCategoryTree = {
    categories: [{ name: "General", order: 1, items: [{ label: "Blackout", canonical: "BlackOut" }] }],
  };
  it("returns map for resolved commands", () => {
    const result = resolveCategoriesStrict(["BlackOut"], {}, tree);
    expect(result).toBeInstanceOf(Map);
    expect(result.get("BlackOut")).toBe("General");
  });
  it("throws with the unresolved canonicals listed", () => {
    expect(() => resolveCategoriesStrict(["UnknownA", "UnknownB"], {}, tree)).toThrow(/UnknownA[\s\S]*UnknownB/);
  });
});

describe("validateDocCategories — META_FILES skip", () => {
  const tree: BeyondCategoryTree = {
    categories: [{ name: "General", order: 1, items: [] }],
  };

  it("skips README.md even if it lacks frontmatter", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "README.md"), "# No frontmatter here\n");
      writeFileSync(join(dir, "01_general.md"), "---\ncategory: General\norder: 1\n---\n### BlackOut\n");
      const errors = validateDocCategories(dir, tree);
      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("still catches missing frontmatter in non-meta files", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "01_general.md"), "# No frontmatter\n");
      const errors = validateDocCategories(dir, tree);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("01_general.md");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("validateDocHeadingsInCatalog", () => {
  it("accepts headings that exist in the catalog", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "01_general.md"), "---\ncategory: General\norder: 1\n---\n### BlackOut\n");
      const errors = validateDocHeadingsInCatalog(dir, new Set(["BlackOut"]));
      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("errors when a heading is not in the catalog", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "01_general.md"), "---\ncategory: General\norder: 1\n---\n### GhostCommand\n");
      const errors = validateDocHeadingsInCatalog(dir, new Set(["BlackOut"]));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("01_general.md");
      expect(errors[0]).toContain("GhostCommand");
      expect(errors[0]).toContain("not in catalog");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("skips README.md", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "README.md"), "### NotInCatalog\n");
      const errors = validateDocHeadingsInCatalog(dir, new Set(["BlackOut"]));
      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("validateDocCategoryPlacement", () => {
  it("accepts commands that appear in the correct doc file", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "01_general.md"), "---\ncategory: General\norder: 1\n---\n### BlackOut\n");
      const errors = validateDocCategoryPlacement(dir, new Map([["BlackOut", "General"]]));
      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("errors when a command heading appears in the wrong doc file", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      // BlackOut heading lives in fx.md but its resolved category is "General" → should be 01_general.md
      writeFileSync(join(dir, "01_general.md"), "---\ncategory: General\norder: 1\n---\n");
      writeFileSync(join(dir, "fx.md"), "---\ncategory: FX\norder: 14\n---\n### BlackOut\n");
      const errors = validateDocCategoryPlacement(dir, new Map([["BlackOut", "General"]]));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("BlackOut");
      expect(errors[0]).toContain("fx.md");
      expect(errors[0]).toContain("01_general.md");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("errors when a command heading appears in multiple doc files", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "01_general.md"), "---\ncategory: General\norder: 1\n---\n### BlackOut\n");
      writeFileSync(join(dir, "fx.md"), "---\ncategory: FX\norder: 14\n---\n### BlackOut\n");
      const errors = validateDocCategoryPlacement(dir, new Map([["BlackOut", "General"]]));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("BlackOut");
      expect(errors[0]).toContain("multiple command-reference docs");
      expect(errors[0]).toContain("01_general.md");
      expect(errors[0]).toContain("fx.md");
      expect(errors[0]).toContain("expected only 01_general.md");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("allows repeated command headings within the same doc file", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(
        join(dir, "01_general.md"),
        "---\ncategory: General\norder: 1\n---\n### BlackOut\n\n### BlackOut\n",
      );
      const errors = validateDocCategoryPlacement(dir, new Map([["BlackOut", "General"]]));
      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("errors when a resolved command has no doc heading", () => {
    const dir = mkdtempSync(join(tmpdir(), "pangolint-test-"));
    try {
      writeFileSync(join(dir, "01_general.md"), "---\ncategory: General\norder: 1\n---\n");
      const errors = validateDocCategoryPlacement(dir, new Map([["BlackOut", "General"]]));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("BlackOut");
      expect(errors[0]).toContain("missing from command-reference docs");
      expect(errors[0]).toContain("01_general.md");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
