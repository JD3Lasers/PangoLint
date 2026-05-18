import { describe, expect, it } from "vitest";
import type { McpConfig } from "../src/config";
import { getServerConfig } from "../src/tools/getServerConfig";

const baseConfig: McpConfig = {
  runtimeReadEnabled: false,
  runtimeWriteEnabled: false,
  beyondTalkHost: "127.0.0.1",
  beyondTalkPort: 16062,
  oscListenHost: "0.0.0.0",
  oscListenPort: 7000,
  readbackTimeoutMs: 3000,
};

describe("getServerConfig", () => {
  it("returns knowledge-only tools when runtime is disabled", () => {
    const result = getServerConfig("0.0.1", baseConfig);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runtimeEnabled).toBe(false);
      expect(result.data.runtimeReadEnabled).toBe(false);
      expect(result.data.runtimeWriteEnabled).toBe(false);
      expect(result.data.availableTools).toContain("lintScript");
      expect(result.data.availableTools).toContain("lookupPropertyControls");
      expect(result.data.availableTools).toContain("searchPropertyControls");
      expect(result.data.availableTools).not.toContain("runScript");
      expect(result.data.availableTools).not.toContain("readBeyondProperty");
      expect(result.data.responseGuidance.objectLookups).toContain("compact results by default");
      expect(result.data.responseGuidance.objectLookups).toContain("includeDetails");
    }
  });

  it("includes read runtime tools when read runtime is enabled", () => {
    const result = getServerConfig("0.0.1", { ...baseConfig, runtimeReadEnabled: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runtimeEnabled).toBe(true);
      expect(result.data.runtimeReadEnabled).toBe(true);
      expect(result.data.runtimeWriteEnabled).toBe(false);
      expect(result.data.availableTools).not.toContain("runScript");
      expect(result.data.availableTools).toContain("readBeyondProperty");
      expect(result.data.availableTools).toContain("healthCheck");
    }
  });

  it("includes runScript only when write runtime is enabled", () => {
    const result = getServerConfig("0.0.1", { ...baseConfig, runtimeReadEnabled: true, runtimeWriteEnabled: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runtimeEnabled).toBe(true);
      expect(result.data.runtimeReadEnabled).toBe(true);
      expect(result.data.runtimeWriteEnabled).toBe(true);
      expect(result.data.availableTools).toContain("runScript");
      expect(result.data.availableTools).toContain("readBeyondProperty");
      expect(result.data.availableTools).toContain("healthCheck");
    }
  });

  it("echoes the version + transport configuration", () => {
    const result = getServerConfig("9.9.9", baseConfig);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe("9.9.9");
      expect(result.data.beyondTalkHost).toBe("127.0.0.1");
      expect(result.data.beyondTalkPort).toBe(16062);
    }
  });
});
