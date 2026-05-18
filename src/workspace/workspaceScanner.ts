// Scans .BeyondCode files in the workspace to discover button names under
// user-registered universe panels. Builds a PropertyIndex so the linter
// can offer completion/hover for the user's own universes (COLORPICKER,
// SHOWKONTROL, etc. — whatever they've classified via the code action).
//
// Universes inherit the canonical UniversePanel schema (the 17-prop
// per-button shape derived from BEYOND's Object Tree data). Workspace
// scanning supplies the discovered button names as arrayIndices, so
// `Panel.<TAB>` suggests the user's actual buttons and
// `Panel.<button>.<TAB>` suggests the canonical button props.
//
// Zone aliases and Master aliases inherit canonical Zone/Master schemas
// directly — no scanning needed.

import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { buildPropertyIndex, type KnownObjectSchema, type PropertyIndex } from "../knowledge/propertyIndex";
import { PANGO_ANALYSIS_LIMITS } from "../language/analysisLimits";
import { splitCodeAndComment, stripStringLiterals } from "../language/parser";
import type { UserObjectsRegistry } from "./userObjects";

// Property-path identifier pattern: <Root>.<seg>(.<seg>)+ where seg is an
// identifier or numeric index.
const PATH_RE = /\b([A-Za-z_][A-Za-z0-9_]*)(?:\.(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+)){2,}\b/g;

type ButtonShape = "effect" | "zonePad" | "plain";

interface RootScan {
  /** First-observed casing of the root identifier. */
  displayName: string;
  /** Button names observed under this root (the segment between root and leaf prop). */
  buttonNames: Set<string>;
  /**
   * Observed shape per button (lowercased button name → highest-confidence
   * shape signal). "effect" or "zonePad" overrides any prior signal (last
   * wins); "plain" only fills a previously-unset entry.
   */
  buttonShapes: Map<string, ButtonShape>;
  /** Distinct file paths observed, grouped by parent folder. */
  filesByFolder: Map<string, Set<string>>;
}

/**
 * Walks every .BeyondCode file in the workspace and records button names
 * appearing under registered universe roots. Returns a PropertyIndex
 * containing one schema per scanned universe (UniversePanel-shaped, with
 * discovered button names as arrayIndices), plus zone-alias entries that
 * inherit the bundled Zone schema, plus master-alias entries that inherit
 * the bundled Master schema.
 */
export interface WorkspaceScanResult {
  index: PropertyIndex;
  /** Number of .BeyondCode files scanned. */
  fileCount: number;
  /** Per-universe discovered-button-name counts (for diagnostics). */
  universePropertyCounts: Map<string, number>;
}

export interface WorkspaceScanOptions {
  /**
   * When true (default), unknown property-path roots that appear in 2+
   * `.BeyondCode` files in the same parent folder are auto-discovered as
   * folder-scoped universes (inherit UniversePanel). Mirrors BEYOND's
   * workspace-scoped object visibility. Setting key:
   * `pangolint.folderScopedUniverses`.
   */
  folderScopedUniverses?: boolean;
  /** Hard cap for `.BeyondCode` files scanned from one workspace refresh. */
  maxFiles?: number;
  /** Hard cap for filesystem entries inspected during one workspace refresh. */
  maxEntries?: number;
  /** Hard cap for recursive directory descent below the workspace folder. */
  maxDepth?: number;
  /** Skip `.BeyondCode` files larger than this many bytes before reading them. */
  maxFileBytes?: number;
  /** Cooperative cancellation hook used when a newer scan supersedes this one. */
  isCancellationRequested?: () => boolean;
}

