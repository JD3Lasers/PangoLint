import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { REFERENCE_SITE_ROOT } from "./referenceInputFiles";

export function buildReferenceRendererBundle(): string {
  const entry = resolve(REFERENCE_SITE_ROOT, "src/reference/bundle/main.ts");
  const tmp = resolve(REFERENCE_SITE_ROOT, "dist/.reference-bundle.js");
  mkdirSync(dirname(tmp), { recursive: true });
  const esbuildBin = resolve(REFERENCE_SITE_ROOT, "node_modules", "esbuild", "bin", "esbuild");
  const esbuildCommand = process.platform === "win32" ? process.execPath : esbuildBin;
  const esbuildArgs = [
    entry,
    "--bundle",
    "--platform=browser",
    "--format=esm",
    "--target=es2022",
    "--minify",
    `--outfile=${tmp}`,
  ];
  execFileSync(esbuildCommand, process.platform === "win32" ? [esbuildBin, ...esbuildArgs] : esbuildArgs, {
    cwd: REFERENCE_SITE_ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  return readFileSync(tmp, "utf8");
}
