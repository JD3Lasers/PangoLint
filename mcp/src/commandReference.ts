// Command-reference section indexing for MCP command search.
//
// The full command-reference docs are already exposed as a resource. This
// index gives searchCommands bounded per-command prose so task-intent queries
// can match reference notes that are not duplicated in commands.merged.json.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "./knowledgeBase";

const COMMAND_REFERENCE_DIR = "docs/references/beyond/pangoscript/command-reference";
const COMMAND_REFERENCE_META_FILES = new Set(["README.md"]);

export type CommandReferenceSearchIndex = ReadonlyMap<string, string>;

export function buildCommandReferenceSearchIndex(env: NodeJS.ProcessEnv = process.env): CommandReferenceSearchIndex {
  const repoRoot = resolveDataDir(env);
  const dir = path.join(repoRoot, COMMAND_REFERENCE_DIR);
  if (!existsSync(dir)) return new Map();

  const byCanonical = new Map<string, string>();
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md") && !COMMAND_REFERENCE_META_FILES.has(name))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const text = readFileSync(path.join(dir, file), "utf8");
    for (const section of commandSections(text)) {
      const body = [`Source: ${file}`, section.text].join("\n").trim();
      for (const canonical of section.commands) {
        const key = canonical.toLowerCase();
        const existing = byCanonical.get(key);
        byCanonical.set(key, existing ? `${existing}\n\n${body}` : body);
      }
    }
  }

  return byCanonical;
}

interface CommandSection {
  commands: string[];
  text: string;
}

function commandSections(markdown: string): CommandSection[] {
  const sections: CommandSection[] = [];
  let currentCommands: string[] = [];
  let currentLines: string[] = [];

  const flush = () => {
    if (currentCommands.length === 0 || currentLines.length === 0) return;
    sections.push({ commands: currentCommands, text: currentLines.join("\n").trim() });
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading?.[1] === "###") {
      flush();
      currentCommands = commandNamesFromHeading(heading[2]);
      currentLines = currentCommands.length > 0 ? [line] : [];
      continue;
    }
    if (heading && heading[1].length < 3) {
      flush();
      currentCommands = [];
      currentLines = [];
      continue;
    }
    if (currentCommands.length > 0) currentLines.push(line);
  }
  flush();

  return sections;
}

function commandNamesFromHeading(heading: string): string[] {
  return heading
    .split("/")
    .map((part) => part.trim())
    .filter((part) => /^[A-Za-z][A-Za-z0-9_]*$/.test(part));
}
