import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { PangoKnowledgeBase } from "../../src/knowledge/knowledgeBase";

const repoRoot = process.cwd();
const referenceDir = path.join(repoRoot, "docs", "references", "beyond", "pangoscript", "command-reference");
const mergedPath = path.join(repoRoot, "data", "pangoscript", "commands.merged.json");

describe("PangoScript command reference coverage", () => {
  it("documents every shipped command under a command heading", () => {
    const knowledgeBase = JSON.parse(readFileSync(mergedPath, "utf8")) as PangoKnowledgeBase;
    const referenceFiles = readdirSync(referenceDir)
      .filter((fileName) => fileName.endsWith(".md"))
      .filter((fileName) => fileName !== "README.md")
      .map((fileName) => readFileSync(path.join(referenceDir, fileName), "utf8"));

    const missing = Object.values(knowledgeBase.commands)
      .map((command) => command.canonical)
      .filter((canonical) => !hasCommandHeading(referenceFiles, canonical))
      .sort();

    expect(missing).toEqual([]);
  });

  it("does not carry stale relative links to renamed command-reference files", () => {
    const allReferenceFiles = readdirSync(referenceDir).filter((fileName) => fileName.endsWith(".md"));
    const referenceFiles = allReferenceFiles;
    const headingSlugsByFile = buildHeadingSlugIndex(allReferenceFiles);

    const brokenLinks: string[] = [];
    for (const fileName of referenceFiles) {
      const content = readFileSync(path.join(referenceDir, fileName), "utf8");
      for (const target of relativeMarkdownTargets(content)) {
        const targetPath = path.join(referenceDir, target.filePath);
        if (!existsSync(targetPath)) {
          brokenLinks.push(`${fileName}: ${target.raw}`);
          continue;
        }
        const targetFileName = path.basename(target.filePath);
        if (target.anchor && !headingSlugsByFile.get(targetFileName)?.has(target.anchor.toLowerCase())) {
          brokenLinks.push(`${fileName}: ${target.raw}`);
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });
});

function hasCommandHeading(referenceFiles: string[], canonical: string): boolean {
  const headingPattern = new RegExp(`^###\\s+[^\\n]*\\b${escapeRegex(canonical)}\\b[^\\n]*$`, "m");
  return referenceFiles.some((content) => headingPattern.test(content));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function relativeMarkdownTargets(content: string): Array<{ raw: string; filePath: string; anchor?: string }> {
  const targets: Array<{ raw: string; filePath: string; anchor?: string }> = [];
  const linkPattern = /\[[^\]]+\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g;
  for (;;) {
    const match = linkPattern.exec(content);
    if (!match) break;
    const anchorMatch = /#([^)]+)\)$/.exec(match[0]);
    targets.push({ raw: match[0], filePath: match[1], anchor: anchorMatch?.[1] });
  }
  return targets;
}

function buildHeadingSlugIndex(fileNames: string[]): Map<string, Set<string>> {
  const slugsByFile = new Map<string, Set<string>>();
  for (const fileName of fileNames) {
    const content = readFileSync(path.join(referenceDir, fileName), "utf8");
    const slugs = new Set<string>();
    for (const line of content.split(/\r?\n/)) {
      const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line);
      if (!heading) continue;
      slugs.add(githubMarkdownSlug(heading[1]));
      const commandHeading = /^###\s+(.+?)\s*$/.exec(line);
      if (!commandHeading) continue;
      for (const part of commandHeading[1]
        .split("/")
        .map((value) => value.trim())
        .filter(Boolean)) {
        if (/^[A-Za-z][A-Za-z0-9_]*$/.test(part)) slugs.add(part.toLowerCase());
      }
    }
    slugsByFile.set(fileName, slugs);
  }
  return slugsByFile;
}

function githubMarkdownSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
