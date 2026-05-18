# JD3 Examples

This folder contains JD3/local `.BeyondCode` examples and button snippets.

The scripts are part of PangoLint's required regression corpus: diagnostics in
this folder fail `npm run lint:examples`.

Keep these scripts CRLF when copying them into BEYOND. LF-only clipboard text
can paste into BEYOND's PangoScript editor as one logical line.

The `COLORPICKER PANGOSCRIPT/` folder intentionally keeps its BEYOND-facing
file and folder names because those names map to operator setup notes and UI
button scripts.

Event-context examples should be split into one file per BEYOND event slot.
For example, the EaseIn BPM Animation pair has separate On Event Enter and On
Event Leave scripts.
