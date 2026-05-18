# PangoLint Linter Regressions

This folder contains small `.BeyondCode` scripts used as regression fixtures for
PangoLint parser and diagnostic behavior.

- `pass/` scripts are expected to lint cleanly under `npm run lint:examples`.
- `fail/` scripts intentionally exercise known-bad patterns that make BEYOND
  report parser errors, even if earlier lines still execute. Each file must
  declare one or more expected diagnostics with
  `// PangoLint expect: <diagnostic-code>`.
- `advisory/` scripts are BEYOND-accepted patterns where PangoLint should still
  emit a best-practice hint or warning. They also declare expected diagnostics
  with `// PangoLint expect: <diagnostic-code>`.
- `candidate/` scripts are unverified fixtures queued for manual BEYOND
  editor validation. They are linted for visibility, but diagnostics do not
  fail the repo gate until the fixture is promoted to `pass/` or `fail/`.

Runtime test scripts should stay readback-oriented and use `/pangolint/...`
`OscOutTTS` callbacks so operators can test BEYOND behavior without
intentionally changing output state. Passing runtime tests should normally end
with an explicit `exit`; omitted-exit behavior belongs in `advisory/` because
BEYOND accepts it but PangoLint recommends `exit` as a fall-through guard.

Talk UDP batches are not used to promote runtime control-flow fixtures. They
have been observed falling through later labels even after branch code and
`exit`, so candidates that exercise labels, `goto`, `if`, loops, waits, or
`exit` must be pasted directly into BEYOND's PangoScript editor before
promotion.

Manual validation flow:

1. Add the new fixture to `candidate/`.
2. Confirm the VS Code buffer is CRLF before copying.
3. Paste into BEYOND's PangoScript editor and run it there.
4. Record the OSC output or BEYOND error in the validation notes.
5. Move the file to `pass/` if BEYOND accepts it and PangoLint should emit no
   diagnostics.
6. Move the file to `fail/` if BEYOND reports parser errors and add
   `// PangoLint expect: <diagnostic-code>` comments for the expected linter
   finding.
7. Move the file to `advisory/` if BEYOND accepts it and PangoLint should emit
   a deliberate best-practice diagnostic.

For runtime `pass/` and `advisory/` fixtures that emit OSC callbacks, record
both expected and observed callbacks before promotion:

```pangoscript
// PangoLint expected callback: /pangolint/example (si) "request-id" 1
// PangoLint observed callback: /pangolint/example (si) "request-id" 1
```

The regression layout test requires the expected and observed callback lists to
match exactly, so a promoted fixture documents both the intended behavior and
the BEYOND output used to validate it.

## Fail-to-Supported Coverage

Every `fail/` fixture should either have a nearby `pass/` fixture that shows
the supported way to express the same intent, or an explicit note that the
failure represents syntax PangoLint should discourage without a direct safe
runtime twin.

