import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findPublicArtifactLeaks } from "../../scripts/package/publicArtifactPolicy";

const repoRoot = process.cwd();
const shippedRoots = [path.join(repoRoot, "src"), path.join(repoRoot, "package.json")];

describe("shipped runtime source defaults", () => {
  it("does not contain hard-coded private runtime artifact classes", () => {
    const leaks = shippedRoots.flatMap((root) =>
      scan(root).flatMap((filePath) => {
        const contents = readFileSync(filePath, "utf8");
        return findPublicArtifactLeaks(contents).map(
          (leak) => `${path.relative(repoRoot, filePath)}: ${leak.label} (${leak.match})`,
        );
      }),
    );

    expect(leaks).toEqual([]);
  });
});

function scan(entryPath: string): string[] {
  const stat = statSync(entryPath);
  if (stat.isFile()) return [entryPath];

  return readdirSync(entryPath).flatMap((entry) => {
    const childPath = path.join(entryPath, entry);
    const childStat = statSync(childPath);
    if (childStat.isDirectory()) return scan(childPath);
    return childPath.endsWith(".ts") || childPath.endsWith(".json") ? [childPath] : [];
  });
}
