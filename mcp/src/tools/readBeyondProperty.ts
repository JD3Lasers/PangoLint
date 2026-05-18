// Tool: readBeyondProperty — single readback of a PangoScript property
// path against the configured BEYOND host. T1 read-only — sends a tiny
// `OscOutTTS …; OscOutXxx <path>, …` script and waits for the OSC
// callback. Wraps src/runtime/beyondReadback.readBeyondProperty so the same
// transport plumbing the extension uses also serves the MCP runtime tool.

import { mcpNameLimitReason } from "../../../src/language/analysisLimits";
import {
  type PropertyReadbackResult,
  type ReadbackTransport,
  readBeyondProperty as runtimeReadBeyondProperty,
  validateReadbackPropertyPath,
} from "../../../src/runtime/beyondReadback";
import type { McpConfig } from "../config";
import { fail, ok, type ToolResult } from "../config";

export interface ReadBeyondPropertyInput {
  path: string;
  /** Readback response type tag. Defaults to "f" (float — most numeric BEYOND properties). */
  typeTag?: "f" | "i" | "s";
}

export interface ReadBeyondPropertyOutput {
  ok: boolean;
  path: string;
  requestId: string;
  value?: string | number;
  error?: string;
}

export type ReadBeyondPropertyResult = ToolResult<ReadBeyondPropertyOutput>;

export interface ReadBeyondPropertyDeps {
  /** Transport seam for tests; defaults to the real node UDP transport. */
  transport?: ReadbackTransport;
}

export async function readBeyondProperty(
  input: ReadBeyondPropertyInput,
  config: McpConfig,
  deps: ReadBeyondPropertyDeps = {},
): Promise<ReadBeyondPropertyResult> {
  if (!config.runtimeReadEnabled) {
    return fail("runtime read disabled — set PANGOLINT_MCP_RUNTIME_READ=enabled to enable read runtime tools", true);
  }
  const path = input.path?.trim();
  if (!path) return fail("path is required");
  const pathLimitReason = mcpNameLimitReason(path);
  if (pathLimitReason) return fail(`path exceeds MCP readBeyondProperty limit: ${pathLimitReason}`);
  const pathError = validateReadbackPropertyPath(path);
  if (pathError) return fail(pathError);

  let result: PropertyReadbackResult;
  try {
    result = await runtimeReadBeyondProperty(
      {
        propertyPath: path,
        typeTag: input.typeTag ?? "f",
        talkHost: config.beyondTalkHost,
        talkPort: config.beyondTalkPort,
        listenHost: config.oscListenHost,
        listenPort: config.oscListenPort,
        timeoutMs: config.readbackTimeoutMs,
      },
      deps.transport,
    );
  } catch (err) {
    return fail(`readback transport error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return ok({
    ok: result.ok,
    path: result.propertyPath,
    requestId: result.requestId,
    value: result.value,
    error: result.error,
  });
}
