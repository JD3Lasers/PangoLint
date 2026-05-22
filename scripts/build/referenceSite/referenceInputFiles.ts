import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Build scripts run from the repository root through the existing npm scripts.
export const REFERENCE_SITE_ROOT = process.cwd();

export function readReferenceJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(REFERENCE_SITE_ROOT, relativePath), "utf8")) as T;
}

export function readReferenceText(relativePath: string): string {
  return readFileSync(resolve(REFERENCE_SITE_ROOT, relativePath), "utf8");
}

export function readPackageVersion(): string {
  const pkg = readReferenceJson<{ version: string }>("package.json");
  return pkg.version;
}
