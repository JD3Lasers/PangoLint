#!/usr/bin/env node
// Renders media/icon.svg → media/icon.png at 256×256 (Marketplace prefers
// at least 128×128; we render larger so it stays sharp on retina galleries
// and downscale crisply on small displays).
//
// Run: `node scripts/buildIcon.cjs` or `npm run build:icon`.

const fs = require("node:fs");
const path = require("node:path");

const sharp = require("sharp");

const repoRoot = path.resolve(__dirname, "..");
const sourceSvg = path.join(repoRoot, "media", "icon.svg");
const outputPng = path.join(repoRoot, "media", "icon.png");

const RENDER_SIZE = 256;

if (!fs.existsSync(sourceSvg)) {
  process.stderr.write(`buildIcon: source SVG missing at ${sourceSvg}\n`);
  process.exit(1);
}

sharp(sourceSvg, { density: (72 * RENDER_SIZE) / 128 })
  .resize(RENDER_SIZE, RENDER_SIZE)
  .png({ compressionLevel: 9 })
  .toFile(outputPng)
  .then((info) => {
    process.stdout.write(`buildIcon: wrote ${outputPng} (${info.width}x${info.height}, ${info.size} bytes)\n`);
  })
  .catch((err) => {
    process.stderr.write(`buildIcon: failed — ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
