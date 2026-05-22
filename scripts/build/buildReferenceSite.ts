// Builds the standalone PangoScript reference page as a single self-contained HTML file.
// The output path stays media/reference/pangoscript-reference.html for VSIX and Pages packaging.

import { buildReferenceCatalog } from "./referenceSite/buildReferenceCatalog";
import {
  readReferenceIconDataUri,
  renderReferenceHtml,
  writeReferenceHtmlFile,
} from "./referenceSite/referenceHtmlFile";
import { readReferenceText } from "./referenceSite/referenceInputFiles";
import { buildReferenceRendererBundle } from "./referenceSite/referenceRendererBundle";

function main(): void {
  const catalog = buildReferenceCatalog();
  const css = readReferenceText("src/reference/styles.css");
  const bundle = buildReferenceRendererBundle();
  const icon = readReferenceIconDataUri();
  const html = renderReferenceHtml(catalog, css, bundle, icon);
  const out = writeReferenceHtmlFile(html);

  const sizeMB = (Buffer.byteLength(html) / (1024 * 1024)).toFixed(2);
  console.log(
    `[reference] wrote ${out} (${sizeMB} MB · ${catalog.commands.length} items · ${catalog.objects.length} objects)`,
  );
}

main();
