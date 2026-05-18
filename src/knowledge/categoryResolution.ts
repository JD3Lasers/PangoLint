// src/knowledge/categoryResolution.ts
//
// BEYOND command-tree → canonical category resolution. Single source of
// truth lives in data/pangoscript/beyond-category-tree.json; this module
// is a pure function over that data plus the overlay (handled by callers).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface BeyondCategoryTreeItem {
  label: string;
  canonical?: string;
  primary?: boolean;
  crossref?: boolean;
}

export interface BeyondCategoryTreeNode {
  name: string;
  order: number;
  items: BeyondCategoryTreeItem[];
}

export interface BeyondCategoryTree {
  categories: BeyondCategoryTreeNode[];
}

/**
 * Build a `canonical (lowercased) → category name` map from the tree.
 * Excludes items without a canonical and items marked `crossref: true`.
 * For canonicals that appear in multiple items, exactly one must be marked
 * `primary: true`; the function throws if that invariant is violated.
 */
export function resolveCategoryMap(tree: BeyondCategoryTree): Map<string, string> {
  const occurrences = new Map<string, { category: string; primary: boolean }[]>();
  for (const cat of tree.categories) {
    for (const item of cat.items) {
      if (!item.canonical || item.crossref) continue;
      const key = item.canonical.toLowerCase();
      const list = occurrences.get(key) ?? [];
      list.push({ category: cat.name, primary: item.primary === true });
      occurrences.set(key, list);
    }
  }

  const map = new Map<string, string>();
  for (const [canonical, occs] of occurrences) {
    if (occs.length === 1) {
      map.set(canonical, occs[0].category);
      continue;
    }
    const primary = occs.filter((o) => o.primary);
    if (primary.length !== 1) {
      throw new Error(
        `Canonical "${canonical}" appears in ${occs.length} non-crossref items but ${primary.length} are marked primary; expected exactly 1.`,
      );
    }
    map.set(canonical, primary[0].category);
  }
  return map;
}

export function loadCategoryTree(jsonPath: string): BeyondCategoryTree {
  const raw = readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<BeyondCategoryTree>;
  if (!Array.isArray(parsed.categories)) {
    throw new Error(`${jsonPath}: missing or non-array "categories" field`);
  }
  for (const cat of parsed.categories) {
    if (typeof cat.name !== "string" || cat.name.length === 0) {
      throw new Error(`${jsonPath}: category missing "name"`);
    }
    if (typeof cat.order !== "number") {
      throw new Error(`${jsonPath}: category "${cat.name}" missing numeric "order"`);
    }
    if (!Array.isArray(cat.items)) {
      throw new Error(`${jsonPath}: category "${cat.name}" missing "items" array`);
    }
  }
  return parsed as BeyondCategoryTree;
}

/**
 * The set of legal category names (string-equal to a tree category name).
 * Used by overlay/doc validation to reject misspelled categories.
 */
export function categoryNames(tree: BeyondCategoryTree): Set<string> {
  return new Set(tree.categories.map((c) => c.name));
}

export interface ResolvedCategory {
  category: string | undefined;
  source: "overlay" | "tree" | "unresolved";
}

export function resolveCommandCategory(
  canonical: string,
  overlayCategory: string | undefined,
  treeMap: Map<string, string>,
): ResolvedCategory {
  if (overlayCategory && overlayCategory.length > 0) {
    return { category: overlayCategory, source: "overlay" };
  }
  const tree = treeMap.get(canonical.toLowerCase());
  if (tree) return { category: tree, source: "tree" };
  return { category: undefined, source: "unresolved" };
}

/**
 * Validate that every `category` value present in the overlay map refers to a
 * real BEYOND category tree name (exact, case-sensitive match).
 * Returns an array of human-readable error strings; empty means valid.
 */
export function validateOverlayCategories(
  overlayCategories: Record<string, string | undefined>,
  tree: BeyondCategoryTree,
): string[] {
  const valid = categoryNames(tree);
  const errors: string[] = [];
  for (const [canonical, category] of Object.entries(overlayCategories)) {
    if (!category) continue;
    if (!valid.has(category)) {
      errors.push(
        `Overlay command "${canonical}" has unknown category "${category}". ` +
          `Must be one of: ${[...valid].join(", ")}`,
      );
    }
  }
  return errors;
}

export interface ParsedDoc {
  category?: string;
  order?: number;
  headings: string[];
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

export function parseDocFrontmatter(markdown: string): ParsedDoc {
  let category: string | undefined;
  let order: number | undefined;
  const fmMatch = markdown.match(FRONTMATTER_RE);
  if (fmMatch) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      const [, key, value] = m;
      if (key === "category") category = value.trim();
      else if (key === "order") order = Number.parseInt(value.trim(), 10);
    }
  }
  const body = fmMatch ? markdown.slice(fmMatch[0].length) : markdown;
  const headings: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (!h) continue;
    for (const part of h[1]
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean)) {
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(part)) headings.push(part);
    }
  }
  return { category, order, headings };
}

/**
 * Strict (fail-fast) resolver. Resolves all canonicals against overlay +
 * tree and throws if any remain unresolved. Use this in the build pipeline
 * after all overlay patches are in place.
 */