export async function scanWorkspaceForUserObjects(
  workspaceFolder: string,
  registry: UserObjectsRegistry,
  bundledIndex: PropertyIndex,
  options: WorkspaceScanOptions = {},
): Promise<WorkspaceScanResult> {
  const folderScopedUniverses = options.folderScopedUniverses ?? true;
  const maxFiles = options.maxFiles ?? PANGO_ANALYSIS_LIMITS.maxWorkspaceScanFiles;
  const maxEntries = options.maxEntries ?? PANGO_ANALYSIS_LIMITS.maxWorkspaceScanEntries;
  const maxDepth = options.maxDepth ?? PANGO_ANALYSIS_LIMITS.maxWorkspaceScanDepth;
  const maxFileBytes = options.maxFileBytes ?? PANGO_ANALYSIS_LIMITS.maxWorkspaceScanFileBytes;
  const isCancellationRequested = options.isCancellationRequested ?? (() => false);

  if (!workspaceFolder || isCancellationRequested() || (registry.size() === 0 && !folderScopedUniverses)) {
    return emptyWorkspaceScanResult();
  }

  const universeNames = registry.universeNames();
  const universesByLower = new Map(universeNames.map((name) => [name.toLowerCase(), name]));
  // One scan bucket per observed root (registered + unregistered alike). Unregistered
  // buckets become folder-scope candidates after the walk completes.
  const rootScans = new Map<string, RootScan>();
  for (const name of universeNames) {
    rootScans.set(name.toLowerCase(), {
      displayName: name,
      buttonNames: new Set(),
      buttonShapes: new Map(),
      filesByFolder: new Map(),
    });
  }

  // Names we should never auto-promote to folder-scoped universes: bundled
  // canonical roots (Master, Zone, Projector, …) and explicit zone/master
  // aliases the user has already classified differently.
  const bundledRootsLower = new Set(bundledIndex.allObjectNames().map((n) => n.toLowerCase()));
  const nonUniverseAliasesLower = new Set([
    ...registry.zoneAliasNames().map((n) => n.toLowerCase()),
    ...registry.masterAliasNames().map((n) => n.toLowerCase()),
  ]);

  let fileCount = 0;
  for await (const filePath of walkBeyondCodeFiles(workspaceFolder, {
    maxFiles,
    maxEntries,
    maxDepth,
    maxFileBytes,
    isCancellationRequested,
  })) {
    if (isCancellationRequested()) break;
    fileCount++;
    const parentFolder = path.dirname(filePath);
    let text: string;
    try {
      text = await readFile(filePath, "utf8");
    } catch {
      continue;
    }
    // Strip line comments and string literals to avoid false matches inside.
    const cleaned = text
      .split(/\r?\n/)
      .map((line) => stripStringLiterals(splitCodeAndComment(line).code))
      .join("\n");

    for (const match of cleaned.matchAll(PATH_RE)) {
      if (isCancellationRequested()) break;
      const fullPath = match[0];
      const root = match[1];
      const rootKey = root.toLowerCase();

      // Skip roots we already know about from the bundled catalog or that
      // the user has explicitly classified as a non-universe alias —
      // they shouldn't enter folder-scope auto-discovery.
      if (bundledRootsLower.has(rootKey) && !universesByLower.has(rootKey)) continue;
      if (nonUniverseAliasesLower.has(rootKey) && !universesByLower.has(rootKey)) continue;

      const remainder = fullPath.slice(root.length + 1);
      const remainderSegs = remainder.split(".");
      const buttonName = remainderSegs[0];
      if (!buttonName || /^\d+$/.test(buttonName)) continue;

      let scan = rootScans.get(rootKey);
      if (!scan) {
        // Unregistered root — only track it when folder-scope discovery is on.
        if (!folderScopedUniverses) continue;
        scan = {
          displayName: root,
          buttonNames: new Set(),
          buttonShapes: new Map(),
          filesByFolder: new Map(),
        };
        rootScans.set(rootKey, scan);
      }
      scan.buttonNames.add(buttonName);

      // Track the file under its parent folder for the folder-scope threshold.
      let folderFiles = scan.filesByFolder.get(parentFolder);
      if (!folderFiles) {
        folderFiles = new Set();
        scan.filesByFolder.set(parentFolder, folderFiles);
      }
      folderFiles.add(filePath);

      // Classify the button by the segment after its name. Effect.* and
      // Zone.* are unambiguous shape signals from the canonical universe
      // schemas; everything else stays "plain". Last observation wins for
      // shape signals; "plain" never overwrites a previously-observed
      // effect/zonePad classification.
      const next = remainderSegs[1]?.toLowerCase();
      const btnKey = buttonName.toLowerCase();
      if (next === "effect") {
        scan.buttonShapes.set(btnKey, "effect");
      } else if (next === "zone") {
        scan.buttonShapes.set(btnKey, "zonePad");
      } else if (!scan.buttonShapes.has(btnKey)) {
        scan.buttonShapes.set(btnKey, "plain");
      }
    }
  }

  // Build schemas: registered universes inherit UniversePanel + arrayIndices
  // from scan; unregistered roots that hit the folder-scope threshold also
  // inherit UniversePanel but with discoverySource: "folderScope".
  // Zone/master aliases inherit Zone/Master directly.
  const schemas: KnownObjectSchema[] = [];
  const universePropertyCounts = new Map<string, number>();

  const universePanelSchema = bundledIndex.getObject("UniversePanel");
  const hasEffectSchema = !!bundledIndex.getObject("UniverseEffectControl");
  const hasZonePadSchema = !!bundledIndex.getObject("UniverseZonePadControl");

  // Helper: build a UniversePanel-shaped schema from a RootScan bucket.
  const buildUniverseSchema = (
    canonicalName: string,
    scan: RootScan,
    extras: Pick<KnownObjectSchema, "discoverySource" | "observedFileCount">,
  ): KnownObjectSchema => {
    const buttons = [...scan.buttonNames].sort();
    if (!universePanelSchema) {
      // Defensive: tests sometimes supply a minimal bundled index without
      // UniversePanel. Emit an empty isArray schema with discovered button
      // names so <Panel>.<TAB> still suggests something.
      return {
        object: canonicalName,
        isArray: true,
        propertyCount: 0,
        properties: [],
        sharedWithAliases: 0,
        arrayIndices: buttons,
        ...extras,
      };
    }
    const perIndexSchemas = createStringMap();
    for (const btn of buttons) {
      const shape = scan.buttonShapes.get(btn.toLowerCase());
      if (shape === "effect" && hasEffectSchema) {
        perIndexSchemas[btn.toLowerCase()] = "UniverseEffectControl";
      } else if (shape === "zonePad" && hasZonePadSchema) {
        perIndexSchemas[btn.toLowerCase()] = "UniverseZonePadControl";
      }
    }
    return {
      ...universePanelSchema,
      object: canonicalName,
      sharedWithAliases: 0,
      arrayIndices: buttons,
      inheritedFrom: "UniversePanel",
      ...(Object.keys(perIndexSchemas).length > 0 ? { perIndexSchemas } : {}),
      ...extras,
    };
  };

  // 1. Registered universes (always emit, even when empty).
  for (const name of universeNames) {
    const scan = rootScans.get(name.toLowerCase()) ?? {
      displayName: name,
      buttonNames: new Set<string>(),
      buttonShapes: new Map<string, ButtonShape>(),
      filesByFolder: new Map<string, Set<string>>(),
    };
    schemas.push(buildUniverseSchema(name, scan, {}));
    universePropertyCounts.set(name, scan.buttonNames.size);
  }

  // 2. Folder-scoped auto-discoveries (when enabled). Threshold: the root
  // appears in ≥ 2 distinct files in some single parent folder.
  if (folderScopedUniverses) {
    for (const [rootKey, scan] of rootScans) {
      if (universesByLower.has(rootKey)) continue; // already emitted above
      const peakFolderCount = maxFolderFileCount(scan);
      if (peakFolderCount < 2) continue;
      schemas.push(
        buildUniverseSchema(scan.displayName, scan, {
          discoverySource: "folderScope",
          observedFileCount: peakFolderCount,
        }),
      );
      universePropertyCounts.set(scan.displayName, scan.buttonNames.size);
    }
  }

  // Zone aliases: inherit the canonical Zone schema (if bundled has it).
  const zoneSchema = bundledIndex.getObject("Zone");
  if (zoneSchema) {
    for (const aliasName of registry.zoneAliasNames()) {
      schemas.push({
        ...zoneSchema,
        object: aliasName,
        isArray: false,
        sharedWithAliases: 0,
        inheritedFrom: "Zone",
      });
    }
  }

  // Master aliases: inherit the canonical Master schema (if bundled has it).
  const masterSchema = bundledIndex.getObject("Master");
  if (masterSchema) {
    for (const aliasName of registry.masterAliasNames()) {
      schemas.push({
        ...masterSchema,
        object: aliasName,
        sharedWithAliases: 0,
        inheritedFrom: "Master",
      });
    }
  }

  return {
    index: buildPropertyIndex({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      generatedFrom: "workspace scan",
      schemas,
    }),
    fileCount,
    universePropertyCounts,
  };
}

