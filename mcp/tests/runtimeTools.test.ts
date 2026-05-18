import { describe, expect, it, vi } from "vitest";
import { parseCommandCatalog } from "../../src/knowledge/catalog";
import type { CommandKnowledgeEntry } from "../../src/knowledge/knowledgeBase";
import { buildPropertyIndex } from "../../src/knowledge/propertyIndex";
import { PANGO_ANALYSIS_LIMITS } from "../../src/language/analysisLimits";
import type { ReadbackOscListener, ReadbackTransport } from "../../src/runtime/beyondReadback";
import type { OscMessage } from "../../src/runtime/osc";
import type { McpConfig } from "../src/config";
import { healthCheck } from "../src/tools/healthCheck";
import { readBeyondProperty } from "../src/tools/readBeyondProperty";
import { runScript } from "../src/tools/runScript";

const readEnabledConfig: McpConfig = {
  runtimeReadEnabled: true,
  runtimeWriteEnabled: false,
  beyondTalkHost: "127.0.0.1",
  beyondTalkPort: 16062,
  oscListenHost: "0.0.0.0",
  oscListenPort: 7000,
  readbackTimeoutMs: 100,
};
const writeEnabledConfig: McpConfig = { ...readEnabledConfig, runtimeWriteEnabled: true };
const disabledConfig: McpConfig = { ...readEnabledConfig, runtimeReadEnabled: false, runtimeWriteEnabled: false };

describe("healthCheck", () => {
  it("returns blocked when runtime is disabled", async () => {
    const result = await healthCheck(disabledConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocked).toBe(true);
      expect(result.error).toContain("PANGOLINT_MCP_RUNTIME_READ=enabled");
    }
  });

  it("returns reachable when DNS + UDP socket check succeed", async () => {
    let now = 1000;
    const result = await healthCheck(readEnabledConfig, {
      resolve: async () => ({ address: "127.0.0.1", family: 4 }),
      socketCheck: async () => {
        now += 5;
      },
      now: () => now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reachable).toBe(true);
      expect(result.data.resolvedAddress).toBe("127.0.0.1");
      expect(result.data.family).toBe(4);
      expect(result.data.elapsedMs).toBe(5);
    }
  });

  it("returns reachable=false with a dns error when resolution fails", async () => {
    const result = await healthCheck(readEnabledConfig, {
      resolve: async () => {
        throw new Error("ENOTFOUND");
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reachable).toBe(false);
      expect(result.data.error).toContain("dns lookup failed");
    }
  });

  it("returns reachable=false with a socket error when the socket check fails", async () => {
    const result = await healthCheck(readEnabledConfig, {
      resolve: async () => ({ address: "127.0.0.1", family: 4 }),
      socketCheck: async () => {
        throw new Error("EACCES");
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reachable).toBe(false);
      expect(result.data.error).toContain("udp connect failed");
    }
  });
});

function fakeReadbackTransport(value: string | number): ReadbackTransport {
  let callbackAddress = "/pangolint/readback/unset";
  let resolveSent: () => void = () => {};
  const sent = new Promise<void>((resolve) => {
    resolveSent = resolve;
  });
  return {
    sendTalk: vi.fn(async (_host, _port, payload) => {
      callbackAddress = payload.toString("ascii").match(/OscOutTTS "([^"]+)"/)?.[1] ?? callbackAddress;
      resolveSent();
    }),
    listenForOsc: (_host, _port, _pred, _timeout): ReadbackOscListener => ({
      ready: Promise.resolve(),
      message: sent.then(() => {
        const message = {
          address: callbackAddress,
          typeTags: typeof value === "string" ? "s" : "f",
          args: [value],
          sourceAddress: "127.0.0.1",
        } satisfies OscMessage;
        expect(_pred(message)).toBe(true);
        return message;
      }),
    }),
  };
}

