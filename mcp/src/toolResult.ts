/**
 * Structured response shape used by every MCP tool. Agents handle structured
 * errors more cleanly than thrown exceptions; the MCP protocol delivers
 * the JSON as a text content block.
 */
export interface ToolError {
  ok: false;
  error: string;
  blocked?: boolean;
}

export interface ToolSuccess<T> {
  ok: true;
  data: T;
}

export type ToolResult<T> = ToolSuccess<T> | ToolError;

export function ok<T>(data: T): ToolSuccess<T> {
  return { ok: true, data };
}

export function fail(error: string, blocked = false): ToolError {
  return blocked ? { ok: false, error, blocked: true } : { ok: false, error };
}
