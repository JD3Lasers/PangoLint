// Tool: lookupObjectProperty: exact lookup for BEYOND Object Tree property
// paths. Concrete indexed paths resolve to their normalized entry.

import {
  buildObjectPropertyCard,
  type ObjectPropertyCard,
  type ObjectPropertyDetailInput,
} from "../../../src/knowledge/objectPropertyCards";
import type { ObjectPropertyIndex } from "../../../src/knowledge/objectPropertyIndex";
import { mcpNameLimitReason } from "../../../src/language/analysisLimits";
import { fail, ok, type ToolResult } from "../toolResult";

export interface LookupObjectPropertyInput extends ObjectPropertyDetailInput {
  path: string;
}

export type LookupObjectPropertyResult = ToolResult<{
  requestedPath: string;
  property: ObjectPropertyCard;
  matchedVariant?: { path: string; osc?: string };
}>;

export function lookupObjectProperty(
  input: LookupObjectPropertyInput,
  index: ObjectPropertyIndex,
): LookupObjectPropertyResult {
  const requestedPath = input.path?.trim();
  if (!requestedPath) return fail("path is required");
  const pathLimitReason = mcpNameLimitReason(requestedPath);
  if (pathLimitReason) return fail(`path exceeds MCP lookupObjectProperty limit: ${pathLimitReason}`);

  const result = index.lookup(requestedPath);
  if (!result) return fail(`unknown object property: ${input.path}`);

  return ok({
    requestedPath,
    property: buildObjectPropertyCard(result.entry, input),
    matchedVariant: result.matchedVariant,
  });
}