describe("readBeyondProperty", () => {
  it("returns blocked when runtime is disabled", async () => {
    const result = await readBeyondProperty({ path: "Master.Brightness" }, disabledConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.blocked).toBe(true);
  });

  it("returns the readback value when the read succeeds", async () => {
    const result = await readBeyondProperty({ path: "Master.Brightness" }, readEnabledConfig, {
      transport: fakeReadbackTransport(50),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(true);
      expect(result.data.value).toBe(50);
      expect(result.data.path).toBe("Master.Brightness");
    }
  });

  it("fails when path is missing", async () => {
    const result = await readBeyondProperty({ path: "" }, readEnabledConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("path is required");
  });

  it("rejects script-shaped property paths before transport setup", async () => {
    const sendTalk = vi.fn(async () => {});
    const listenForOsc = vi.fn(
      (_host, _port, _pred, _timeout): ReadbackOscListener => ({
        ready: Promise.resolve(),
        message: Promise.resolve({
          address: "/pangolint/readback/x",
          typeTags: "f",
          args: [50],
        } satisfies OscMessage),
      }),
    );

    const result = await readBeyondProperty({ path: "Master.Brightness\nDisableLaserOutput" }, readEnabledConfig, {
      transport: { sendTalk, listenForOsc },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Invalid property path");
    expect(sendTalk).not.toHaveBeenCalled();
    expect(listenForOsc).not.toHaveBeenCalled();
  });
});

describe("runScript", () => {
  const catalog = parseCommandCatalog(["Brightness|Brightness 100"].join("\n"));
  const knowledgeByName = new Map<string, CommandKnowledgeEntry>();
  const propertyIndex = buildPropertyIndex({
    schemaVersion: 1,
    generatedAt: "",
    generatedFrom: "test",
    schemas: [],
  });

  it("returns blocked when write runtime is disabled", async () => {
    const result = await runScript({ text: "Brightness 50" }, readEnabledConfig, {
      catalog,
      knowledgeByName,
      propertyIndex,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocked).toBe(true);
      expect(result.error).toContain("PANGOLINT_MCP_RUNTIME_WRITE=enabled");
    }
  });

  it("refuses to send when the script has error-severity diagnostics", async () => {
    const send = vi.fn(async () => {});
    const result = await runScript(
      { text: '"unclosed string' },
      writeEnabledConfig,
      { catalog, knowledgeByName, propertyIndex },
      { send },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(false);
      expect(result.data.refusedDueToErrors).toBe(true);
      expect(result.data.errorCount).toBeGreaterThan(0);
      expect(result.data.linesSent).toBe(0);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects oversized scripts before linting or sending", async () => {
    const send = vi.fn(async () => {});
    const result = await runScript(
      { text: "x".repeat(PANGO_ANALYSIS_LIMITS.maxMcpTextChars + 1) },
      writeEnabledConfig,
      { catalog, knowledgeByName, propertyIndex },
      { send },
    );

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("text exceeds") });
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses to send when analysis limits prevent full linting", async () => {
    const send = vi.fn(async () => {});
    const result = await runScript(
      { text: "Brightness 50\n".repeat(PANGO_ANALYSIS_LIMITS.maxDocumentLines + 1) },
      writeEnabledConfig,
      { catalog, knowledgeByName, propertyIndex },
      { send },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(false);
      expect(result.data.refusedDueToAnalysisLimit).toBe(true);
      expect(result.data.linesSent).toBe(0);
      expect(result.data.diagnostics.map((diagnostic) => diagnostic.code)).toContain("analysis-limited");
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses Talk UDP control-flow scripts after linting", async () => {
    const send = vi.fn(async () => {});
    const result = await runScript(
      {
        text: [
          'OscOutTTS "/pangolint/test/start", "s", "mcp-control-flow-001"',
          "if (1 = 1) goto Done",
          "Done:",
          "exit",
        ].join("\n"),
      },
      writeEnabledConfig,
      { catalog, knowledgeByName, propertyIndex },
      { send },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(false);
      expect(result.data.refusedDueToErrors).toBeUndefined();
      expect(result.data.error).toMatch(/Talk UDP.*straight-line command batches/i);
      expect(result.data.linesSent).toBe(0);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("sends when the script lints clean", async () => {
    const send = vi.fn(async () => {});
    const result = await runScript(
      { text: "Brightness 50" },
      writeEnabledConfig,
      { catalog, knowledgeByName, propertyIndex },
      { send },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(true);
      expect(result.data.linesSent).toBe(1);
      expect(result.data.payloadsSent).toBeGreaterThan(0);
      expect(result.data.errorCount).toBe(0);
    }
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends despite warnings/hints (only error-severity blocks)", async () => {
    const send = vi.fn(async () => {});
    // 'BogusCommand' is an unknown command — warning level, not error.
    const result = await runScript(
      { text: "BogusCommand 1" },
      writeEnabledConfig,
      { catalog, knowledgeByName, propertyIndex },
      { send },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(true);
      expect(result.data.warningCount).toBeGreaterThan(0);
      expect(result.data.refusedDueToErrors).toBeUndefined();
    }
    expect(send).toHaveBeenCalled();
  });
});
