import { describe, expect, it } from "vitest";
import {
  type LiveBeyondSmokeRuntime,
  liveBeyondSmokeConfigFromEnv,
  parseLiveBeyondSmokeArgs,
  redactedLiveBeyondSmokeConfig,
  runLiveBeyondSmokeChecks,
} from "../../scripts/runtime/liveBeyondSmokeLib";
import type { RunScriptWithOscCaptureResult } from "../../src/runtime/commandBatch/runScriptWithOscCapture";
import type { OscMessage } from "../../src/runtime/osc/osc";
import type { ConnectionCheckResult, PropertyReadbackResult } from "../../src/runtime/readback/readbackTypes";
import type { SendTalkTcpCommandsResult } from "../../src/runtime/talk/talkTcp";

describe("live BEYOND smoke script", () => {
  it("reads public-safe defaults and mode arguments", () => {
    const args = parseLiveBeyondSmokeArgs(["--mode", "connection"]);
    const config = liveBeyondSmokeConfigFromEnv({}, args);

    expect(config).toMatchObject({
      mode: "connection",
      talkTcpHost: "127.0.0.1",
      talkTcpPort: 16063,
      talkUdpHost: "127.0.0.1",
      talkUdpPort: 16062,
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 5000,
      propertyPath: "Master.Brightness",
      propertyTypeTag: "f",
    });
  });

  it("supports runner supplied endpoint settings without exposing the password", () => {
    const config = liveBeyondSmokeConfigFromEnv(
      {
        PANGOLINT_LIVE_BEYOND_HOST: "192.0.2.147",
        PANGOLINT_LIVE_BEYOND_TALK_TCP_PORT: "16063",
        PANGOLINT_LIVE_BEYOND_TALK_UDP_PORT: "16062",
        PANGOLINT_LIVE_BEYOND_TCP_PASSWORD: "secret",
        PANGOLINT_LIVE_BEYOND_OSC_LISTEN_HOST: "0.0.0.0",
        PANGOLINT_LIVE_BEYOND_OSC_LISTEN_PORT: "7000",
        PANGOLINT_LIVE_BEYOND_READBACK_PATH: "Master.Brightness",
        PANGOLINT_LIVE_BEYOND_READBACK_TYPE: "f",
      },
      parseLiveBeyondSmokeArgs(["--mode=all"]),
    );

    expect(config.talkTcpHost).toBe("192.0.2.147");
    expect(config.talkUdpHost).toBe("192.0.2.147");
    expect(redactedLiveBeyondSmokeConfig(config)).toMatchObject({
      talkTcpPasswordConfigured: true,
    });
    expect(JSON.stringify(redactedLiveBeyondSmokeConfig(config))).not.toContain("secret");
  });

  it("allows Talk TCP and Talk UDP hosts to differ", () => {
    const config = liveBeyondSmokeConfigFromEnv({
      PANGOLINT_LIVE_BEYOND_TALK_TCP_HOST: "192.0.2.147",
      PANGOLINT_LIVE_BEYOND_TALK_TCP_PORT: "16063",
      PANGOLINT_LIVE_BEYOND_TALK_UDP_HOST: "localhost",
      PANGOLINT_LIVE_BEYOND_TALK_UDP_PORT: "16062",
    });

    expect(config).toMatchObject({
      talkTcpHost: "192.0.2.147",
      talkTcpPort: 16063,
      talkUdpHost: "localhost",
      talkUdpPort: 16062,
    });
  });

  it("runs the all-mode checks in TCP, readback, then UDP order", async () => {
    const calls: string[] = [];
    const runtime: LiveBeyondSmokeRuntime = {
      sendTalkTcpCommands: async (): Promise<SendTalkTcpCommandsResult> => {
        calls.push("tcp");
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkGreeting: "Welcome to BEYOND!",
          talkReplies: [],
          linesSent: 2,
          payloadsSent: 0,
          bytesSent: 24,
        };
      },
      checkBeyondConnection: async (): Promise<ConnectionCheckResult> => {
        calls.push("osc-ping");
        return {
          ok: true,
          requestId: "ping-request",
          command: "OscOutTTS",
          transport: "tcp",
          talkStatus: "ok",
        };
      },
      readBeyondProperty: async (): Promise<PropertyReadbackResult> => {
        calls.push("readback");
        return {
          ok: true,
          requestId: "property-request",
          propertyPath: "Master.Brightness",
          script: "OscOutTTS",
          value: 100,
          transport: "tcp",
          talkStatus: "ok",
        };
      },
      runScriptWithOscCapture: async (): Promise<RunScriptWithOscCaptureResult> => {
        calls.push("udp-callback");
        const message: OscMessage = {
          address: "/pangolint/live-smoke/udp/request",
          typeTags: "s",
          args: ["request"],
          sourceAddress: "192.0.2.147",
        };
        return {
          ok: true,
          transport: "udp",
          talkStatus: "send-only",
          linesSent: 1,
          payloadsSent: 1,
          bytesSent: 64,
          callbackAddresses: [message.address],
          callbacks: {
            ok: true,
            messages: [message],
            timedOut: false,
          },
        };
      },
    };

    const result = await runLiveBeyondSmokeChecks(liveBeyondSmokeConfigFromEnv({}), runtime, () => {});

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["tcp", "osc-ping", "readback", "udp-callback"]);
    expect(result.steps.map((step) => step.ok)).toEqual([true, true, true, true]);
  });

  it("fails the UDP smoke when the callback is missing", async () => {
    const runtime: LiveBeyondSmokeRuntime = {
      sendTalkTcpCommands: async () => {
        throw new Error("unexpected TCP call");
      },
      checkBeyondConnection: async () => {
        throw new Error("unexpected OSC ping call");
      },
      readBeyondProperty: async () => {
        throw new Error("unexpected readback call");
      },
      runScriptWithOscCapture: async (): Promise<RunScriptWithOscCaptureResult> => ({
        ok: true,
        transport: "udp",
        talkStatus: "send-only",
        linesSent: 1,
        payloadsSent: 1,
        bytesSent: 64,
        callbackAddresses: ["/pangolint/live-smoke/udp/request"],
        callbacks: {
          ok: false,
          messages: [],
          timedOut: true,
          error: "Timed out waiting for OSC callbacks.",
        },
      }),
    };

    const result = await runLiveBeyondSmokeChecks(
      liveBeyondSmokeConfigFromEnv({}, parseLiveBeyondSmokeArgs(["--mode", "udp"])),
      runtime,
      () => {},
    );

    expect(result.ok).toBe(false);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      name: "Talk UDP callback smoke",
      ok: false,
      error: "Timed out waiting for OSC callbacks.",
    });
  });
});
