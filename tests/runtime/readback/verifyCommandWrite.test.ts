import { describe, expect, it, vi } from "vitest";
import { verifyCommandWrite } from "../../../src/runtime/readback/beyondReadback";
import type { ReadbackTransport } from "../../../src/runtime/readback/readbackTypes";
import {
  type SendTalkTcpCommandsOptions,
  sendTalkTcpCommands,
  TalkTcpTimeoutError,
} from "../../../src/runtime/talk/talkTcp";

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("condition was not met");
}

describe("verifyCommandWrite", () => {
  const baseOptions = {
    talkHost: "127.0.0.1",
    talkPort: 16062,
    listenHost: "0.0.0.0",
    listenPort: 7000,
    timeoutMs: 3000,
    requestId: "req-verify",
  };

  it("sends combined write+readback script in one payload", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: (_host, _port, predicate) => {
        const message = { address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] };
        expect(predicate(message)).toBe(true);
        return { ready: Promise.resolve(), message: Promise.resolve(message) };
      },
    };

    await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0]).toBe(
      'Zoom 50\r\nvar v\r\nv = Master.Zoom\r\nOscOutTTS "/pangolint/verify/req-verify", "f", v\r\n',
    );
  });

  it("rejects UDP write verification scripts that would span multiple datagrams", async () => {
    let sendCount = 0;
    let listenCount = 0;
    const longCommand = `Zoom ${"1".repeat(1180)}`;
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        sendCount += 1;
      },
      listenForOsc: () => {
        listenCount += 1;
        return {
          ready: Promise.resolve(),
          message: new Promise(() => {}),
        };
      },
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: longCommand,
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        talkTransport: "udp",
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Script exceeded payload limit.");
    expect(result.restored).toBe(false);
    expect(sendCount).toBe(0);
    expect(listenCount).toBe(0);
  });

  it("sends write verification over Talk TCP when TCP transport is selected", async () => {
    const sentUdpPayloads: string[] = [];
    const tcpSends: SendTalkTcpCommandsOptions[] = [];
    let callbackAddress = "/pangolint/verify/unset";
    let sentTcp!: () => void;
    const tcpSent = new Promise<void>((resolve) => {
      sentTcp = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentUdpPayloads.push(payload.toString("ascii"));
      },
      sendTalkTcp: async (options) => {
        tcpSends.push(options);
        callbackAddress = options.commands.at(-1)?.match(/OscOutTTS "([^"]+)"/)?.[1] ?? callbackAddress;
        sentTcp();
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkReplies: options.commands.map((commandText, index) => ({
            lineNumber: index + 1,
            commandText,
            status: "ok",
            replyLines: ["OK"],
            redacted: false,
          })),
          linesSent: options.commands.length,
          payloadsSent: 0,
          bytesSent: 90,
        };
      },
      listenForOsc: (_host, _port, predicate) => ({
        ready: Promise.resolve(),
        message: tcpSent.then(() => {
          const message = {
            address: callbackAddress,
            typeTags: "f",
            args: [50],
            sourceAddress: "192.0.2.148",
          };
          expect(predicate(message)).toBe(true);
          return message;
        }),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        talkTransport: "tcp",
        talkTcpHost: "192.0.2.148",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.transport).toBe("tcp");
    expect(result.talkStatus).toBe("ok");
    expect(sentUdpPayloads).toEqual([]);
    expect(tcpSends).toHaveLength(1);
    expect(tcpSends[0]).toEqual(
      expect.objectContaining({
        host: "192.0.2.148",
        port: 16063,
        commands: ["Zoom 50", 'OscOutTTS "/pangolint/verify/req-verify", "f", Master.Zoom'],
      }),
    );
  });

  it("closes the OSC listener when a TCP write verification send fails", async () => {
    const close = vi.fn();
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        throw new Error("UDP should not be used");
      },
      sendTalkTcp: async () => ({
        ok: false,
        transport: "tcp",
        talkStatus: "closed",
        talkReplies: [],
        linesSent: 0,
        payloadsSent: 0,
        bytesSent: 0,
        error: "connect ECONNREFUSED",
      }),
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: new Promise(() => {}),
        close,
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        talkTransport: "tcp",
        talkTcpHost: "127.0.0.1",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("connect ECONNREFUSED");
    expect(result.transport).toBe("tcp");
    expect(result.restored).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("attempts restore when a TCP write verification send partially succeeds", async () => {
    const close = vi.fn();
    const tcpSends: SendTalkTcpCommandsOptions[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        throw new Error("UDP should not be used");
      },
      sendTalkTcp: async (options) => {
        tcpSends.push(options);
        if (tcpSends.length === 1) {
          return {
            ok: false,
            transport: "tcp",
            talkStatus: "error",
            talkReplies: [
              { lineNumber: 1, commandText: options.commands[0], status: "ok", replyLines: ["OK"], redacted: false },
              {
                lineNumber: 2,
                commandText: options.commands[1],
                status: "error",
                replyLines: ["ERROR Line: 2, Error: no readback"],
                redacted: false,
              },
            ],
            linesSent: 1,
            payloadsSent: 0,
            bytesSent: 32,
            error: "ERROR Line: 2, Error: no readback",
          };
        }
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkReplies: [
            { lineNumber: 1, commandText: options.commands[0], status: "ok", replyLines: ["OK"], redacted: false },
          ],
          linesSent: 1,
          payloadsSent: 0,
          bytesSent: 16,
        };
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: new Promise(() => {}),
        close,
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
        talkTransport: "tcp",
        talkTcpHost: "127.0.0.1",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.restored).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(tcpSends).toHaveLength(2);
    expect(tcpSends[1].commands).toEqual(["Zoom 100"]);
  });

  it("attempts restore when a TCP write command times out before its reply", async () => {
    const tcpSends: SendTalkTcpCommandsOptions[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        throw new Error("UDP should not be used");
      },
      sendTalkTcp: async (options) => {
        tcpSends.push(options);
        if (tcpSends.length === 1) {
          return sendTalkTcpCommands({
            ...options,
            openConnection: async () => ({
              greeting: "Welcome to BEYOND!",
              sendLine: async (line, _timeoutMs, onLineWritten) => {
                onLineWritten?.();
                if (line === "Echo 1") return ["OK"];
                if (line === "Zoom 50") {
                  throw new TalkTcpTimeoutError("Talk TCP timed out waiting for BEYOND status");
                }
                throw new Error(`unexpected line ${line}`);
              },
              close: () => {},
            }),
          });
        }
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkReplies: [
            { lineNumber: 1, commandText: options.commands[0], status: "ok", replyLines: ["OK"], redacted: false },
          ],
          linesSent: 1,
          payloadsSent: 0,
          bytesSent: 10,
        };
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: new Promise(() => {}),
        close: () => {},
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
        talkTransport: "tcp",
        talkTcpHost: "127.0.0.1",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.talkStatus).toBe("timeout");
    expect(result.linesSent).toBe(1);
    expect(result.restored).toBe(true);
    expect(tcpSends).toHaveLength(2);
    expect(tcpSends[1].commands).toEqual(["Zoom 100"]);
  });

  it("does not restore when a TCP write command fails before delivery", async () => {
    const tcpSends: SendTalkTcpCommandsOptions[] = [];
    const close = vi.fn();
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        throw new Error("UDP should not be used");
      },
      sendTalkTcp: async (options) => {
        tcpSends.push(options);
        return sendTalkTcpCommands({
          ...options,
          openConnection: async () => ({
            greeting: "Welcome to BEYOND!",
            sendLine: async (line, _timeoutMs, onLineWritten) => {
              if (line === "Echo 1") {
                onLineWritten?.();
                return ["OK"];
              }
              if (line === "Zoom 50") {
                throw new Error("write EPIPE");
              }
              throw new Error(`unexpected line ${line}`);
            },
            close: () => {},
          }),
        });
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: new Promise(() => {}),
        close,
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
        talkTransport: "tcp",
        talkTcpHost: "127.0.0.1",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.talkStatus).toBe("closed");
    expect(result.linesSent).toBe(0);
    expect(result.restored).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    expect(tcpSends).toHaveLength(1);
  });

  it("does not restore when a UDP write verification send fails before any datagram is sent", async () => {
    const close = vi.fn();
    let sendCount = 0;
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        sendCount += 1;
        throw new Error("socket send failed");
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: new Promise(() => {}),
        close,
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
        talkTransport: "udp",
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.restored).toBe(false);
    expect(sendCount).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("returns matched: true when readback equals expected value", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const result = await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.after).toBe(50);
    expect(result.expected).toBe(50);
  });

  it("returns matched: false when readback differs from expected value", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [100] }),
      }),
    };

    const result = await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.matched).toBe(false);
    expect(result.after).toBe(100);
  });

  it("sends restore command after readback and reports restored: true", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.restored).toBe(true);
    expect(sentPayloads).toHaveLength(2);
    expect(sentPayloads[1]).toBe("Zoom 100\r\n");
  });

  it("reports restored: false if restore send throws", async () => {
    let callCount = 0;
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        callCount += 1;
        if (callCount > 1) throw new Error("send failed");
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.restored).toBe(false);
  });

  it("sends best-effort restore after the write packet when readback times out", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.reject(new Error("Timed out waiting for OSC callback after 3000ms.")),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.restored).toBe(true);
    expect(sentPayloads).toHaveLength(2);
    expect(sentPayloads[0]).toContain("Zoom 50");
    expect(sentPayloads[1]).toBe("Zoom 100\r\n");
  });

  it("keeps a timeout restore inside the OSC port lock before the next write starts", async () => {
    const events: string[] = [];
    const restoreFinished = deferred<void>();
    let listenCount = 0;
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        const text = payload.toString("ascii");
        if (text.includes("Zoom 50")) {
          events.push("first-write");
          return;
        }
        if (text === "Zoom 100\r\n") {
          events.push("restore-start");
          await restoreFinished.promise;
          events.push("restore-done");
          return;
        }
        if (text.includes("Brightness 10")) {
          events.push("second-write");
        }
      },
      listenForOsc: () => {
        listenCount += 1;
        if (listenCount === 1) {
          return {
            ready: Promise.resolve(),
            message: Promise.reject(new Error("Timed out waiting for OSC callback after 3000ms.")),
          };
        }
        return {
          ready: Promise.resolve(),
          message: Promise.resolve({ address: "/pangolint/verify/second", typeTags: "f", args: [10] }),
        };
      },
    };

    const first = verifyCommandWrite(
      {
        ...baseOptions,
        requestId: "first",
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );
    await waitFor(() => events.includes("restore-start"));

    const second = verifyCommandWrite(
      {
        ...baseOptions,
        requestId: "second",
        command: "Brightness 10",
        readbackPath: "Master.Brightness",
        expectedValue: 10,
      },
      transport,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).not.toContain("second-write");

    restoreFinished.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-write", "restore-start", "restore-done", "second-write"]);
  });

  it("does not send restore when listener readiness fails before the write packet", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: () => ({
        ready: Promise.reject(new Error("bind failed")),
        message: Promise.reject(new Error("bind failed")),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.restored).toBe(false);
    expect(sentPayloads).toEqual([]);
  });

  it("rejects multi-line write commands before binding OSC or sending Talk UDP", async () => {
    const sendTalk = vi.fn(async () => {});
    const listenForOsc = vi.fn(() => ({
      ready: Promise.resolve(),
      message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
    }));

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50\r\nDisableLaserOutput",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
      },
      { sendTalk, listenForOsc },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/single line/i);
    expect(sendTalk).not.toHaveBeenCalled();
    expect(listenForOsc).not.toHaveBeenCalled();
  });

  it("does not send Talk until OSC listener is ready", async () => {
    const events: string[] = [];
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        events.push("send");
      },
      listenForOsc: () => ({
        ready: ready.then(() => {
          events.push("ready");
        }),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const resultPromise = verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    await Promise.resolve();
    expect(events).toEqual([]);

    resolveReady();
    await resultPromise;
    expect(events).toEqual(["ready", "send"]);
  });

  it("returns error on transport failure", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.reject(new Error("port in use")),
        message: Promise.reject(new Error("port in use")),
      }),
    };

    const result = await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.matched).toBe(false);
    expect(result.restored).toBe(false);
    expect(result.error).toBe("port in use");
  });
});
