// URL hash routing. Allows internal links:
//   #cmd=BlackOut
//   #obj=Master
//   #prop=Master.BPM
//   #cat=Live+Control
//   #q=metro+shift
//   #cue=Text
//   #effect=Oscillating+effect+%3A%3A+Zoom
//   #component=universe.drop-effect
// State writes back to the URL via History API replaceState so back/
// forward navigation is sane.

import { getVisibleDetailSelection, type ObjectSection, type ReferenceState, type ViewMode } from "./state";

interface ParsedHash {
  view?: ViewMode;
  cmd?: string;
  obj?: string;
  prop?: string;
  cat?: string;
  q?: string;
  sec?: string;
  cue?: string;
  effect?: string;
  component?: string;
}

function parseHash(hash: string): ParsedHash {
  const out: ParsedHash = {};
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return out;
  for (const pair of raw.split("&")) {
    const [k, v] = pair.split("=");
    if (!k) continue;
    const decoded = v ? decodeURIComponent(v.replace(/\+/g, " ")) : "";
    if (k === "view") {
      if (decoded === "objects" || decoded === "commands") out.view = decoded;
    } else if (
      k === "cmd" ||
      k === "obj" ||
      k === "prop" ||
      k === "cat" ||
      k === "q" ||
      k === "sec" ||
      k === "cue" ||
      k === "effect" ||
      k === "component"
    ) {
      out[k] = decoded;
    }
  }
  return out;
}

function buildHash(state: ReferenceState): string {
  const parts: string[] = [];
  // Only persist the mode in the URL when it deviates from the default
  // ("commands"); keeps the hash short for the common case.
  if (state.viewMode === "objects") parts.push("view=objects");
  if (state.viewMode === "objects" && state.objectSection !== "schemas") {
    parts.push(`sec=${encode(state.objectSection)}`);
  }
  if (state.filter.query) parts.push(`q=${encode(state.filter.query)}`);
  if (state.filter.category) parts.push(`cat=${encode(state.filter.category)}`);
  const detailSelection = getVisibleDetailSelection(state);
  if (detailSelection?.kind === "command") parts.push(`cmd=${encode(detailSelection.canonical)}`);
  if (detailSelection?.kind === "object") {
    parts.push(`obj=${encode(detailSelection.name)}`);
    if (detailSelection.propertyPath) parts.push(`prop=${encode(detailSelection.propertyPath)}`);
  }
  if (detailSelection?.kind === "object-reference" && detailSelection.selection.section === "cue-types") {
    parts.push(`cue=${encode(detailSelection.selection.id)}`);
  }
  if (detailSelection?.kind === "object-reference" && detailSelection.selection.section === "fx") {
    parts.push(`effect=${encode(detailSelection.selection.id)}`);
  }
  if (detailSelection?.kind === "object-reference" && detailSelection.selection.section === "universe-components") {
    parts.push(`component=${encode(detailSelection.selection.id)}`);
  }
  return parts.length ? `#${parts.join("&")}` : "";
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function parsedObjectSection(sec: string | undefined): ObjectSection {
  if (sec === "fx" || sec === "cue-types" || sec === "universe-components") return sec;
  return "schemas";
}

function commandHashTarget(state: ReferenceState, value: string): string | null {
  const requested = value.trim();
  if (!requested) return null;
  if (state.commandsByCanonical.has(requested)) return requested;
  const requestedLower = requested.toLowerCase();
  const match = state.catalog.commands.find(
    (command) =>
      command.canonical.toLowerCase() === requestedLower ||
      command.aliases.some((alias) => alias.toLowerCase() === requestedLower),
  );
  return match?.canonical ?? null;
}

export function applyHashToState(state: ReferenceState, hash: string): void {
  const parsed = parseHash(hash);
  const objectReferenceSection = parsed.cue
    ? "cue-types"
    : parsed.effect
      ? "fx"
      : parsed.component
        ? "universe-components"
        : null;
  // Resolve mode first so subsequent filter/selection writes land in
  // the right vocabulary. selectObject/select also flip mode if
  // needed; this just handles the "no selection, view=objects" case.
  if (parsed.view && parsed.view !== state.viewMode) state.setViewMode(parsed.view);
  if (objectReferenceSection && state.viewMode !== "objects") state.setViewMode("objects");
  if (state.viewMode === "objects") state.setObjectSection(objectReferenceSection ?? parsedObjectSection(parsed.sec));
  state.setQuery(parsed.q ?? "");
  state.setCategory(parsed.cat ?? null);
  // Object selection wins over command selection if both appear in
  // the hash (shouldn't happen in practice, but defensive).
  if (parsed.obj) {
    state.selectObject(parsed.obj, parsed.prop ?? null);
  } else if (parsed.cue) {
    state.selectObjectReference("cue-types", parsed.cue);
  } else if (parsed.effect) {
    state.selectObjectReference("fx", parsed.effect);
  } else if (parsed.component) {
    state.selectObjectReference("universe-components", parsed.component);
  } else if (parsed.cmd && parsed.view !== "objects") {
    if (state.viewMode !== "commands") state.setViewMode("commands");
    state.select(commandHashTarget(state, parsed.cmd));
  } else {
    state.select(null);
  }
}

/**
 * Install router. Reads initial state from URL, then keeps URL in sync
 * with state. Listens for hashchange so back/forward navigation works.
 */
export function installRouter(state: ReferenceState): void {
  // Initial route
  applyHashToState(state, window.location.hash);

  const syncHashFromState = (): void => {
    const next = buildHash(state);
    const current = window.location.hash;
    if (next === current) return;
    if (next) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
    } else {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  };

  // State -> URL
  state.subscribe(syncHashFromState);
  syncHashFromState();

  // URL -> state (back/forward)
  window.addEventListener("hashchange", () => applyHashToState(state, window.location.hash));
}