export function resolveCategoriesStrict(
  canonicals: string[],
  overlayCategories: Record<string, string | undefined>,
  tree: BeyondCategoryTree,
): Map<string, string> {
  const treeMap = resolveCategoryMap(tree);
  const result = new Map<string, string>();
  const unresolved: string[] = [];
  for (const c of canonicals) {
    const r = resolveCommandCategory(c, overlayCategories[c], treeMap);
    if (r.category) result.set(c, r.category);
    else unresolved.push(c);
  }
  if (unresolved.length > 0) {
    throw new Error(`Unresolved categories for ${unresolved.length} command(s):\n  ${unresolved.sort().join("\n  ")}`);
  }
  return result;
}

/**
 * Meta-docs that are not command reference files and do not carry a
 * BEYOND-aligned `category` frontmatter. These are intentionally excluded
 * from doc-category validation.
 */
const META_FILES = new Set(["README.md"]);

export function validateDocCategories(dir: string, tree: BeyondCategoryTree): string[] {
  const valid = categoryNames(tree);
  const orderByCategory = new Map(tree.categories.map((cat) => [cat.name, cat.order]));
  const categoryToFile = new Map<string, string>();
  const errors: string[] = [];
  const entries = readdirSync(dir).filter((f) => f.endsWith(".md"));
  for (const filename of entries) {
    if (META_FILES.has(filename)) continue;
    const md = readFileSync(join(dir, filename), "utf8");
    const parsed = parseDocFrontmatter(md);
    if (!parsed.category) {
      errors.push(`${filename}: missing 'category' in YAML frontmatter`);
      continue;
    }
    if (!valid.has(parsed.category)) {
      errors.push(`${filename}: category "${parsed.category}" is not a BEYOND tree category`);
      continue;
    }
    const existingFile = categoryToFile.get(parsed.category);
    if (existingFile) {
      errors.push(`${filename}: category "${parsed.category}" duplicates ${existingFile}`);
    } else {
      categoryToFile.set(parsed.category, filename);
    }
    const expectedOrder = orderByCategory.get(parsed.category);
    if (parsed.order === undefined || Number.isNaN(parsed.order)) {
      errors.push(`${filename}: missing numeric 'order' in YAML frontmatter`);
    } else if (expectedOrder !== undefined && parsed.order !== expectedOrder) {
      errors.push(`${filename}: order ${parsed.order} does not match BEYOND category order ${expectedOrder}`);
    }
  }
  return errors;
}

/**
 * Validate that every `### CommandName` heading in the doc files
 * appears in the resolved catalog (catalog gap detection).
 * Returns human-readable error strings; empty means valid.
 */
export function validateDocHeadingsInCatalog(dir: string, catalogCanonicals: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const entries = readdirSync(dir).filter((f) => f.endsWith(".md"));
  for (const filename of entries) {
    if (META_FILES.has(filename)) continue;
    const md = readFileSync(join(dir, filename), "utf8");
    const { headings } = parseDocFrontmatter(md);
    for (const heading of headings) {
      if (!catalogCanonicals.has(heading)) {
        errors.push(`${filename}: heading '${heading}' not in catalog`);
      }
    }
  }
  return errors;
}

/**
 * Validate that each catalog command appears in the doc file whose
 * `category:` frontmatter matches the command's resolved category
 * (category drift detection). Returns human-readable error strings.
 */
export function validateDocCategoryPlacement(dir: string, resolvedCategories: ReadonlyMap<string, string>): string[] {
  // Build map: canonical → distinct doc filenames that contain its heading.
  // Repeated headings inside one file are allowed for command families whose
  // individual entries share a combined heading, but cross-file duplicates
  // make placement nondeterministic and must fail the build.
  const headingToFiles = new Map<string, Set<string>>();
  const entries = readdirSync(dir).filter((f) => f.endsWith(".md"));
  for (const filename of entries) {
    if (META_FILES.has(filename)) continue;
    const md = readFileSync(join(dir, filename), "utf8");
    const { headings } = parseDocFrontmatter(md);
    for (const heading of headings) {
      const files = headingToFiles.get(heading) ?? new Set<string>();
      files.add(filename);
      headingToFiles.set(heading, files);
    }
  }

  // Build map: category name → doc filename (via frontmatter).
  const categoryToFile = new Map<string, string>();
  for (const filename of entries) {
    if (META_FILES.has(filename)) continue;
    const md = readFileSync(join(dir, filename), "utf8");
    const { category } = parseDocFrontmatter(md);
    if (category) categoryToFile.set(category, filename);
  }

  const errors: string[] = [];
  for (const [canonical, category] of resolvedCategories) {
    const correctFile = categoryToFile.get(category);
    const actualFiles = headingToFiles.get(canonical);
    if (!correctFile) {
      errors.push(`${canonical} resolves to category "${category}" but no command-reference file has that category`);
      continue;
    }
    if (actualFiles && actualFiles.size > 1) {
      errors.push(
        `${canonical} appears in multiple command-reference docs: ${[...actualFiles].sort().join(", ")}; expected only ${correctFile}`,
      );
      continue;
    }
    const actualFile = actualFiles ? [...actualFiles][0] : undefined;
    if (!actualFile) {
      errors.push(`${canonical} is missing from command-reference docs; expected heading in ${correctFile}`);
      continue;
    }
    if (actualFile !== correctFile) {
      errors.push(`${canonical} appears in ${actualFile} but should be in ${correctFile} (category: "${category}")`);
    }
  }
  return errors;
}