| Fail fixture | Unsupported shape | Supported coverage |
| --- | --- | --- |
| `comparison-bang-not-equal-test.BeyondCode` | `!=` in `if` conditions | `pass/comparison-not-equal-test.BeyondCode` verifies `<>` as the not-equal operator. |
| `deltavalue-editor-spaced-assignment-test.BeyondCode` | Spaced `deltavalue (...)` as a direct editor assignment expression | No direct `DeltaValue` pass twin. BEYOND rejected the spaced assignment form with `Operation expected: (`; `pass/extdelta-editor-default-test.BeyondCode` covers accepted `ExtDelta(-1)` editor behavior, and `pass/extvalue-editor-property-assignment-test.BeyondCode` covers accepted `ExtValue(...)` property assignment. |
| `deltavalue-editor-spaced-property-command-test.BeyondCode` | Spaced `deltavalue (...)` as a direct editor property/control command | No direct editor pass twin. BEYOND rejected `Master.PhFriction deltavalue (-1,1)` with an unknown-function error; user reports this syntax works only in direct MIDI-to-PangoScript slot context. `pass/extvalue-editor-property-assignment-test.BeyondCode` verifies the accepted `ExtValue(...)` property-assignment form. |
| `deltavalue-definemiditrigger-property-command-test.BeyondCode` | Spaced `deltavalue (...)` property/control command inside a `DefineMidiTrigger` handler | No direct pass twin. BEYOND rejected the handler body before a MIDI trigger could emit callbacks; user reports this syntax works only in direct MIDI-to-PangoScript slot context. |
| `deltavalue-property-argument-test.BeyondCode` | No-space `DeltaValue(...)` as a direct editor property/control command argument | No direct editor pass twin. BEYOND rejected the no-space editor form; user reports spaced `Master.PhFriction deltavalue (-1,1)` works in APC40 MIDI-to-PangoScript slot context. That shape is not kept as a `pass/` fixture because it requires external slot binding and writes output state. |
| `external-delta-functions-editor-test.BeyondCode` | `DeltaValue(...)` as an assignment expression | No direct `DeltaValue` pass twin. `pass/extdelta-editor-default-test.BeyondCode` covers `ExtDelta(-1)` editor behavior; `pass/waitformidi-extvalue-test.BeyondCode` covers scaled external values. |
| `line-continuation-test.BeyondCode` | Multiline command continuation | `pass/straight-line-osc-callback-test.BeyondCode` and `pass/function-call-command-style-test.BeyondCode` verify single-line command calls. |
| `missing-conditional-label.BeyondCode` | `goto` target with no matching label | `pass/conditional-forward-branch-test.BeyondCode` and `pass/branch-merge-two-path-test.BeyondCode` verify valid labeled branch targets. |
| `parenthesized-condition-test.BeyondCode` | Textual `and` / `or` compound conditions | `pass/conditional-forward-branch-test.BeyondCode` and `pass/branch-merge-two-path-test.BeyondCode` verify split label/goto branch flow. |
| `property-index-access-test.BeyondCode` | Direct read of `Zone.0.Points[0].X` | `pass/property-read-master-zone-test.BeyondCode` verifies known dotted Master/Zone property reads. No direct bracket-index read pass is known. |
| `property-typo-test.BeyondCode` | Misspelled known property path | `pass/property-read-master-zone-test.BeyondCode` verifies valid property names such as `Master.BPM` and `Zone.0.Brightness`. |
| `quoted-goto-label-test.BeyondCode` | Quoted `goto "Start"` target | `pass/variable-goto-target-test.BeyondCode`, `pass/label-goto-loop-test.BeyondCode`, and branch fixtures verify bare or variable-resolved goto targets. |
| `repeat-until-test.BeyondCode` | `Repeat` / `Until` loop syntax | `pass/label-goto-loop-test.BeyondCode` verifies the accepted label + `if (...) goto ...` loop pattern. |
| `trailing-semicolon-test.BeyondCode` | `exit;` | Most pass fixtures, including `pass/straight-line-osc-callback-test.BeyondCode`, verify bare terminal `exit`. |
| `unbalanced-parentheses-test.BeyondCode` | Unfinished `if` condition | `pass/nested-parentheses-expression-test.BeyondCode` and `pass/function-nesting-intstr-test.BeyondCode` verify balanced nested expressions. |
| `unclosed-string-test.BeyondCode` | Unterminated string literal | `pass/string-arguments-commas-test.BeyondCode` verifies quoted strings with commas and slashes. |
| `unknown-command-test.BeyondCode` | Unknown leading command | `pass/straight-line-osc-callback-test.BeyondCode` and `pass/function-call-command-style-test.BeyondCode` verify known command calls. |
| `unsupported-for-range.BeyondCode` | Delphi-style `For ... To ... Next` range loop | `pass/label-goto-loop-test.BeyondCode` verifies the accepted loop pattern. |
| `unsupported-while-loop-test.BeyondCode` | `While` / `Loop` syntax | `pass/label-goto-loop-test.BeyondCode` verifies the accepted loop pattern. |
| `wrong-arg-count-test.BeyondCode` | Too many args to `Brightness` | No readback-only Brightness pass twin is kept because it writes output state. Correct command arity is covered by the command catalog and readback-safe `OscOutTTS` pass fixtures. |

The repository checks out `.BeyondCode` files with CRLF line endings because
BEYOND's PangoScript editor paste path treats LF-only clipboard text as one
logical line. If an editor or external tool rewrites a fixture to LF, switch the
buffer back to CRLF before copying into BEYOND.
