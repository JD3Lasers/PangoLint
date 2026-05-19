import { describe, expect, it } from "vitest";

import { parseTalkTcpReply, redactTalkText, sendTalkTcpCommands } from "../../src/runtime/talkTcp";

describe("Talk TCP reply parsing", () => {
  it("classifies output followed by OK as a successful command reply", () => {
    const result = parseTalkTcpReply({
      lineNumber: 2,
      commandText: "Hello",
      replyLines: ["Hello!", "OK"],
    });

    expect(result.reply).toEqual({
      lineNumber: 2,
      commandText: "Hello",
      status: "ok",
      replyLines: ["Hello!", "OK"],
      redacted: false,
    });
    expect(result.beyondError).toBeUndefined();
  });

  it("maps BEYOND ERROR Line replies into sanitized error fields", () => {
    const result = parseTalkTcpReply({
      lineNumber: 1,
      commandText: "badcommand 123",
      replyLines: ["ERROR Line: 1, Error: Unknown command: badcommand"],
    });

    expect(result.reply.status).toBe("error");
    expect(result.beyondError).toEqual({
      lineNumber: 1,
      message: "Unknown command: badcommand",
      replyLine: "ERROR Line: 1, Error: Unknown command: badcommand",
      redacted: false,
    });
  });

  it("redacts passwords from command text, reply lines, and BEYOND errors", () => {
    const result = parseTalkTcpReply({
      lineNumber: 1,
      commandText: 'Password "sample-secret"',
      replyLines: ['ERROR Line: 1, Error: Password "sample-secret" invalid'],
      secrets: ["sample-secret"],
    });

    expect(result.reply.commandText).toBe('Password "<redacted>"');
    expect(result.reply.replyLines).toEqual(['ERROR Line: 1, Error: Password "<redacted>" invalid']);
    expect(result.reply.redacted).toBe(true);
    expect(result.beyondError).toEqual({
      lineNumber: 1,
      message: 'Password "<redacted>" invalid',
      replyLine: 'ERROR Line: 1, Error: Password "<redacted>" invalid',
      redacted: true,
    });
  });
});

describe("Talk TCP redaction", () => {
  it("redacts configured secrets and password command values", () => {
    expect(redactTalkText('Password "sample-secret" and value token-123', ["token-123"])).toEqual({
      text: 'Password "<redacted>" and value <redacted>',
      redacted: true,
    });
  });
});

describe("sendTalkTcpCommands", () => {
  it("opens Talk TCP, enables Echo 1, and records command replies", async () => {
    const sent: string[] = [];
    const result = await sendTalkTcpCommands({
      host: "127.0.0.1",
      port: 16063,
      commands: ["Hello", "Version"],
      openConnection: async () => ({
        greeting: "Welcome to BEYOND!",
        sendLine: async (line) => {
          sent.push(line);
          if (line === "Echo 1") return ["OK"];
          if (line === "Hello") return ["Hello!", "OK"];
          if (line === "Version") return ["5.5.0.2030", "OK"];
          throw new Error(`unexpected line ${line}`);
        },
        close: () => {},
      }),
    });

    expect(sent).toEqual(["Echo 1", "Hello", "Version"]);
    expect(result).toMatchObject({
      ok: true,
      transport: "tcp",
      talkStatus: "ok",
      talkGreeting: "Welcome to BEYOND!",
      linesSent: 2,
    });
    expect(result.talkReplies.map((reply) => reply.commandText)).toEqual(["Echo 1", "Hello", "Version"]);
    expect(result.talkReplies[1].replyLines).toEqual(["Hello!", "OK"]);
  });

  it("stops after BEYOND returns an ERROR Line reply", async () => {
    const sent: string[] = [];
    const result = await sendTalkTcpCommands({
      host: "127.0.0.1",
      port: 16063,
      commands: ["badcommand 123", "Hello"],
      openConnection: async () => ({
        greeting: "Welcome to BEYOND!",
        sendLine: async (line) => {
          sent.push(line);
          if (line === "Echo 1") return ["OK"];
          return ["ERROR Line: 1, Error: Unknown command: badcommand"];
        },
        close: () => {},
      }),
    });

    expect(sent).toEqual(["Echo 1", "badcommand 123"]);
    expect(result.ok).toBe(false);
    expect(result.talkStatus).toBe("error");
    expect(result.linesSent).toBe(1);
    expect(result.beyondError).toEqual({
      lineNumber: 1,
      message: "Unknown command: badcommand",
      replyLine: "ERROR Line: 1, Error: Unknown command: badcommand",
      redacted: false,
    });
  });

  it("authenticates before command sends and redacts password replies", async () => {
    const sent: string[] = [];
    const result = await sendTalkTcpCommands({
      host: "127.0.0.1",
      port: 16063,
      password: "sample-secret",
      commands: ["Hello"],
      openConnection: async () => ({
        greeting: "Welcome to BEYOND!",
        sendLine: async (line) => {
          sent.push(line);
          if (line === "Echo 0") return ["OK"];
          if (line === 'Password "sample-secret"') return ['ERROR Line: 1, Error: Password "sample-secret" invalid'];
          throw new Error(`unexpected line ${line}`);
        },
        close: () => {},
      }),
    });

    expect(sent).toEqual(["Echo 0", 'Password "sample-secret"']);
    expect(result.ok).toBe(false);
    expect(result.talkStatus).toBe("error");
    expect(result.talkReplies[1].commandText).toBe('Password "<redacted>"');
    expect(result.beyondError).toEqual({
      lineNumber: 1,
      message: 'Password "<redacted>" invalid',
      replyLine: 'ERROR Line: 1, Error: Password "<redacted>" invalid',
      redacted: true,
    });
  });
});
