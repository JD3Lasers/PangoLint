# Reference Site Build Scripts

This folder contains the build-time pieces for the packaged PangoScript reference page.

- `referenceInputFiles.ts` reads checked-in JSON, CSS, and package metadata from the repository root.
- `buildReferenceCatalog.ts` converts command, Object Tree, OSC, and universe component data into the public reference catalog.
- `referenceRendererBundle.ts` bundles the browser renderer with esbuild.
- `referenceHtmlFile.ts` renders and writes the single packaged HTML file.
- `referenceCatalogTypes.ts` keeps the raw input and rendered catalog contracts together.