/**
 * Returns the largest number of distinct files in any single parent folder
 * for this root. Used to gate folder-scoped auto-discovery — a root must
 * appear in ≥ 2 files in the same folder to be auto-promoted.
 */
function maxFolderFileCount(scan: RootScan): number {
  let peak = 0;
  for (const files of scan.filesByFolder.values()) {
    if (files.size > peak) peak = files.size;
  }
  return peak;
}

function emptyWorkspaceScanResult(): WorkspaceScanResult {
  return {
    index: buildPropertyIndex({ schemaVersion: 1, generatedAt: "", generatedFrom: "(empty)", schemas: [] }),
    fileCount: 0,
    universePropertyCounts: new Map(),
  };
}

interface WorkspaceWalkOptions {
  maxFiles: number;
  maxEntries: number;
  maxDepth: number;
  maxFileBytes: number;
  isCancellationRequested: () => boolean;
}

interface WorkspaceWalkState {
  yieldedFiles: number;
  inspectedEntries: number;
}

function createStringMap(): Record<string, string> {
  return Object.create(null) as Record<string, string>;
}

async function* walkBeyondCodeFiles(
  dir: string,
  options: WorkspaceWalkOptions,
  depth = 0,
  state: WorkspaceWalkState = { yieldedFiles: 0, inspectedEntries: 0 },
): AsyncGenerator<string> {
  if (
    options.isCancellationRequested() ||
    state.yieldedFiles >= options.maxFiles ||
    state.inspectedEntries >= options.maxEntries
  ) {
    return;
  }
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (
      options.isCancellationRequested() ||
      state.yieldedFiles >= options.maxFiles ||
      state.inspectedEntries >= options.maxEntries
    ) {
      return;
    }
    state.inspectedEntries++;
    // Skip common heavy / irrelevant directories
    if (entry === "node_modules" || entry === ".git" || entry === ".vscode-test" || entry === ".trash") continue;
    const full = path.join(dir, entry);
    let stats: Awaited<ReturnType<typeof lstat>>;
    try {
      stats = await lstat(full);
    } catch {
      continue;
    }
    if (stats.isSymbolicLink()) continue;
    if (stats.isDirectory()) {
      if (depth >= options.maxDepth) continue;
      yield* walkBeyondCodeFiles(full, options, depth + 1, state);
    } else if (stats.isFile() && entry.endsWith(".BeyondCode") && stats.size <= options.maxFileBytes) {
      state.yieldedFiles++;
      yield full;
    }
  }
}
