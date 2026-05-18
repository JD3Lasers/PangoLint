// Tool: lookupCommand — returns the curated knowledge entry for a single
// PangoScript command name (canonical or alias). Lower-cased lookup.

import type { CommandKnowledgeEntry } from "../../../src/knowledge/knowledgeBase";
import { mcpNameLimitReason } from "../../../src/language/analysisLimits";
import { fail, ok, type ToolResult } from "../config";

export interface LookupCommandInput {
  name: string;
}

export type LookupCommandResult = ToolResult<CommandKnowledgeEntry>;

export function lookupCommand(
  input: LookupCommandInput,
  byName: Map<string, CommandKnowledgeEntry>,
): LookupCommandResult {
  const name = input.name?.trim();
  if (!name) return fail("name is required");
  const nameLimitReason = mcpNameLimitReason(name);
  if (nameLimitReason) return fail(`name exceeds MCP lookupCommand limit: ${nameLimitReason}`);
  const entry = byName.get(name.toLowerCase());
  if (!entry) return fail(`unknown command: ${input.name}`);
  return ok(entry);
}
