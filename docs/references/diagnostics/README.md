# PangoLint diagnostic codes

Every PangoLint diagnostic carries a code that links here. The code in
the Problems panel is clickable when VS Code renders this page.

PangoLint biases permissive - most rules below are **warning** or
**hint** level, not error, so an unfamiliar pattern doesn't block
your edit. Real errors are reserved for unambiguous syntax failures.

---

## analysis-limited

**Severity:** warning.

PangoLint skipped a full-file pass or an unusually long line because
the input exceeds the extension's bounded-analysis limits. This protects
the VS Code extension host and MCP server from untrusted `.BeyondCode`
files that would otherwise trigger excessive CPU or allocation work.

**How to fix:** split the script into smaller files or shorten the
flagged line, then rerun diagnostics. The source text is preserved
unchanged.

---

## unclosed-string

**Severity:** error.

The line contains an opening `"` with no matching closing `"`.

**How to fix:** add the closing quote, or escape the open quote with
`\"` if it was meant as a literal.

---

## unbalanced-parentheses

**Severity:** warning.

The line has an unequal count of `(` and `)`, or a `)` appears before
its matching `(` (e.g. `)(`).

**How to fix:** check the parenthesization. Inside if-conditions and
RGBA-style arg lists this often means a missing closing paren.

---

## unknown-command

**Severity:** warning.

The line begins with an identifier that isn't in the curated BEYOND
command catalog (521 commands as of build 2044) and isn't a recognized
control-flow keyword (`for`, `next`, `if`, `goto`, `var`, `globalvar`,
`exit`).

**How to fix:**

- If the command name is a typo, take the lightbulb's suggested
  replacement (Levenshtein-ranked against the catalog).
- If the command is real but missing from the catalog, please open an
  issue at <https://github.com/JD3Lasers/PangoLint/issues> with the
  command name and a usage example.
- If the line is intentionally unknown syntax (Delphi-shaped accessor,
  etc.), the warning is informational - PangoLint preserves the line
  unchanged.

---

## wrong-arg-count

**Severity:** warning.

A curated command was called with too few or too many arguments
relative to its documented signature.

Two common shapes:

- The signature declares `<param>` placeholders and the call has the
  wrong arity (e.g. `Brightness` with no value, or `Brightness 50, 100`).
- The signature is zero-arity (no `<...>` placeholders, no parameters
  list) and the call passed something - caught the
  `EnableLaserOutput 1` class of bug.

**How to fix:** consult the hover tooltip or signature help for the
correct argument list.

---

## missing-label

**Severity:** warning.

A literal `Goto <name>` or `If <cond> Goto <name>` references a label
that doesn't appear as a `<name>:` declaration anywhere in the file.
Declared string variables are treated as variable-resolved goto targets,
so `goto targetName` does not emit this diagnostic when `targetName`
is declared.

**How to fix:** add the label declaration, fix the typo (case-
insensitive match - PangoScript labels are case-insensitive), or
remove the goto if it's dead code.

---

## unsupported-quoted-goto-label

**Severity:** warning.

BEYOND has been observed rejecting quoted `Goto` targets such as
`goto "Start"` with `Illegal goto label: Start`.

**How to fix:** remove the quotes and use the bare label target:
`goto Start`.

---

## uninitialized-variable

**Severity:** warning.

A variable declared with `Var X` is read in an expression before any
local `X = ...` assignment.

**How to fix:** initialize the variable before reading it, or - if the
variable is set externally (e.g. via OSC or another script) - use
`GlobalVar` instead of `Var` to mark its scope.

---

## unsupported-loop

**Severity:** hint.

The line begins with `While`, `Do`, `Repeat`, `Until`, or `Loop` - constructs that exist in other languages but are **not** valid
PangoScript. Documented conditional loops use label-and-goto control
flow.

**How to fix:** for conditional loops, use a label + `If <cond> Goto <label>`:

```pangoscript
loopStart:
    // body
    if (condition) goto loopStart
exit
```

The `loop` snippet (Tab after typing `loop`) inserts this scaffold.

---

## unsupported-for-range-syntax

**Severity:** error.

BEYOND has been observed rejecting Delphi-style counted loop syntax
such as `For i = 1 To 10` with `Operation expected: to`.

**How to fix:** rewrite the loop using a label, explicit counter
assignment, `if (<condition>) goto <label>`, and a terminal `exit`.

---

## unsupported-logical-operator

**Severity:** warning.

BEYOND has been observed rejecting textual `and` / `or` operators in
`If` conditions, for example `if ((value > 1) and (value < 5)) goto InRange`,
with `Operation expected: and`.

**How to fix:** split the compound condition into explicit label/goto
branches so each `If` contains one comparison.

---

## unsupported-bang-not-equal-operator

**Severity:** warning.

BEYOND has been observed rejecting `!=` in `If` conditions with
`Operation expected: !`. In the observed candidate, BEYOND emitted the
callback before the invalid condition, then stopped before either branch.

**How to fix:** use `<>` for not-equal comparisons.

---

## unsupported-property-index-access

**Severity:** warning.

BEYOND has been observed rejecting direct expression reads of
`Zone.N.Points[...]`, for example `pointX = Zone.0.Points[0].X`, with
`Invalid array index value` and unknown-variable errors.

**How to fix:** use verified dotted property reads such as
`Zone.0.Brightness` for live expression values. Keep `Zone.N.Points[...]`
paths only as quoted strings for commands that explicitly document string
property-path parameters.

---

## unsupported-deltavalue-assignment

**Severity:** warning.

