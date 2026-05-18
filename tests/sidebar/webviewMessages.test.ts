// Smoke tests for the webview ↔ host message protocol type guards.
// The webview-bundle SidebarState is intentionally not unit-tested here:
// it depends on DOM-only types (HTMLElement etc.) and is exercised
// directly by the bundle's render functions when the extension runs.

import { describe, expect, it } from "vitest";

import { isHostToWebviewMessage, isWebviewToHostMessage } from "../../src/sidebar/view/webview/messages";
import { isObjectsWebviewToHostMessage } from "../../src/sidebar/view/webview/objectsMessages";

describe("sidebar webview message protocol", () => {
  it("accepts every host→webview variant via isHostToWebviewMessage", () => {
    expect(
      isHostToWebviewMessage({
        type: "init",
        payload: { commands: [], categories: [] },
      }),
    ).toBe(true);
    expect(isHostToWebviewMessage({ type: "detail", command: "Cue", detail: undefined })).toBe(true);
    expect(
      isHostToWebviewMessage({
        type: "actionResult",
        action: "insertAtCursor",
        command: "Cue",
        ok: true,
      }),
    ).toBe(true);
    expect(isHostToWebviewMessage({ type: "selectCommand", command: "Brightness" })).toBe(true);
  });

  it("rejects malformed host→webview messages", () => {
    expect(isHostToWebviewMessage(null)).toBe(false);
    expect(isHostToWebviewMessage(undefined)).toBe(false);
    expect(isHostToWebviewMessage("not-a-message")).toBe(false);
    expect(isHostToWebviewMessage({ type: "ready" })).toBe(false);
    expect(isHostToWebviewMessage({ type: "selectCommand" })).toBe(false);
    expect(isHostToWebviewMessage({})).toBe(false);
  });

  it("accepts every webview→host variant via isWebviewToHostMessage", () => {
    expect(isWebviewToHostMessage({ type: "ready" })).toBe(true);
    expect(isWebviewToHostMessage({ type: "requestDetail", command: "Cue" })).toBe(true);
    expect(isWebviewToHostMessage({ type: "insertAtCursor", command: "Cue", snippet: "Cue" })).toBe(true);
    expect(isWebviewToHostMessage({ type: "copySignature", command: "Cue", text: "Cue" })).toBe(true);
    expect(isWebviewToHostMessage({ type: "openReference", command: "Cue" })).toBe(true);
  });

  it("rejects malformed webview→host messages", () => {
    expect(isWebviewToHostMessage(null)).toBe(false);
    expect(isWebviewToHostMessage(undefined)).toBe(false);
    expect(isWebviewToHostMessage(42)).toBe(false);
    expect(isWebviewToHostMessage({ type: "init" })).toBe(false); // host-only variant
    expect(isWebviewToHostMessage({})).toBe(false);
  });

  it("validates object-webview insert and command payloads", () => {
    expect(isObjectsWebviewToHostMessage({ type: "insertAtCursor", snippet: 'SetProp "Master.Brightness", ' })).toBe(
      true,
    );
    expect(isObjectsWebviewToHostMessage({ type: "insertAtCursor", path: "Master.Brightness" })).toBe(false);
    expect(isObjectsWebviewToHostMessage({ type: "copyPath", text: "Master.Brightness" })).toBe(true);
    expect(isObjectsWebviewToHostMessage({ type: "copyPath", path: "Master.Brightness" })).toBe(false);
    expect(isObjectsWebviewToHostMessage({ type: "jumpToCommand", commands: ["Brightness"] })).toBe(true);
    expect(isObjectsWebviewToHostMessage({ type: "jumpToCommand" })).toBe(false);
    expect(isObjectsWebviewToHostMessage({ type: "jumpToCommand", commands: [42] })).toBe(false);
  });
});
