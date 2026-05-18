# Working Examples

This folder contains real `.BeyondCode` PangoScript examples used by PangoLint
as parser and diagnostics regression input.

`.BeyondCode` files intentionally use CRLF line endings in the working tree.
BEYOND's PangoScript editor paste path treats LF-only clipboard text as one
logical line, so keep these scripts CRLF when copying them into BEYOND.

Examples are grouped by attribution:

- `jd3/` contains JD3/local examples. `npm run lint:examples` treats this
  folder as the required zero-diagnostic corpus.
- `jvyduna/` contains attributed PaingoScripts examples from Jeff Vyduna's
  repository. Those files preserve upstream script content apart from
  CRLF/trailing-whitespace normalization, so `npm run lint:examples`
  reports diagnostics from this folder as informational rather than failing
  the gate.

Do not rename operator-facing `.BeyondCode` files only to satisfy repository
filename conventions. These names match how operators recognize the scripts.
