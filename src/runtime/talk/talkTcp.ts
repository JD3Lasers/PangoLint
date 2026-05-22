import net from "node:net";

type TalkTcpReplyStatus = "ok" | "error" | "output" | "echo" | "timeout" | "closed";
type TalkTcpStatus = "ok" | "error" | "timeout" | "closed";

export interface TalkTcpReply {
  lineNumber?: number;
  commandText?: string;
  status: TalkTcpReplyStatus;
  replyLines: string[];
  redacted: boolean;
}

interface BeyondTalkError {
  lineNumber?: number;
  message: string;
  replyLine: string;
  redacted: boolean;
}

export interface ParseTalkTcpReplyInput {
  lineNumber?: number;
  commandText?: string;
  replyLines: readonly string[];
  secrets?: readonly string[];
}

export interface ParseTalkTcpReplyResult {
  reply: TalkTcpReply;
  beyondError?: BeyondTalkError;
}

interface TalkTcpConnection {
  greeting?: string;
  sendLine(line: string, timeoutMs: number, onLineWritten?: () => void): Promise<string[]>;
  close(): void;
}

export interface SendTalkTcpCommandsOptions {
  host: string;
  port: number;
  commands: readonly string[];
  password?: string;
  timeoutMs?: number;
  openConnection?: (options: { host: string; port: number; timeoutMs: number }) => Promise<TalkTcpConnection>;
}

export interface SendTalkTcpCommandsResult {
  ok: boolean;
  transport: "tcp";
  talkStatus: TalkTcpStatus;
  talkGreeting?: string;
  talkReplies: TalkTcpReply[];
  beyondError?: BeyondTalkError;
  linesSent: number;
  payloadsSent: 0;
  bytesSent: number;
  error?: string;
}

const ERROR_LINE_RE = /^ERROR Line:\s*(\d+),\s*Error:\s*(.*)$/i;
const PASSWORD_VALUE_RE = /\bPassword\s+"(?:\\.|[^"\\])*"/gi;
const TERMINAL_OK_RE = /^OK$/i;

export function redactTalkText(value: string, secrets: readonly string[] = []): { text: string; redacted: boolean } {
  let text = value;
  let redacted = false;

  text = text.replace(PASSWORD_VALUE_RE, (match) => {
    redacted = true;
    const command = match.match(/^\s*Password/i)?.[0] ?? "Password";
    return `${command} "<redacted>"`;
  });

  for (const secret of secrets) {
    if (!secret) {
      continue;
    }
    const next = text.split(secret).join("<redacted>");
    if (next !== text) {
      redacted = true;
      text = next;
    }
  }

  return { text, redacted };
}

export function parseTalkTcpReply(input: ParseTalkTcpReplyInput): ParseTalkTcpReplyResult {
  const sanitizedCommand = input.commandText ? redactTalkText(input.commandText, input.secrets) : undefined;
  const sanitizedLines = input.replyLines.map((line) => redactTalkText(line, input.secrets));
  const replyLines = sanitizedLines.map((line) => line.text);
  const redacted = Boolean(sanitizedCommand?.redacted || sanitizedLines.some((line) => line.redacted));
  const errorLine = replyLines.find((line) => ERROR_LINE_RE.test(line));
  const status: TalkTcpReplyStatus = errorLine
    ? "error"
    : replyLines.some((line) => line.trim().toUpperCase() === "OK")
      ? "ok"
      : "output";

  const reply: TalkTcpReply = {
    lineNumber: input.lineNumber,
    commandText: sanitizedCommand?.text,
    status,
    replyLines,
    redacted,
  };

  if (!errorLine) {
    return { reply };
  }

  const match = errorLine.match(ERROR_LINE_RE);
  const parsedLineNumber = match ? Number(match[1]) : undefined;
  const message = match?.[2] ?? errorLine;

  return {
    reply,
    beyondError: {
      lineNumber: Number.isInteger(parsedLineNumber) ? parsedLineNumber : input.lineNumber,
      message,
      replyLine: errorLine,
      redacted,
    },
  };
}

export async function sendTalkTcpCommands(options: SendTalkTcpCommandsOptions): Promise<SendTalkTcpCommandsResult> {
  const timeoutMs = options.timeoutMs ?? 3000;
  const openConnection = options.openConnection ?? openTalkTcpConnection;
  const secrets = options.password ? [options.password] : [];
  let connection: TalkTcpConnection;
  try {
    connection = await openConnection({ host: options.host, port: options.port, timeoutMs });
  } catch (error) {
    return failedTcpResult(talkTcpStatusForError(error), errorMessage(error));
  }

  const talkReplies: TalkTcpReply[] = [];
  let linesSent = 0;
  let bytesSent = 0;

  const sendOneLine = async (
    line: string,
    lineNumber?: number,
    countCommand = false,
  ): Promise<ParseTalkTcpReplyResult> => {
    let lineWritten = false;
    const recordLineWritten = (): void => {
      if (lineWritten) return;
      lineWritten = true;
      bytesSent += Buffer.byteLength(`${line}\r\n`, "ascii");
      if (countCommand) linesSent += 1;
    };
    const replyLines = await connection.sendLine(line, timeoutMs, recordLineWritten);
    recordLineWritten();
    const parsed = parseTalkTcpReply({ lineNumber, commandText: line, replyLines, secrets });
    talkReplies.push(parsed.reply);
    return parsed;
  };

  try {
    if (options.password) {
      const echoOff = await sendOneLine("Echo 0");
      if (echoOff.beyondError) {
        return finishTcpResult(false, "error", connection, talkReplies, linesSent, bytesSent, echoOff.beyondError);
      }
      const password = await sendOneLine(`Password "${options.password}"`);
      if (password.beyondError) {
        return finishTcpResult(false, "error", connection, talkReplies, linesSent, bytesSent, password.beyondError);
      }
    }

    const echoOn = await sendOneLine("Echo 1");
    if (echoOn.beyondError) {
      return finishTcpResult(false, "error", connection, talkReplies, linesSent, bytesSent, echoOn.beyondError);
    }

    for (let index = 0; index < options.commands.length; index += 1) {
      const lineNumber = index + 1;
      const command = options.commands[index];
      const parsed = await sendOneLine(command, lineNumber, true);
      if (parsed.beyondError) {
        return finishTcpResult(false, "error", connection, talkReplies, linesSent, bytesSent, parsed.beyondError);
      }
    }

    return finishTcpResult(true, "ok", connection, talkReplies, linesSent, bytesSent);
  } catch (error) {
    const status = error instanceof TalkTcpTimeoutError ? "timeout" : "closed";
    return finishTcpResult(
      false,
      status,
      connection,
      talkReplies,
      linesSent,
      bytesSent,
      undefined,
      errorMessage(error),
    );
  }
}

