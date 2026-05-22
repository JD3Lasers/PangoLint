import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { OutCatalog } from "./referenceCatalogTypes";
import { REFERENCE_SITE_ROOT } from "./referenceInputFiles";

export const REFERENCE_HTML_PATH = resolve(REFERENCE_SITE_ROOT, "media/reference/pangoscript-reference.html");

function escapeForScriptTag(json: string): string {
  return json.replace(/<\//g, "<\\/");
}

export function renderReferenceHtml(catalog: OutCatalog, css: string, bundle: string, iconDataUri: string): string {
  const catalogJson = escapeForScriptTag(JSON.stringify(catalog));
  const meta = catalog.meta;
  const subtitle = `Catalog build ${meta.catalogBuild ?? "-"} - v${meta.version}`;
  const shortSubtitle = `v${meta.version}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PangoScript Reference · PangoLint</title>
    <style>${css}</style>
  </head>
  <body>
    <header class="topbar">
      <img class="topbar__icon" src="${iconDataUri}" alt="" />
      <h1 class="topbar__title">PangoScript Reference</h1>
      <span class="topbar__subtitle">PangoLint</span>
      <span class="topbar__meta"><span class="topbar__meta-long">${subtitle}</span><span class="topbar__meta-short">${shortSubtitle}</span></span>
    </header>
    <main id="reference-root"></main>
    <script id="reference-catalog" type="application/json">${catalogJson}</script>
    <script type="module">${bundle}</script>
  </body>
</html>
`;
}

export function readReferenceIconDataUri(): string {
  const buf = readFileSync(resolve(REFERENCE_SITE_ROOT, "media/icon.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export function writeReferenceHtmlFile(html: string): string {
  mkdirSync(dirname(REFERENCE_HTML_PATH), { recursive: true });
  writeFileSync(REFERENCE_HTML_PATH, html);
  return REFERENCE_HTML_PATH;
}
