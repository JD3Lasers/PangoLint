import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const readRepoFile = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), "utf8");

const manualMarkdown = readRepoFile("docs/manual.md");
const manualHtml = readRepoFile("docs/manual.html");
const publicManuals = [manualMarkdown, manualHtml];

interface PackageManifest {
  version: string;
  contributes: {
    commands: Array<{ command: string }>;
    configuration: { properties: Record<string, unknown> };
  };
}

interface CommandCatalog {
  commands: Record<string, { tags?: string[] }>;
}

describe("user manual content accuracy", () => {
  it("matches current catalog and diagnostic counts", () => {
    const catalog = JSON.parse(readRepoFile("data/pangoscript/commands.merged.json")) as CommandCatalog;
    const hiddenTags = new Set(["prototype", "do-not-use", "internal"]);
    const browsableCommands = Object.values(catalog.commands).filter(
      (entry) => !(entry.tags ?? []).some((tag) => hiddenTags.has(tag.toLowerCase())),
    ).length;
    const expressionFunctions = [...readRepoFile("src/knowledge/expressionFunctions.ts").matchAll(/^\s{4}canonical:/gm)]
      .length;
    const diagnosticCodes = [...readRepoFile("docs/references/diagnostics/README.md").matchAll(/^## [a-z]/gm)].length;

    for (const manual of publicManuals) {
      expect(manual).toContain(`${browsableCommands} PangoScript commands`);
      expect(manual).toContain(`${expressionFunctions} expression functions`);
      expect(manual).toContain(`${diagnosticCodes} diagnostic codes`);
    }
  });

  it("lists every MCP resource and the current tool totals", () => {
    const resourceUris = [
      ...readRepoFile("mcp/src/bundledResourcePaths.ts").matchAll(/"(pangoscript:\/\/[^"]+)"/g),
    ].map((match) => match[1]);
    const toolDefinitions = readRepoFile("mcp/src/tools/toolDefinitions.ts");
    const alwaysTools = [...toolDefinitions.matchAll(/availability: "always"/g)].length;
    const runtimeTools = [...toolDefinitions.matchAll(/availability: "runtime(?:Read|Write)"/g)].length;

    expect(resourceUris).toHaveLength(9);
    for (const manual of publicManuals) {
      expect(manual).toContain(`${resourceUris.length} bundled resources`);
      expect(manual).toContain(`${alwaysTools} offline tools`);
      expect(manual).toContain(`${runtimeTools} tools that talk to the configured BEYOND host`);
      for (const uri of resourceUris) expect(manual).toContain(uri);
    }
  });

  it("covers current settings, commands, version, and review date", () => {
    const manifest = JSON.parse(readRepoFile("package.json")) as PackageManifest;

    for (const setting of Object.keys(manifest.contributes.configuration.properties)) {
      expect(manualMarkdown).toContain(`\`${setting}\``);
      expect(manualHtml).toContain(`<code>${setting}</code>`);
    }
    for (const command of manifest.contributes.commands) {
      expect(manualMarkdown).toContain(`| \`${command.command}\` |`);
      expect(manualHtml).toContain(`<code>${command.command}</code>`);
    }
    for (const manual of publicManuals) {
      expect(manual).toContain(manifest.version);
    }
    expect(manualHtml).toContain("<dd>2026-07-22</dd>");
  });

  it("avoids internal planning language in public prose", () => {
    const discouragedPhrases = [
      "everything the project ships",
      "load-bearing developer behavior",
      "runtime oracle",
      "developer-local",
      "canonical",
      "hallucinated names",
    ];

    for (const manual of publicManuals) {
      for (const phrase of discouragedPhrases) expect(manual.toLowerCase()).not.toContain(phrase);
    }
  });

  it("describes object validation as a root check", () => {
    for (const manual of publicManuals) {
      expect(manual).toContain("Check unknown and folder-discovered object roots against BEYOND.");
      expect(manual).not.toContain("Walk every property path in this file");
    }
  });
});
