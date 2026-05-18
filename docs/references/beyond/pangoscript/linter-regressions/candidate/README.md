# Candidate Regression Scripts

These fixtures are not yet pass/fail truth. Paste each script into BEYOND's
PangoScript editor, run it there, and record the result before promotion.

Manual validation checklist:

1. Open the candidate in VS Code.
2. Confirm the buffer is CRLF before copying. BEYOND's PangoScript editor paste
   path treats LF-only clipboard text as one logical line.
3. Paste into BEYOND's PangoScript editor.
4. Run inside BEYOND, not through Talk UDP.
5. Copy the BEYOND error text or OSC monitor output into validation notes.
6. Promote to `../pass/` only if BEYOND accepts the script and PangoLint should
   emit zero diagnostics.
7. Promote to `../fail/` only if BEYOND rejects the script and PangoLint should
   emit the declared `// PangoLint expect: <diagnostic-code>` diagnostics.

Deterministic runtime candidates may include `// PangoLint expected callback:`
lines before validation. Treat those as the intended callback contract to compare
against BEYOND's OSC monitor output. Add `// PangoLint observed callback:` lines
only after BEYOND has actually emitted them.

MCP preflight, 2026-05-06:

- `pangolint-mcp@0.0.1` `lintScript` initially checked all 30 candidate
  scripts and reported 17 with zero diagnostics.
- Thirteen scripts have since been BEYOND-validated and promoted to `../pass/`,
  leaving no lint-clean candidates ready for BEYOND paste/run as potential
  `pass/` fixtures.
- Three BEYOND-accepted advisory scripts have been promoted to `../advisory/`
  because PangoLint should still emit deliberate best-practice diagnostics.
- Fourteen BEYOND-rejected probes have been promoted to `../fail/`: missing
  labels, unsupported `For`, unsupported `While/Loop`, unsupported
  `Repeat/Until`, malformed strings, unbalanced parentheses, textual logical
  operators, BEYOND-rejected property index access, property typos, quoted goto
  targets, `exit;`, unknown command, wrong argument count, and multiline command
  continuation.
- The initial 30-script batch has been fully promoted. Add new files here only
  when probing BEYOND behavior that is not yet recorded in `../pass/`,
  `../fail/`, or `../advisory/`.

Current queued batch, 2026-05-07:

- `ExtValue` in direct MIDI-to-PangoScript slot execution context.
- `DeltaValue` outside direct MIDI-to-PangoScript slot context:
  `WaitForMidi` assignment/property command.

Initial batch coverage:

- Common straight-line readback and comments.
- Labels, `goto`, conditional branches, and label-loop control flow.
- Variables, `globalvar`, arithmetic, comparisons, strings, and semicolons.
- Master/Zone property reads and indexed property access.
- Known or suspected failure shapes: missing label, unsupported `For`,
  `While/Loop`, `Repeat/Until`, malformed strings, unbalanced parentheses,
  wrong arity, unknown command, unsupported property index access,
  uninitialized reads, property typo, and multiline command continuation.
