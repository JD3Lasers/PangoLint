import { afterEach, describe, expect, it, vi } from "vitest";
import { applyHashToState, installRouter } from "../../src/reference/bundle/router";
import { getVisibleDetailSelection, ReferenceState } from "../../src/reference/bundle/state";
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

function commandCatalog(): ReferenceCatalog {
  return {
    ...emptyCatalog(),
    meta: {
      ...emptyCatalog().meta,
      total: 2,
      categories: [{ name: "General", count: 2, order: 0 }],
    },
    commands: [
      {
        canonical: "BlackOut",
        kind: "command",
        aliases: ["Blackout"],
        category: "General",
        safetyTier: "T2",
        description: "",
        forms: [],
        notes: [],
        tags: [],
      },
      {
        canonical: "WaitForBeat",
        kind: "command",
        aliases: [],
        category: "General",
        safetyTier: "T0",
        description: "",
        forms: [],
        notes: [],
        tags: [],
      },
    ],
  };
}

function installFakeBrowserLocation(initialHash = ""): {
  dispatch: (type: string) => void;
  location: { pathname: string; search: string; hash: string };
  pushState: ReturnType<typeof vi.fn>;
  replaceState: ReturnType<typeof vi.fn>;
} {
  const listeners = new Map<string, Array<(event: Event) => void>>();
  const location = { pathname: "/pangoscript-reference.html", search: "", hash: initialHash };
  const writeUrl = (url?: string | URL | null): void => {
    const text = url ? String(url) : "";
    const hashStart = text.indexOf("#");
    location.hash = hashStart >= 0 ? text.slice(hashStart) : "";
  };
  const pushState = vi.fn((_state: unknown, _title: string, url?: string | URL | null) => writeUrl(url));
  const replaceState = vi.fn((_state: unknown, _title: string, url?: string | URL | null) => writeUrl(url));
  vi.stubGlobal("history", { pushState, replaceState });
  vi.stubGlobal("window", {
    location,
    addEventListener: (type: string, listener: EventListener) => {
      const callbacks = listeners.get(type) ?? [];
      callbacks.push(listener);
      listeners.set(type, callbacks);
    },
  });
  return {
    dispatch: (type: string) => {
      for (const listener of listeners.get(type) ?? []) listener({ type } as Event);
    },
    location,
    pushState,
    replaceState,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("keeps object hashes visible when a reference selector is also present", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#obj=Master&cue=Text");

    expect(state.viewMode).toBe("objects");
    expect(state.objectSection).toBe("schemas");
    expect(state.selectedObject).toBe("Master");
    expect(state.selectedObjectReference).toBeNull();
    expect(getVisibleDetailSelection(state)).toEqual({
      kind: "object",
      name: "Master",
      propertyPath: null,
    });
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

  it("applies selected Universe Component reference rows from the hash", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#view=objects&sec=universe-components&component=universe.drop-effect");

    expect(state.objectSection).toBe("universe-components");
    expect(state.selectedObjectReference).toEqual({
      section: "universe-components",
      id: "universe.drop-effect",
    });
  });

  it("applies selected Universe Component reference rows without a sec value", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#component=universe.drop-effect");

    expect(state.viewMode).toBe("objects");
    expect(state.objectSection).toBe("universe-components");
    expect(state.selectedObjectReference).toEqual({
      section: "universe-components",
      id: "universe.drop-effect",
    });
  });

  it("does not let a command value override an Object Tree browse hash", () => {
    const state = new ReferenceState(emptyCatalog());
    state.select("BlackOut");

    applyHashToState(state, "#view=objects&cmd=BlackOut");

    expect(state.viewMode).toBe("objects");
    expect(state.selectedCanonical).toBeNull();
  });

  it("selects a command from a command hash", () => {
    const state = new ReferenceState(commandCatalog());

    applyHashToState(state, "#cmd=WaitForBeat");

    expect(state.viewMode).toBe("commands");
    expect(state.selectedCanonical).toBe("WaitForBeat");
  });

  it("preserves hash filters when an object hash switches from command mode", () => {
    const state = new ReferenceState(emptyCatalog());

    applyHashToState(state, "#obj=Master&q=brightness");

    expect(state.viewMode).toBe("objects");
    expect(state.selectedObject).toBe("Master");
    expect(state.filter).toEqual({ query: "brightness", category: null });
  });

  it("preserves hash filters when a command hash switches from object mode", () => {
    const state = new ReferenceState(commandCatalog());
    state.setViewMode("objects");

    applyHashToState(state, "#cmd=WaitForBeat&q=beat&cat=General");

    expect(state.viewMode).toBe("commands");
    expect(state.selectedCanonical).toBe("WaitForBeat");
    expect(state.filter).toEqual({ query: "beat", category: "General" });
  });

  it("resolves case-insensitive command and alias hashes to the browsable command", () => {
    const state = new ReferenceState(commandCatalog());

    applyHashToState(state, "#cmd=blackout");
    expect(state.selectedCanonical).toBe("BlackOut");

    applyHashToState(state, "#cmd=Blackout");
    expect(state.selectedCanonical).toBe("BlackOut");
  });

  it("clears stale command hashes instead of selecting a missing row", () => {
    const state = new ReferenceState(commandCatalog());

    applyHashToState(state, "#cmd=RemovedCommand");

    expect(state.viewMode).toBe("commands");
    expect(state.selectedCanonical).toBeNull();
  });

  it("keeps stale command hashes in command view after Object Tree browsing", () => {
    const state = new ReferenceState(commandCatalog());
    state.setViewMode("objects");

    applyHashToState(state, "#cmd=RemovedCommand");

    expect(state.viewMode).toBe("commands");
    expect(state.selectedCanonical).toBeNull();
  });
});

