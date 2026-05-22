import {
  type SendTalkTcpCommandsOptions,
  type SendTalkTcpCommandsResult,
  sendTalkTcpCommands,
  type TalkTcpReply,
} from "../../../src/runtime/mcpRuntimeExports";
import type { McpConfig } from "../config";
import { fail, ok, type ToolResult } from "../toolResult";

export interface CheckTalkConnectionOutput {
  ok: boolean;
  transport: "tcp";
  talkHost: string;
  talkPort: number;
  talkStatus: SendTalkTcpCommandsResult["talkStatus"];
  talkGreeting?: string;
  talkReplies: TalkTcpReply[];
  error?: string;
}

export type CheckTalkConnectionResult = ToolResult<CheckTalkConnectionOutput>;

export interface CheckTalkConnectionDeps {
  sendTcp?: (options: SendTalkTcpCommandsOptions) => Promise<SendTalkTcpCommandsResult>;
}

export async function checkTalkConnection(
  config: McpConfig,
  deps: CheckTalkConnectionDeps = {},
): Promise<CheckTalkConnectionResult> {
  if (!config.runtimeReadEnabled) {
    return fail("runtime read disabled - set PANGOLINT_MCP_RUNTIME_READ=enabled to enable read runtime tools", true);
  }

  const sendTcp = deps.sendTcp ?? sendTalkTcpCommands;
  const result = await sendTcp({
    host: config.beyondTalkTcpHost,
    port: config.beyondTalkTcpPort,
    commands: ["Hello", "Version"],
    password: config.beyondTalkTcpPassword,
    timeoutMs: config.readbackTimeoutMs,
  });

  return ok({
    ok: result.ok,
    transport: "tcp",
    talkHost: config.beyondTalkTcpHost,
    talkPort: config.beyondTalkTcpPort,
    talkStatus: result.talkStatus,
    talkGreeting: result.talkGreeting,
    talkReplies: result.talkReplies,
    error: result.error,
  });
}
