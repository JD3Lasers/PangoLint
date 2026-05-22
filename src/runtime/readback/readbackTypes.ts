import type { BeyondTalkTransport, RunScriptResult } from "../commandBatch/runScript";
import type { OscMessage } from "../osc/osc";
import type { SendTalkTcpCommandsOptions, SendTalkTcpCommandsResult, TalkTcpReply } from "../talk/talkTcp";

export interface ReadbackOptions {
  talkHost: string;
  talkPort: number;
  talkTransport?: BeyondTalkTransport;
  talkTcpHost?: string;
  talkTcpPort?: number;
  talkUdpHost?: string;
  talkUdpPort?: number;
  talkUdpFallbackAllowed?: boolean;
  talkTcpPassword?: string;
  commandTimeoutMs?: number;
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
  requestId?: string;
  logger?: (msg: string) => void;
}

export interface ReadbackTalkStatus {
  transport?: "tcp" | "udp";
  talkStatus?: RunScriptResult["talkStatus"];
  talkGreeting?: string;
  talkReplies?: TalkTcpReply[];
  beyondError?: SendTalkTcpCommandsResult["beyondError"];
  linesSent?: number;
  payloadsSent?: number;
  bytesSent?: number;
}

export interface ConnectionCheckResult extends ReadbackTalkStatus {
  ok: boolean;
  requestId: string;
  command: string;
  message?: OscMessage;
  error?: string;
}

export interface PropertyReadbackOptions extends ReadbackOptions {
  propertyPath: string;
  typeTag?: "f" | "i" | "s";
}

export interface PropertyReadbackResult extends ReadbackTalkStatus {
  ok: boolean;
  requestId: string;
  propertyPath: string;
  script: string;
  value?: string | number;
  message?: OscMessage;
  error?: string;
}

export interface WriteVerifyOptions extends ReadbackOptions {
  command: string;
  readbackPath: string;
  expectedValue: number | string;
  restoreCommand?: string;
  typeTag?: "f" | "i" | "s";
}

export interface WriteVerifyResult extends ReadbackTalkStatus {
  ok: boolean;
  command: string;
  readbackPath: string;
  after?: number | string;
  expected: number | string;
  matched: boolean;
  restored: boolean;
  error?: string;
}

export interface ReadbackTransport {
  sendTalk(host: string, port: number, payload: Buffer): Promise<void>;
  sendTalkTcp?: (options: SendTalkTcpCommandsOptions) => Promise<SendTalkTcpCommandsResult>;
  listenForOsc(
    host: string,
    port: number,
    predicate: (message: OscMessage) => boolean,
    timeoutMs: number,
  ): ReadbackOscListener;
}

export interface ReadbackOscListener {
  ready: Promise<void>;
  message: Promise<OscMessage>;
  close?: () => void;
}
