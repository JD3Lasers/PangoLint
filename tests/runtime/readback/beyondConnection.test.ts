import { describe, expect, it, vi } from "vitest";
import { checkBeyondConnection } from "../../../src/runtime/readback/beyondReadback";
import type { ReadbackTransport } from "../../../src/runtime/readback/readbackTypes";

describe("checkBeyondConnection", () => {
  it("sends a readback-only OscOutTTS ping and matches the callback", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: (_host, _port, predicate) => {
        const message = {
          address: "/pangolint/ping",
          typeTags: "s",
          args: ["request-123"],
        };
        expect(predicate(message)).toBe(true);
        return {
          ready: Promise.resolve(),
          message: Promise.resolve(message),
        };
      },
    };

    const result = await checkBeyondConnection(
      {
        talkHost: "192.0.2.147",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "request-123",
        timeoutMs: 1000,
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.message?.address).toBe("/pangolint/ping");
    expect(sentPayloads).toEqual(['OscOutTTS "/pangolint/ping", "s", "request-123"\r\n']);
  });

  it("does not send Talk UDP until the OSC listener is ready", async () => {
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
        message: Promise.resolve({
          address: "/pangolint/ping",
          typeTags: "s",
          args: ["request-123"],
        }),
      }),
    };

    const resultPromise = checkBeyondConnection(
      {
        talkHost: "192.0.2.147",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "request-123",
        timeoutMs: 1000,
      },
      transport,
    );

    await Promise.resolve();
    expect(events).toEqual([]);

    resolveReady();
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(events).toEqual(["ready", "send"]);
  });

  it("closes the OSC listener when a TCP ping send fails", async () => {
    const close = vi.fn();
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
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

    const result = await checkBeyondConnection(
      {
        talkHost: "127.0.0.1",
        talkPort: 16062,
        talkTransport: "tcp",
        talkTcpHost: "127.0.0.1",
        talkTcpPort: 16063,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "request-123",
        timeoutMs: 1000,
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("connect ECONNREFUSED");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("returns a readiness failure before sending Talk UDP", async () => {
    const sends: Buffer[] = [];
    const readinessError = new Error("bind failed");
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sends.push(payload);
      },
      listenForOsc: () => ({
        ready: Promise.reject(readinessError),
        message: Promise.reject(readinessError),
      }),
    };

    const result = await checkBeyondConnection(
      {
        talkHost: "192.0.2.147",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "request-123",
        timeoutMs: 1000,
      },
      transport,
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "bind failed",
      }),
    );
    expect(sends).toEqual([]);
  });
});

describe("checkBeyondConnection logger", () => {
  const transport: ReadbackTransport = {
    sendTalk: async () => {},
    listenForOsc: () => ({
      ready: Promise.resolve(),
      message: Promise.resolve({ address: "/pangolint/ping", typeTags: "s", args: ["req-log"] }),
    }),
  };

  it("calls logger at bind, ready, send, callback, and result stages on success", async () => {
    const logs: string[] = [];
    await checkBeyondConnection(
      {
        talkHost: "127.0.0.1",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "req-log",
        timeoutMs: 1000,
        logger: (msg) => logs.push(msg),
      },
      transport,
    );
    expect(logs[0]).toMatch(/binding OSC listener/);
    expect(logs[1]).toMatch(/listener ready/);
    expect(logs[2]).toMatch(/command sent/);
    expect(logs[3]).toMatch(/received callback/);
  });

  it("calls logger with failure message on error", async () => {
    const logs: string[] = [];
    const failTransport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.reject(new Error("bind EADDRINUSE")),
        message: Promise.reject(new Error("bind EADDRINUSE")),
      }),
    };
    const result = await checkBeyondConnection(
      {
        talkHost: "127.0.0.1",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "req-log",
        timeoutMs: 1000,
        logger: (msg) => logs.push(msg),
      },
      failTransport,
    );
    expect(result.ok).toBe(false);
    expect(logs.at(-1)).toMatch(/failed:/);
  });
});
