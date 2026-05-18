import { describe, expect, it } from "vitest";
import { _resetCache, explainDiagnostic, extractSection } from "../src/tools/explainDiagnostic";

describe("extractSection", () => {
  const fixture = ["# Title", "", "## foo", "", "Foo body line.", "", "## bar", "", "Bar body line.", ""].join("\n");

  it("returns the requested section verbatim", () => {
    expect(extractSection(fixture, "foo")).toBe(["## foo", "", "Foo body line."].join("\n"));
  });

  it("matches case-insensitively", () => {
    expect(extractSection(fixture, "FOO")).toContain("Foo body line.");
  });

  it("returns undefined for missing codes", () => {
    expect(extractSection(fixture, "missing")).toBeUndefined();
  });

  it("stops at the next ## heading", () => {
    expect(extractSection(fixture, "foo")).not.toContain("Bar body line.");
  });
});

describe("explainDiagnostic", () => {
  it("loads a real section from the bundled diagnostics doc", () => {
    _resetCache();
    const result = explainDiagnostic({ code: "unknown-command" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.code).toBe("unknown-command");
      expect(result.data.markdown.toLowerCase()).toContain("## unknown-command");
    }
  });

  it("fails on blank input", () => {
    expect(explainDiagnostic({ code: "" }).ok).toBe(false);
  });

  it("fails when the code has no doc entry", () => {
    const result = explainDiagnostic({ code: "no-such-code" });
    expect(result.ok).toBe(false);
  });
});
