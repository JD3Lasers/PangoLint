import { type RunScriptResult, runScript } from "../commandBatch/runScript";
import { buildTalkPayloads } from "../talk/talkUdp";
import type { ReadbackOptions, ReadbackTalkStatus, ReadbackTransport } from "./readbackTypes";

export async function sendReadbackTalk(
  commands: readonly string[],
  options: ReadbackOptions,
  transport: ReadbackTransport,
): Promise<RunScriptResult> {
  return runScript(commands.join("\n"), {
    talkHost: options.talkHost,
    talkPort: options.talkPort,
    talkTransport: options.talkTransport ?? "udp",
    talkTcpHost: options.talkTcpHost,
    talkTcpPort: options.talkTcpPort,
    talkUdpHost: options.talkUdpHost ?? options.talkHost,
    talkUdpPort: options.talkUdpPort ?? options.talkPort,
    talkUdpFallbackAllowed: options.talkUdpFallbackAllowed,
    talkTcpPassword: options.talkTcpPassword,
    talkTcpEchoMode: options.talkTcpEchoMode,
    commandTimeoutMs: options.commandTimeoutMs ?? options.timeoutMs,
    send: transport.sendTalk,
    sendTcp: transport.sendTalkTcp,
  });
}

export function readbackTalkStatus(result: RunScriptResult): ReadbackTalkStatus {
  return {
    transport: result.transport,
    talkTcpEchoMode: result.talkTcpEchoMode,
    talkStatus: result.talkStatus,
    talkGreeting: result.talkGreeting,
    talkReplies: result.talkReplies,
    beyondError: result.beyondError,
    linesSent: result.linesSent,
    payloadsSent: result.payloadsSent,
    bytesSent: result.bytesSent,
  };
}

export function writeCommandMayHaveReachedBeyond(result: RunScriptResult): boolean {
  if (result.transport === "udp") {
    return result.payloadsSent > 0 || result.bytesSent > 0;
  }
  if (result.transport === "tcp") {
    return (
      result.linesSent > 0 ||
      result.talkReplies?.some((reply) => reply.lineNumber === 1) === true ||
      result.beyondError?.lineNumber === 1
    );
  }
  return false;
}

export function udpPayloadPreflightError(commands: readonly string[], options: ReadbackOptions): string | undefined {
  if (!readbackUdpMayBeUsed(options)) {
    return undefined;
  }
  const payloads = buildTalkPayloads([...commands]);
  return payloads.length > 1 ? "Script exceeded payload limit." : undefined;
}

function readbackUdpMayBeUsed(options: ReadbackOptions): boolean {
  const transport = options.talkTransport ?? "udp";
  return transport === "udp" || (transport === "auto" && options.talkUdpFallbackAllowed === true);
}
