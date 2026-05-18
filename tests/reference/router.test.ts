import { describe, expect, it } from "vitest";
import { applyHashToState } from "../../src/reference/bundle/router";
import { ReferenceState } from "../../src/reference/bundle/state";
import type { ReferenceCatalog } from "../../src/reference/bundle/types";

function emptyCatalog(): ReferenceCatalog {
  return {
    meta: {
      generatedAt: "2026-01-01T00:00:00Z",
      version: "0.0.0",
      total: 0,
      categories: [],
      coverage: { total: 0, mapped: 0, noDirectProperty: 0, deferred: 0, unknown: 0 },
    },
    commands: [],
    objects: [],
  };
}

describe("applyHashToState", () => {
  it("resets objectSection to schemas when an objects hash omits sec", () => {
    const state = new ReferenceState(emptyCatalog());
    state.setViewMode("objects");
    state.setObjectSection("fx");

    applyHashToState(state, "#view=objects");

    expect(state.objectSection).toBe("schemas");
  });

  it("resets objectSection to schemas when sec is invalid", () => {
    const state = new ReferenceState(emptyCatalog());
    state.setViewMode("objects");
    state.setObjectSection("cue-types");

    applyHashToState(state, "#view=objects&sec=unknown");

    expect(state.objectSection).toBe("schemas");
  });

  it("applies valid object sections from the hash", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#view=objects&sec=cue-types");

    expect(state.objectSection).toBe("cue-types");
  });

  it("applies selected Cue Type reference rows from the hash", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#view=objects&sec=cue-types&cue=Text");

    expect(state.objectSection).toBe("cue-types");
    expect(state.selectedObjectReference).toEqual({ section: "cue-types", id: "Text" });
  });

  it("applies selected Cue Type reference rows without a sec value", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#cue=Text");

    expect(state.viewMode).toBe("objects");
    expect(state.objectSection).toBe("cue-types");
    expect(state.selectedObjectReference).toEqual({ section: "cue-types", id: "Text" });
  });

  it("applies selected FX Effect reference rows from the hash", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#view=objects&sec=fx&effect=Oscillating+effect+%3A%3A+Zoom");

    expect(state.objectSection).toBe("fx");
    expect(state.selectedObjectReference).toEqual({ section: "fx", id: "Oscillating effect :: Zoom" });
  });

  it("applies selected FX Effect reference rows without a sec value", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#effect=Oscillating+effect+%3A%3A+Zoom");

    expect(state.viewMode).toBe("objects");
    expect(state.objectSection).toBe("fx");
    expect(state.selectedObjectReference).toEqual({ section: "fx", id: "Oscillating effect :: Zoom" });
  });
});
