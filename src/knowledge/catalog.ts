import { readFileSync } from "node:fs";

export interface CommandEntry {
  canonical: string;
  aliases: string[];
  example: string;
  description: string;
  rawLine: string;
}

export interface CommandCatalog {
  commands: CommandEntry[];
  byName: Map<string, CommandEntry>;
}

const COMMAND_NAME = /^[A-Za-z_][A-Za-z0-9_]*/;

export function parseCommandCatalog(text: string): CommandCatalog {
  const commands: CommandEntry[] = [];
  const byName = new Map<string, CommandEntry>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const parts = line.split("|");
    const canonical = (parts.shift() ?? "").trim();
    if (!canonical) {
      continue;
    }

    const example = (parts.shift() ?? canonical).trim();
    const description = parts.join("|").trim();
    const aliases = uniqueNames([canonical, firstCommandWord(example)]);
    const entry: CommandEntry = {
      canonical,
      aliases,
      example,
      description,
      rawLine: line,
    };

    commands.push(entry);
    for (const alias of aliases) {
      byName.set(normalizeName(alias), entry);
    }
  }

  return { commands, byName };
}

export function loadCommandCatalog(path: string): CommandCatalog {
  return parseCommandCatalog(readFileSync(path, "utf8"));
}

export function lookupCommand(catalog: CommandCatalog, name: string): CommandEntry | undefined {
  return catalog.byName.get(normalizeName(name));
}

function firstCommandWord(value: string): string {
  return value.match(COMMAND_NAME)?.[0] ?? "";
}

function uniqueNames(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeName(trimmed);
    if (!trimmed || seen.has(key)) {
      continue;
    }
    result.push(trimmed);
    seen.add(key);
  }
  return result;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
