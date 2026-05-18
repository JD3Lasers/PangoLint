# PangoScript syntax (agent reference)

PangoLint's parser recognizes the line shapes below. PangoScript is
Delphi-shaped and sparsely documented; the parser is intentionally
permissive — unknown syntax is preserved, not rejected, so you can
experiment without the linter blocking you.

## Line kinds

Every line is classified into one of:

- `blank` — empty or whitespace only
- `comment` — `// …` only (no block-comment form)
- `label` — `<name>:` standalone, optionally with a same-line
  statement after it (`mylabel: WaitForBeat 4`)
- `declaration` — `Var <name>[, <name>...]` or
  `GlobalVar <name>[, <name>...]`
- `assignment` — `<target> = <expression>` where target is a variable
  or property path
- `command` — a leading identifier followed by space-separated args
  (`Brightness 50`), Delphi function-call form
  (`SetCueCaptionColor(1, 1, 0)`), or an OSC address pattern
- `oscAddress` — line begins with `/…` (OSC-style address used by
  some BEYOND output paths)
- `goto` — `goto <label>` or `goto <variableName>`
- `if` — `if (<cond>) <statement>` (one-line) or `if (<cond>) { … }`
  (braced block — the brace tokens themselves are not validated)
- `blockBoundary` — `}` or `Next` on its own line

Multi-statement lines separated by `;` are NOT split by the parser;
the leading statement determines the kind. The diagnostic engine
scans the post-`;` portion for variable reads so multi-statement
lines like `var b; b = c & 255` don't leak false-positive
`unused-variable` hints.

BEYOND has been observed reporting `Invalid expression` for `exit;`
even though earlier lines in the same script emitted callbacks. Use
bare `exit` without a trailing semicolon.

BEYOND validation on 2026-05-07 accepted parenthesized command-call
syntax with no space before the opening parenthesis, for example
`OscOutTTS("/path", "s", value)`.

## Identifiers

Identifiers match `/[A-Za-z_][A-Za-z0-9_]*/`. Dotted property paths
are valid (`Master.Brightness`, `Zone.0.Brightness`). Numeric segments
inside a property path are array indices, not identifiers. Lookup is
case-insensitive throughout.

## Labels and goto

Labels are global to the file. The parser builds a label index in a
first pass, so forward gotos are valid:

```
goto Init       // forward reference
Init:
  Brightness 0
```

Labels referenced from `goto` are case-insensitive matches on the
label declaration. BEYOND has also been observed accepting a declared
string variable as the goto target:

```pangoscript
var targetName
targetName = "Start"
goto targetName
```

For diagnostics, PangoLint treats `goto targetName` as a variable read
when `targetName` is declared. If its current local assignment is a
string matching a label, that label counts as referenced. The
`missing-label` warning fires only for literal goto targets with no
declaration in the file. BEYOND has been observed rejecting quoted goto
targets such as `goto "Start"` with `Illegal goto label: Start`; use
bare label names or a declared string variable.

## Loops

The documented loop pattern is label-and-goto control flow. Use an
explicit label, update a counter or state variable, include a short
`Sleep` in repeated runtime probes, and jump back with
`if (<condition>) goto <label>`. End the script with `exit`.

```pangoscript
var i
i = 0

BeginLoop:
  // body
  i = i + 1
  Sleep 10
  if (i < 10) goto BeginLoop
exit
```

BEYOND has been observed rejecting Delphi-style counted loops such as
`For i = 1 To 10` with `Operation expected: to`. PangoLint flags that
shape as `unsupported-for-range-syntax`. Other languages' loop keywords
(`While`, `Do`, `Repeat`, `Until`, `Loop`) trigger the
`unsupported-loop` hint.

## Terminal exit

Pangolin's `Exit` documentation says `Exit` stops script execution and
is typically used at the end of a script section, including universe
components and triggers. BEYOND has also been observed accepting and
running scripts whose final executable line is not `exit`, so PangoLint
treats omitted terminal `exit` as an advisory `missing-terminal-exit`
hint, not evidence that BEYOND will reject the script.

## Expression syntax

The parser does not build an AST for expressions — it preserves the
text and reads bare identifiers for read-tracking. Any operator
the BEYOND interpreter accepts is fine; see `docs/references/operators.md`
for the observed set.

## Permissive posture

- Preserve unknown constructs unless there is strong evidence they
  are invalid.
- Do not reject object/property/index accessors such as
  `Zone.0.Brightness` or quoted property-path strings just because
  they are not in the exported command list. Runtime evidence may
  justify a targeted warning for a specific direct expression shape.
- Prefer warnings and hints over hard errors for sparse
  documentation areas.
- Diagnostics should be explainable from local docs, command export
  data, public-safe reference notes, or runtime readback checks.

## Sources

- Parser: `src/language/parser.ts`
- Diagnostic catalog: `docs/references/diagnostics/README.md`
- Working-examples corpus:
  `docs/references/beyond/pangoscript/working-examples/`
  (`jd3/` is the required zero-diagnostic gate; `jvyduna/` preserves
  attributed upstream examples and is linted as informational)
- Linter regression corpus:
  `docs/references/beyond/pangoscript/linter-regressions/`
  (`pass/` must stay diagnostic-free; `fail/` must emit its expected
  `// PangoLint expect: <code>` diagnostics)
