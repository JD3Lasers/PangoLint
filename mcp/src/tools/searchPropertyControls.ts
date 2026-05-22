import type { McpPropertyControlIndex, ObjectPropertyKind } from "../../../src/knowledge/mcpKnowledgeExports";
import { mcpNameLimitReason, mcpQueryLimitReason } from "../../../src/language/mcpLanguageExports";
import { fail, ok, type ToolResult } from "../toolResult";
import {
  buildPropertyControlCard,
  type PropertyControlCard,
  type PropertyControlDetailInput,
} from "./propertyControlResponse";

export interface SearchPropertyControlsInput extends PropertyControlDetailInput {
  query: string;
  root?: string;
  kind?: ObjectPropertyKind;
  limit?: number;
}

export interface PropertyControlSearchHit extends PropertyControlCard {
  score: number;
  matchedTerms: string[];
}

export type SearchPropertyControlsResult = ToolResult<{
  query: string;
  count: number;
  hits: PropertyControlSearchHit[];
}>;

export function searchPropertyControls(
  input: SearchPropertyControlsInput,
  index: McpPropertyControlIndex,
): SearchPropertyControlsResult {
  const query = input.query?.trim();
  if (!query) return fail("query is required");
  const queryLimitReason = mcpQueryLimitReason(query);
  if (queryLimitReason) return fail(`query exceeds MCP searchPropertyControls limit: ${queryLimitReason}`);

  if (input.root) {
    const rootLimitReason = mcpNameLimitReason(input.root);
    if (rootLimitReason) return fail(`root exceeds MCP searchPropertyControls limit: ${rootLimitReason}`);
  }

  const hits = index.search(input).map((hit) => ({
    ...buildPropertyControlCard(hit.entry, input),
    score: hit.score,
    matchedTerms: hit.matchedTerms,
  }));

  return ok({
    query,
    count: hits.length,
    hits,
  });
}
