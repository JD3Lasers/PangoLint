const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const vsixFiles = fs
  .readdirSync(root)
  .filter((name) => /^pangolint-.+\.vsix$/i.test(name))
  .sort();

if (vsixFiles.length === 0) {
  throw new Error("No pangolint-*.vsix files found.");
}

const lines = vsixFiles.map((name) => {
  const filePath = path.join(root, name);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  return `${hash}  ${name}`;
});

fs.writeFileSync(path.join(root, "pangolint.vsix.sha256"), `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote pangolint.vsix.sha256 for ${vsixFiles.length} VSIX file(s).`);