describe("installRouter", () => {
  it("pushes browser history entries for reference selections", () => {
    const browser = installFakeBrowserLocation();
    const state = new ReferenceState(commandCatalog());
    installRouter(state);

    state.select("BlackOut");

    expect(browser.pushState).toHaveBeenCalledWith(null, "", "/pangoscript-reference.html#cmd=BlackOut");
    expect(browser.replaceState).not.toHaveBeenCalled();
    expect(browser.location.hash).toBe("#cmd=BlackOut");
  });

  it("replaces browser history entries for filter changes", () => {
    const browser = installFakeBrowserLocation();
    const state = new ReferenceState(commandCatalog());
    installRouter(state);

    state.setQuery("b");
    state.setQuery("bl");
    state.setCategory("General");

    expect(browser.pushState).not.toHaveBeenCalled();
    expect(browser.replaceState).toHaveBeenLastCalledWith(null, "", "/pangoscript-reference.html#q=bl&cat=General");
    expect(browser.location.hash).toBe("#q=bl&cat=General");
  });

  it("pushes a browser history entry when selecting from a filtered list", () => {
    const browser = installFakeBrowserLocation();
    const state = new ReferenceState(commandCatalog());
    installRouter(state);
    state.setQuery("black");
    browser.pushState.mockClear();
    browser.replaceState.mockClear();

    state.select("BlackOut");

    expect(browser.pushState).toHaveBeenCalledWith(null, "", "/pangoscript-reference.html#q=black&cmd=BlackOut");
    expect(browser.replaceState).not.toHaveBeenCalled();
    expect(browser.location.hash).toBe("#q=black&cmd=BlackOut");
  });

  it("applies browser back navigation from popstate without writing a new history entry", () => {
    const browser = installFakeBrowserLocation("#cmd=BlackOut");
    const state = new ReferenceState(commandCatalog());
    installRouter(state);
    browser.pushState.mockClear();
    browser.replaceState.mockClear();

    browser.location.hash = "#cmd=WaitForBeat";
    browser.dispatch("popstate");

    expect(state.selectedCanonical).toBe("WaitForBeat");
    expect(browser.pushState).not.toHaveBeenCalled();
    expect(browser.replaceState).not.toHaveBeenCalled();
  });
});
