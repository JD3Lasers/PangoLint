// Persistent registry of user-classified custom objects (universes, zone
// aliases, master aliases). Stored in .pangolint/user-objects.json at the
// workspace root - committable to share with a team, or gitignored for
// personal use.
//
// The registry is opt-in: nothing is added automatically. The user explicitly
// classifies each unknown object root via a code action ("Add 'X' as user
// universe" / "as zone alias" / "as master alias"). This avoids guessing
// wrong about names that happen to look universe-shaped.

import {
  closeSync,
  constants,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  type Stats,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export type UserObjectKind = "universe" | "zoneAlias" | "masterAlias";

export interface UserObjectEntry {
  /** Categorization chosen by the user when adding via code action. */
  kind: UserObjectKind;
  /** ISO timestamp of when this entry was added. */
  addedAt: string;
}

export interface UserObjectsFile {
  schemaVersion: 1;
  objects: Record<string, UserObjectEntry>;
}

export interface UserObjectsRegistry {
  /** Get the entry for an object name (case-insensitive). */
  get(name: string): UserObjectEntry | undefined;
  /** All registered object names, sorted. */
  names(): string[];
  /** All universe-kind object names. */
  universeNames(): string[];
  /** All zone-alias object names. */
  zoneAliasNames(): string[];
  /** All master-alias object names. */
  masterAliasNames(): string[];
  /** Total entries. */
  size(): number;
}

const MAX_USER_OBJECTS_FILE_BYTES = 128 * 1024;
const NOFOLLOW_FLAG = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;

const EMPTY_FILE: UserObjectsFile = { schemaVersion: 1, objects: createUserObjectsMap() };

export function emptyUserObjectsRegistry(): UserObjectsRegistry {
  return buildRegistry(EMPTY_FILE);
}

export function buildRegistry(file: UserObjectsFile): UserObjectsRegistry {
  const byLower = new Map<string, { name: string; entry: UserObjectEntry }>();
  for (const [name, entry] of Object.entries(normalizeUserObjects(file.objects))) {
    byLower.set(name.toLowerCase(), { name, entry });
  }
  return {
    get: (name: string) => byLower.get(name.toLowerCase())?.entry,
    names: () => [...byLower.values()].map((v) => v.name).sort(),
    universeNames: () =>
      [...byLower.values()]
        .filter((v) => v.entry.kind === "universe")
        .map((v) => v.name)
        .sort(),
    zoneAliasNames: () =>
      [...byLower.values()]
        .filter((v) => v.entry.kind === "zoneAlias")
        .map((v) => v.name)
        .sort(),
    masterAliasNames: () =>
      [...byLower.values()]
        .filter((v) => v.entry.kind === "masterAlias")
        .map((v) => v.name)
        .sort(),
    size: () => byLower.size,
  };
}

export interface UserObjectsLoadResult {
  registry: UserObjectsRegistry;
  source: "loaded" | "absent" | "error";
  filePath: string;
  error?: string;
}

export function userObjectsFilePath(workspaceFolder: string): string {
  return path.join(workspaceFolder, ".pangolint", "user-objects.json");
}

export function loadUserObjects(workspaceFolder: string): UserObjectsLoadResult {
  if (!workspaceFolder) {
    return {
      registry: emptyUserObjectsRegistry(),
      source: "absent",
      filePath: "",
    };
  }
  const filePath = userObjectsFilePath(workspaceFolder);
  try {
    const registryPath = prepareRegistryPath(workspaceFolder, { createDirectory: false });
    if (!registryPath.directoryExists) {
      return { registry: emptyUserObjectsRegistry(), source: "absent", filePath };
    }
    const fileEntry = readRegistryPathEntry(filePath);
    if (!fileEntry.exists) {
      return { registry: emptyUserObjectsRegistry(), source: "absent", filePath };
    }
    if (fileEntry.size > MAX_USER_OBJECTS_FILE_BYTES) {
      return {
        registry: emptyUserObjectsRegistry(),
        source: "error",
        filePath,
        error: `user object registry is ${fileEntry.size} bytes; limit is ${MAX_USER_OBJECTS_FILE_BYTES}`,
      };
    }
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as UserObjectsFile;
    if (!isRecord(raw.objects)) {
      return {
        registry: emptyUserObjectsRegistry(),
        source: "error",
        filePath,
        error: "missing 'objects' map",
      };
    }
    return {
      registry: buildRegistry({ schemaVersion: 1, objects: normalizeUserObjects(raw.objects) }),
      source: "loaded",
      filePath,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      registry: emptyUserObjectsRegistry(),
      source: "error",
      filePath,
      error: `failed to parse: ${msg}`,
    };
  }
}

/**
 * Add or update a single user-object entry, then persist. Creates the
 * .pangolint/ directory if needed. Returns the updated registry.
 */
export function addUserObject(workspaceFolder: string, name: string, kind: UserObjectKind): UserObjectsRegistry {
  const { filePath } = prepareRegistryPath(workspaceFolder, { createDirectory: true });

  let file: UserObjectsFile;
  const fileEntry = readRegistryPathEntry(filePath);
  if (fileEntry.exists) {
    try {
      if (fileEntry.size > MAX_USER_OBJECTS_FILE_BYTES) {
        throw new Error(`user object registry is ${fileEntry.size} bytes; limit is ${MAX_USER_OBJECTS_FILE_BYTES}`);
      }
      file = JSON.parse(readFileSync(filePath, "utf8")) as UserObjectsFile;
      file.objects = normalizeUserObjects(file.objects);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`refusing to overwrite existing user object registry at ${filePath} (${reason})`);
    }
  } else {
    file = { schemaVersion: 1, objects: createUserObjectsMap() };
  }
  file.schemaVersion = 1;
  file.objects[name] = { kind, addedAt: new Date().toISOString() };
  writeRegistryFile(filePath, file);
  return buildRegistry(file);
}