async function openTalkTcpConnection(options: {
  host: string;
  port: number;
  timeoutMs: number;
}): Promise<TalkTcpConnection> {
  const socket = net.createConnection({ host: options.host, port: options.port });
  socket.setEncoding("ascii");
  const reader = new TalkTcpLineReader(socket);

  try {
    await waitForConnect(socket, options.timeoutMs);
    const greeting = await reader.readLine(options.timeoutMs);
    return {
      greeting,
      sendLine: async (line, timeoutMs, onLineWritten) => {
        await writeAsciiLine(socket, line);
        onLineWritten?.();
        return reader.readReply(timeoutMs);
      },
      close: () => socket.destroy(),
    };
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

export class TalkTcpTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TalkTcpTimeoutError";
  }
}

class TalkTcpLineReader {
  private buffer = "";
  private readonly queuedLines: string[] = [];
  private closed = false;
  private readWaiting:
    | {
        resolve: (line: string) => void;
        reject: (error: Error) => void;
        timer: NodeJS.Timeout;
      }
    | undefined;

  constructor(socket: net.Socket) {
    socket.on("data", (chunk) => this.acceptData(String(chunk)));
    socket.on("close", () => {
      this.closed = true;
      this.rejectWaiting(new Error("Talk TCP connection closed"));
    });
    socket.on("error", (error) => {
      this.closed = true;
      this.rejectWaiting(error);
    });
  }

  async readReply(timeoutMs: number): Promise<string[]> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine(timeoutMs);
      lines.push(line);
      if (TERMINAL_OK_RE.test(line) || ERROR_LINE_RE.test(line)) {
        return lines;
      }
    }
  }

  readLine(timeoutMs: number): Promise<string> {
    const queued = this.queuedLines.shift();
    if (queued !== undefined) {
      return Promise.resolve(queued);
    }
    if (this.closed) {
      return Promise.reject(new Error("Talk TCP connection closed"));
    }
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.readWaiting = undefined;
        reject(new TalkTcpTimeoutError("Talk TCP timed out waiting for BEYOND status"));
      }, timeoutMs);
      this.readWaiting = { resolve, reject, timer };
    });
  }

  private acceptData(chunk: string): void {
    this.buffer += chunk;
    const parts = this.buffer.split(/\n/);
    this.buffer = parts.pop() ?? "";
    for (const rawLine of parts) {
      this.pushLine(rawLine.replace(/\r$/, ""));
    }
  }

  private pushLine(line: string): void {
    if (this.readWaiting) {
      const waiting = this.readWaiting;
      this.readWaiting = undefined;
      clearTimeout(waiting.timer);
      waiting.resolve(line);
      return;
    }
    this.queuedLines.push(line);
  }

  private rejectWaiting(error: Error): void {
    if (!this.readWaiting) {
      return;
    }
    const waiting = this.readWaiting;
    this.readWaiting = undefined;
    clearTimeout(waiting.timer);
    waiting.reject(error);
  }
}

function finishTcpResult(
  ok: boolean,
  talkStatus: TalkTcpStatus,
  connection: TalkTcpConnection,
  talkReplies: TalkTcpReply[],
  linesSent: number,
  bytesSent: number,
  beyondError?: BeyondTalkError,
  error?: string,
): SendTalkTcpCommandsResult {
  connection.close();
  return {
    ok,
    transport: "tcp",
    talkStatus,
    talkGreeting: connection.greeting,
    talkReplies,
    beyondError,
    linesSent,
    payloadsSent: 0,
    bytesSent,
    error: error ?? beyondError?.message,
  };
}

function failedTcpResult(talkStatus: TalkTcpStatus, error: string): SendTalkTcpCommandsResult {
  return {
    ok: false,
    transport: "tcp",
    talkStatus,
    talkReplies: [],
    linesSent: 0,
    payloadsSent: 0,
    bytesSent: 0,
    error,
  };
}

function talkTcpStatusForError(error: unknown): Extract<TalkTcpStatus, "timeout" | "closed"> {
  return error instanceof TalkTcpTimeoutError ? "timeout" : "closed";
}

function waitForConnect(socket: net.Socket, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new TalkTcpTimeoutError("Talk TCP timed out while connecting to BEYOND"));
    }, timeoutMs);
    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("error", onError);
    };
    const onConnect = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

function writeAsciiLine(socket: net.Socket, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, "ascii", (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
