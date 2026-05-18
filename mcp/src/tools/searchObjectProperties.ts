// Tool: searchObjectProperties: ranked search over BEYOND Object Tree
// property paths promoted into data/pangoscript/object-tree/runtime-indexes/object-property-index.json.

import {
  buildObjectPropertyCard,
  type ObjectPropertyCard,
  type ObjectPropertyDetailInput,
} from "../../../src/knowledge/objectPropertyCards";
import type { ObjectPropertyIndex, ObjectPropertyKind } from "../../../src/knowledge/objectPropertyIndex";
import { mcpNameLimitReason, mcpQueryLimitReason } from "../../../src/language/analysisLimits";
import { fail, ok, type ToolResult } from "../config";

export interface SearchObjectPropertiesInput extends ObjectPropertyDetailInput {
  query: string;
  root?: string;
  kind?: ObjectPropertyKind;
  limit?: number;
}

export interface ObjectPropertyHit extends ObjectPropertyCard {
  score: number;
  matchedTerms: string[];
}

export type SearchObjectPropertiesResult = ToolResult<{
  hits: ObjectPropertyHit[];
  query: string;
  root?: string;
  kind?: ObjectPropertyKind;
}>;

export function searchObjectProperties(
  input: SearchObjectPropertiesInput,
  index: ObjectPropertyIndex,
): SearchObjectPropertiesResult {
  const query = input.query?.trim();
  if (!query) return fail("query is required");
  const queryLimitReason = mcpQueryLimitReason(query);
  if (queryLimitReason) return fail(`query exceeds MCP searchObjectProperties limit: ${queryLimitReason}`);
  if (input.root) {
    const rootLimitReason = mcpNameLimitReason(input.root);
    if (rootLimitReason) return fail(`root exceeds MCP searchObjectProperties limit: ${rootLimitReason}`);
  }

  const hits = index.search(input).map((hit) => ({
    ...buildObjectPropertyCard(hit.entry, input),
    score: hit.score,
    matchedTerms: hit.matchedTerms,
  }));

  return ok({
    hits,
    query,
    root: input.root,
    kind: input.kind,
  });
}