/**
 * Remove a user-object entry by name (case-insensitive) and persist.
 * Returns the updated registry; if the file doesn't exist, returns empty.
 */
export function removeUserObject(workspaceFolder: string, name: string): UserObjectsRegistry {
  const registryPath = prepareRegistryPath(workspaceFolder, { createDirectory: false });
  if (!registryPath.directoryExists) return emptyUserObjectsRegistry();
  const filePath = registryPath.filePath;
  const fileEntry = readRegistryPathEntry(filePath);
  if (!fileEntry.exists) return emptyUserObjectsRegistry();
  let file: UserObjectsFile;
  try {
    if (fileEntry.size > MAX_USER_OBJECTS_FILE_BYTES) return emptyUserObjectsRegistry();
    file = JSON.parse(readFileSync(filePath, "utf8")) as UserObjectsFile;
  } catch {
    return emptyUserObjectsRegistry();
  }
  if (!isRecord(file.objects)) return emptyUserObjectsRegistry();
  file.objects = normalizeUserObjects(file.objects);
  const lower = name.toLowerCase();
  for (const key of Object.keys(file.objects)) {
    if (key.toLowerCase() === lower) {
      delete file.objects[key];
    }
  }
  writeRegistryFile(filePath, file);
  return buildRegistry(file);
}

interface RegistryPath {
  filePath: string;
  directoryExists: boolean;
}

function prepareRegistryPath(workspaceFolder: string, options: { createDirectory: boolean }): RegistryPath {
  const filePath = userObjectsFilePath(workspaceFolder);
  const registryDir = path.dirname(filePath);
  if (options.createDirectory) {
    mkdirSync(registryDir, { recursive: true });
  }
  const dirEntry = readPathEntry(registryDir);
  if (dirEntry.exists === false) {
    return { filePath, directoryExists: false };
  }
  if (dirEntry.stats.isSymbolicLink()) {
    throw new Error(`user object registry directory at ${registryDir} must not be a symlink`);
  }
  if (!dirEntry.stats.isDirectory()) {
    throw new Error(`user object registry directory at ${registryDir} is not a directory`);
  }
  const workspaceRealPath = realpathSync(workspaceFolder);
  const registryDirRealPath = realpathSync(registryDir);
  if (!isPathInside(registryDirRealPath, workspaceRealPath)) {
    throw new Error(`user object registry directory at ${registryDir} must stay inside the workspace`);
  }
  return { filePath, directoryExists: true };
}

function readRegistryPathEntry(filePath: string): { exists: false } | { exists: true; size: number } {
  const fileEntry = readPathEntry(filePath);
  if (fileEntry.exists === false) return { exists: false };
  if (fileEntry.stats.isSymbolicLink()) {
    throw new Error(`user object registry at ${filePath} must not be a symlink`);
  }
  return { exists: true, size: fileEntry.stats.size };
}

function readPathEntry(filePath: string): { exists: false } | { exists: true; stats: Stats } {
  try {
    return { exists: true, stats: lstatSync(filePath) };
  } catch (error) {
    if (isMissingPathError(error)) {
      return { exists: false };
    }
    throw error;
  }
}

function writeRegistryFile(filePath: string, file: UserObjectsFile): void {
  const text = `${JSON.stringify(file, null, 2)}\n`;
  let fd: number | undefined;
  try {
    fd = openSync(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NOFOLLOW_FLAG, 0o666);
    writeFileSync(fd, text);
  } catch (error) {
    if (isSymlinkOpenError(error)) {
      throw new Error(`user object registry at ${filePath} must not be a symlink`);
    }
    throw error;
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
  }
}

function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isMissingPathError(error: unknown): boolean {
  return isNodeFileError(error) && error.code === "ENOENT";
}

function isSymlinkOpenError(error: unknown): boolean {
  return isNodeFileError(error) && (error.code === "ELOOP" || error.code === "EMLINK");
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function createUserObjectsMap(): Record<string, UserObjectEntry> {
  return Object.create(null) as Record<string, UserObjectEntry>;
}

function normalizeUserObjects(value: unknown): Record<string, UserObjectEntry> {
  const objects = createUserObjectsMap();
  if (!isRecord(value)) return objects;
  for (const [name, entry] of Object.entries(value)) {
    if (isUserObjectEntry(entry)) {
      objects[name] = entry;
    }
  }
  return objects;
}

function isUserObjectEntry(value: unknown): value is UserObjectEntry {
  if (!isRecord(value)) return false;
  return (
    (value.kind === "universe" || value.kind === "zoneAlias" || value.kind === "masterAlias") &&
    typeof value.addedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
