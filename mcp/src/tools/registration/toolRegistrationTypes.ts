import type { McpConfig } from "../../config";
import type { McpKnowledgeBase } from "../../knowledgeBase";

export interface RegisterToolsContext {
  version: string;
  config: McpConfig;
  knowledge: McpKnowledgeBase;
}
