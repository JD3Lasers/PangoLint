import type { McpPropertyControlIndex } from "../../../src/knowledge/mcpKnowledgeExports";
import { mcpNameLimitReason } from "../../../src/language/mcpLanguageExports";
import { fail, ok, type ToolResult } from "../toolResult";
import {
  buildPropertyControlCard,
  type PropertyControlCard,
  type PropertyControlDetailInput,
} from "./propertyControlResponse";

export interface LookupPropertyControlsInput extends PropertyControlDetailInput {
  path: string;
}

export type LookupPropertyControlsResult = ToolResult<{
  requestedPath: string;
  propertyControl: PropertyControlCard;
}>;

export function lookupPropertyControls(
  input: LookupPropertyControlsInput,
  index: McpPropertyControlIndex,
): LookupPropertyControlsResult {
  const requestedPath = input.path?.trim();
  if (!requestedPath) return fail("path is required");
  const limitReason = mcpNameLimitReason(requestedPath);
  if (limitReason) return fail(`path exceeds MCP lookupPropertyControls limit: ${limitReason}`);

  const entry = index.lookup(requestedPath);
  if (!entry) return fail(`unknown property control: ${input.path}`);

  return ok({
    requestedPath,
    propertyControl: buildPropertyControlCard(entry, input),
  });
}
