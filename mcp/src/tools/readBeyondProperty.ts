// Tool: readBeyondProperty: single readback of a PangoScript property
// path against the configured BEYOND host. T1 read-only: sends a tiny
// `OscOutTTS ...; OscOutXxx <path>, ...` script and waits for the OSC
// callback. Wraps src/runtime/beyondReadback.readBeyondProperty so the same
// transport plumbing the extension uses also serves the MCP runtime tool.

import { mcpNameLimitReason } from "../../../src/language/analysisLimits";
import {
  type PropertyReadbackResult,
  type ReadbackTransport,
  readBeyondProperty as runtimeReadBeyondProperty,
  validateReadbackPropertyPath,
} from "../../../src/runtime/beyondReadback";
import type { SendTalkTcpCommandsResult, TalkTcpReply } from "../../../src/runtime/talkTcp";
import type { McpConfig } from "../config";
import { readbackOptionsFromMcpConfig, talkTargetFromMcpConfig } from "../runtimeToolOptions";
import { fail, ok, type ToolResult } from "../toolResult";

export interface ReadBeyondPropertyInput {
  path: string;
  /** Readback response type tag. Defaults to "f" for most numeric BEYOND properties. */
  typeTag?: "f" | "i" | "s";
}

export interface ReadBeyondPropertyOutput {
  ok: boolean;
  path: string;
  requestId: string;
  value?: string | number;
  transport?: "tcp" | "udp";
  talkHost?: string;
  talkPort?: number;
  talkStatus?: "ok" | "error" | "timeout" | "closed" | "send-only";
  talkGreeting?: string;
  talkReplies?: TalkTcpReply[];
  beyondError?: SendTalkTcpCommandsResult["beyondError"];
  error?: string;
}

export type ReadBeyondPropertyResult = ToolResult<ReadBeyondPropertyOutput>;

export interface ReadBeyondPropertyDeps {
  /** Transport override for tests; defaults to the real Node readback transport. */
  transport?: ReadbackTransport;
}

export async function readBeyondProperty(
  input: ReadBeyondPropertyInput,
  config: McpConfig,
  deps: ReadBeyondPropertyDeps = {},
): Promise<ReadBeyondPropertyResult> {
  if (!config.runtimeReadEnabled) {
    return fail("runtime read disabled: set PANGOLINT_MCP_RUNTIME_READ=enabled to enable read runtime tools", true);
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
        ...readbackOptionsFromMcpConfig(config),
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
    transport: result.transport,
    ...talkTargetFromMcpConfig(config, result.transport),
    talkStatus: result.talkStatus,
    talkGreeting: result.talkGreeting,
    talkReplies: result.talkReplies,
    beyondError: result.beyondError,
    error: result.error,
  });
}