BEYOND has been observed rejecting `DeltaValue(...)` and spaced
`deltavalue (...)` when used as general assignment expressions. No-space
`deltaScaledValue = DeltaValue(-1, 1)` reports `Unknown function, undeclared or
not initialized variable: deltavalue`; spaced
`deltaValue = deltavalue (-1,1)` reports `Operation expected: (`.

**How to fix:** do not use `DeltaValue` as a local assignment expression.
The spaced property/control argument shape, for example
`Master.PhFriction deltavalue (-1,1)`, is operator-reported working in an
APC40 MIDI-to-PangoScript slot, not as a direct editor assignment.

---

## unsupported-deltavalue-command-argument

**Severity:** warning.

BEYOND editor paste/run has been observed rejecting no-space `DeltaValue(...)`
in property/control argument command forms, for example
`Master.PhFriction DeltaValue(-1, 1)`, with `Unknown function, undeclared or
not initialized variable: deltavalue`.

**How to fix:** in direct editor-run scripts, do not use the no-space
`DeltaValue(...)` command-argument form. For a MIDI-to-PangoScript slot, use
the observed spaced form, such as `Master.PhFriction deltavalue (-1,1)`, and
validate it against the actual bound controller.

---

## deltavalue-midi-slot-context

**Severity:** hint.

BEYOND editor paste/run has been observed rejecting spaced
`deltavalue (...)` property/control command forms, for example
`Master.PhFriction deltavalue (-1,1)`, with `Unknown function, undeclared or
not initialized variable: deltavalue`. A `DefineMidiTrigger`/`InRangeTrigger`
handler probe was rejected the same way before a MIDI trigger could emit
callbacks. The same shape is operator-reported working in an APC40
MIDI-to-PangoScript slot, so PangoLint treats this as a context warning rather
than an invalid-syntax error.

**How to fix:** if the script is meant to be pasted into BEYOND's PangoScript
editor, avoid `deltavalue (...)`. If it is meant to live in a MIDI-to-PangoScript
slot, keep the slot binding and controller setup with the script and validate it
against the actual MIDI control.

---

## unsupported-exit-semicolon

**Severity:** warning.

BEYOND has been observed reporting `Invalid expression` for `exit;`.
In the validated fixture, earlier callbacks still executed, but the
BEYOND parser still reported the final `exit;` line as an error.

**How to fix:** write `exit` without a trailing semicolon.

---

## missing-terminal-exit

**Severity:** hint.

The final executable line in the script is not `exit`. BEYOND has been
observed accepting this shape, so this is not a parse-failure diagnostic.
It is a best-practice hint: `Exit` stops execution at that point and is
typically used to prevent fall-through between setup blocks, trigger
handlers, and label-driven sections.

**How to fix:** add `exit` at the end of the section if fall-through into
later lines or labels would be unsafe or confusing. If the script is a small
single-section one-shot and BEYOND behavior is intentional, this hint can be
left as documentation of that choice.

---

## extvalue-define-midi-trigger-default

**Severity:** hint.

BEYOND has been observed accepting `DefineMidiTrigger` /
`InRangeTrigger` label handlers that call `ExtValue(...)`, and the handler
does fire for exact range entries. In that context, however, `ExtValue`
returned the same default values seen during direct editor execution, not
the incoming MIDI CC value.

**How to fix:** use `ExtValue` in direct MIDI-to-PangoScript slot scripts
until a trigger-handler form is validated to carry the external value.
For `DefineMidiTrigger` scripts, split behavior by trigger ranges or use
inline trigger commands that do not need `ExtValue`.

---

## unused-variable

**Severity:** hint.

A variable declared with `Var <name>` is never read in any expression
in this file. Likely dead code or a typo.

`GlobalVar` declarations are intentionally exempt - those are
routinely mutated externally (OSC, sister scripts) and "unused" inside
the current file says nothing about whether they're live.

**How to fix:**

- Remove the declaration if the variable really is dead.
- If the variable is set by an external script and read here, the
  current parser hasn't seen its read site yet - silence the hint by
  promoting the declaration to `GlobalVar`.
- If the name is a typo of a real read site (e.g. you wrote
  `Var ZoneName` and read `zonename` in another file), reconcile the
  spelling.

---

## unused-label

**Severity:** hint.

A label declared with `<name>:` is never the target of a `Goto` or
`If <cond> Goto` in this file.

The rule only fires when the file already contains at least one
`Goto` - files with zero gotos are typically event handlers where the
label IS the entry point invoked externally by BEYOND. The rule also
exempts common entry-point names: `Init`, `Start`, `Main`, `Setup`,
`End`, `Finish`, `OnClick`, `OnDoubleClick`, `OnPress`, `OnRelease`,
`OnHover`, `OnMouseOver`, `OnMouseOut`, `OnEnter`, `OnExit`,
`OnLoad`, `OnUnload`.

**How to fix:**

- Remove the label declaration if it's truly dead.
- Add the missing `Goto <label>` if a control-flow path was lost.
- Rename the label to a recognized entry-point name if BEYOND invokes
  it externally and the rule shouldn't apply.

---

## property-typo

**Severity:** hint.

A property path like `Master.<X>` or `Zone.0.<X>` was written where
`<X>` isn't in the canonical schema for that object root, but a close
match (within Levenshtein distance ≤ 2 absolute or ≤ 30% of length)
**is** in the schema.

PangoLint silently passes unknown property paths under unknown roots
(permissive) - this hint only fires when the root IS known and we
have high confidence the property name is a typo.

**How to fix:** take the lightbulb's suggested replacement, or fix
the property name yourself. The diagnostic's quick fix replaces the
typo'd path with the suggestion in one click. Use `PangoLint: fix all
property typos in file` from the lightbulb to apply every typo fix
at once.
