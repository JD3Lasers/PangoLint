import { describe, expect, it } from "vitest";

import {
  copySignature,
  insertAtCursor,
  isSidebarCommandId,
  openDiagnosticDocs,
  openReference,
  refresh,
  revealDiagnostic,
} from "../../src/sidebar/model/actions";

describe("sidebar action descriptors", () => {
  it("insertAtCursor packages snippet under the registered command id", () => {
    const action = insertAtCursor('OscOutString "/x", "s", "v"');
    expect(action.id).toBe("pangolint.sidebar.insertAtCursor");
    expect(action.payload).toEqual({ snippet: 'OscOutString "/x", "s", "v"' });
  });

  it("copySignature packages text", () => {
    const action = copySignature("OscOutString");
    expect(action.id).toBe("pangolint.sidebar.copySignature");
    expect(action.payload).toEqual({ text: "OscOutString" });
  });

  it("openReference packages target", () => {
    const action = openReference("https://example.invalid/osc");
    expect(action.id).toBe("pangolint.sidebar.openReference");
    expect(action.payload).toEqual({ target: "https://example.invalid/osc" });
  });

  it("revealDiagnostic packages uri/line/character", () => {
    const action = revealDiagnostic("file:///a.bcode", 41, 4);
    expect(action.id).toBe("pangolint.sidebar.revealDiagnostic");
    expect(action.payload).toEqual({ uri: "file:///a.bcode", line: 41, character: 4 });
  });

  it("openDiagnosticDocs packages rule", () => {
    const action = openDiagnosticDocs("unknown-command");
    expect(action.id).toBe("pangolint.sidebar.openDiagnosticDocs");
    expect(action.payload).toEqual({ rule: "unknown-command" });
  });

  it("refresh emits an empty payload", () => {
    const action = refresh();
    expect(action.id).toBe("pangolint.sidebar.refresh");
    expect(action.payload).toEqual({});
  });

  it("isSidebarCommandId guards against unknown ids", () => {
    expect(isSidebarCommandId("pangolint.sidebar.refresh")).toBe(true);
    expect(isSidebarCommandId("pangolint.sidebar.copySignature")).toBe(true);
    expect(isSidebarCommandId("pangolint.unrelated")).toBe(false);
    expect(isSidebarCommandId("")).toBe(false);
  });
});
