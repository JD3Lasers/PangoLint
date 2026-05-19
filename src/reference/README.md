# Reference Source

This folder owns the browser source for the packaged PangoScript reference
site.

## Responsibilities

- Build the offline reference app that is bundled into the VSIX and published
  through GitHub Pages.
- Render command details, Object Tree details, OSC route details, search
  results, and navigation state from generated reference data.
- Keep browser-only code under `bundle/` and detail renderers under
  `bundle/detail/`.
- Keep reference styling in `styles.css`.

Generated HTML belongs under `media/reference/` and must be rebuilt through
`npm run build:reference`. Do not hand-edit generated reference output.
