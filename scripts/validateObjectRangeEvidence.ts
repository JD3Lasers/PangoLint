import { readFileSync } from "node:fs";
import path from "node:path";
import { validateObjectRangeEvidenceReport } from "../src/knowledge/objectRangeEvidence";

const repoRoot = path.resolve(__dirname, "..");
const inputPaths = process.argv.slice(2);
const pathsToValidate =
  inputPaths.length > 0 ? inputPaths : [path.join(repoRoot, "tests", "fixtures", "object-range-evidence.valid.json")];

let failed = false;

for (const inputPath of pathsToValidate) {
  const resolvedPath = path.resolve(repoRoot, inputPath);
  const report = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
  const errors = validateObjectRangeEvidenceReport(report);
  if (errors.length > 0) {
    failed = true;
    console.error(`${path.relative(repoRoot, resolvedPath)} failed object range evidence validation:`);
    for (const error of errors) console.error(`  - ${error}`);
  } else {
    console.log(`${path.relative(repoRoot, resolvedPath)} passed object range evidence validation`);
  }
}

if (failed) process.exit(1);
