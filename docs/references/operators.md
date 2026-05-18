# PangoScript operators (agent reference)

PangoScript is Delphi-shaped. Operator support is sparsely documented;
this page captures what we have observed in working scripts plus what
the bundled parser recognizes. Treat it as a starting point, not a
guarantee — if you need operator behavior PangoLint hasn't verified,
run a small readback check and inspect a safe property such as `Master.Brightness` instead of
guessing.

## Assignment

`=` assigns. Targets include local variables (`Var`-declared),
`GlobalVar` variables, and writable property paths
(`Master.Brightness`, `Zone.0.Red`, `ColorChannel.0.Color`).

```
var x
x = 50
Master.Brightness = x
```

## Comparison (inside `if`)

`=` is also equality inside an `if` condition (Delphi convention).

```
if (mode = 1) goto SecondaryActive
if (Master.Brightness > 50) goto BrightPath
```

Recognized comparisons:

- `=`, `<>` — equality / inequality
- `<`, `<=`, `>`, `>=` — ordering
- `==` is also accepted in observed scripts; use `=` when in doubt
- `!=` was rejected during BEYOND validation with `Operation expected: !`;
  use `<>` for not-equal comparisons

## Bitwise

Color packing in the corpus uses bitwise operators heavily:

- `|` — bitwise OR
- `&` — bitwise AND
- `<<`, `>>` — left / right shift

```
var packed
packed = (r << 16) | (g << 8) | b
ColorChannel.0.Color = packed
```

BEYOND validation on 2026-05-07 accepted `max(1 << intValue, 1)`
with `intValue = 3` and emitted `8`, confirming left-shift behavior
inside nested assignment expressions.

## Arithmetic

`+`, `-`, `*`, `/` are observed. Division semantics on integer
operands have not been runtime-checked; if you need an integer-only result,
use `Trunc(...)` or split the value with bit shifts.

## Logical

BEYOND rejected a parenthesized compound condition joined by textual
`and` with `Operation expected: and` during local validation. Treat
textual `and` / `or` inside `if` conditions as unsafe; PangoLint warns
on this shape. Prefer chaining with `if ... goto ...` flow control:

```
if (a > 0) goto check2
goto skipBranch
check2:
if (b > 0) goto runBoth
```

## Case-insensitivity

Identifiers (commands, properties, variables, labels) are matched
case-insensitively. The parser preserves the user's casing in error
messages; lookups go through `name.toLowerCase()`.

## String literals

Double-quoted only. Strings cannot span multiple lines. Escape an
embedded quote with `\"`:

```
DisplayPopup "Hello, \"world\""
```

## Comments

Line comments only, started with `//`. There is no `{ ... }` or
`(* ... *)` block-comment form.

## Sources

- `data/pangoscript/commands.merged.json` — curated command catalog
- `docs/references/beyond/pangoscript/working-examples/jd3/` — corpus
  scripts we lint as "must stay diagnostic-free"
- `docs/references/beyond/pangoscript/working-examples/jvyduna/` —
  attributed third-party examples linted as informational
- Parser source: `src/language/parser.ts`
