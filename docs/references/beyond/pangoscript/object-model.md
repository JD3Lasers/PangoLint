# BEYOND Object Model and PangoScript Write Semantics

Empirical findings about how BEYOND exposes state to PangoScript, derived from
runtime observations against a live BEYOND instance and from cross-checking the
official help reference. This is the canonical record - keep it in sync when
new runtime observations invalidate or extend any claim here.

Parenthetical evidence labels are public-safe summaries, not shipped
maintainer provenance IDs.

## Built-in global objects

These objects exist in every BEYOND install and can have knowledge-base entries:

- `Master` - global master state. Examples: `Master.BPM`, `Master.Brightness`,
  `Master.DISPLAYPOPUPTIMEOUT`.
- `Zone` - indexed zone access. Examples: `Zone.0.Name`,
  `Zone.0.Brightness`.
- `Channels` - channel values. Example: `Channels.101.Value`.
- `Cue` - cue properties (typically read after `ControlCue <page>, <cue>`).
- `Projector` - projector properties (typically read after `ControlProJector <n>`).

OSC equivalents: `/beyond/master/...`, `/beyond/zone/#/...`,
`/beyond/cue/#/#/...`, `/beyond/projector/#/...`, `/beyond/smart/#/...`.

## User-defined / installation-specific objects

When a BEYOND universe is created (e.g. `SHOWKONTROL`), BEYOND registers it as
a PangoScript object. Named buttons or items inside the universe become
sub-properties (e.g. `SHOWKONTROL.PangoBlock.Caption`). The same applies to
smart objects (`/beyond/smart/<name>/...`) and fixture objects
(`/beyond/fixture/<NAME>/<FUNCTION>`). These names are fully user-defined and
cannot appear in a static knowledge base.

**Linter posture:** never flag an object-path expression as unknown. Paths are
always installation-specific to some degree.

## Accessor syntax: dot vs bracket

`Zone.N.property` (dot notation) and `Zone[N].property` (bracket notation) are
**not interchangeable**. They access different underlying Delphi objects and
return different values for the same `N` on the same session.

| Operation | `Zone.N.property` | `Zone[N].property` |
|---|---|---|
| Read | live state | different value (often 0) |
| Write via `=` | mutates live state | does not propagate to dotted readback |

Both syntaxes parse and must not be flagged as errors. Only the dotted form is
useful for actually changing or observing state.

Evidence: live BEYOND runtime readback.

## Property writes

`Zone.N.property = value` is the canonical zone-write syntax. Verified on
`Zone.0.Brightness` (100 → 50 → 100) and `Zone.0.SizeX` (100 → 50 → 100). The
write happens atomically in the same Talk UDP packet as the readback when
using `write/readback verification`.

Master-scoped writes via the corresponding LiveControl command also work for
individual scalar properties. Confirmed for: `Zoom`, `SizeX`, `SizeY`, `SizeZ`,
`PositionX`, `PositionY`, `PositionZ`, `RotoSpeedX`, `RotoSpeedY`, `RotoSpeedZ`,
`AnimationSpeed`, `HueShift`, `Saturation`, `StrobeSpeed`, `ColorSlider`.

Evidence: live BEYOND runtime readback.

### Aggregate properties (do not reflect direct writes)

`Size` (without an axis suffix) does **not** reflect direct writes via the
`Size` command or `Zone.N.Size = value`. The readback continues to return 0
even immediately after a write. The same pattern holds at both Master and Zone
scope.

**Use per-axis instead** - `SizeX`, `SizeY`, `SizeZ` work normally.

`Master.Size` and `Zone.N.Size` are best treated as derived read-only
aggregates rather than writable scalars.

Evidence: live BEYOND runtime readback.

## Contextual statements (the destination model)

PangoScript has a current "destination" (also called "context"). By default
this destination is `Master`. The following statements change the destination
for all subsequent commands in the same script until changed again or the
script exits:

- `ControlMaster`
- `ControlCue <page>, <cue>`
- `ControlZone <n>` (or by name as a string)
- `ControlProJector <n>`
- `ControlSelCues`, `ControlSelZones`, `ControlSelProTracks`
- `ControlFromUI`, `ControlFromFxTab`, `ControlFromLcTab`, `ControlFromTcTab`

After `ControlZone N`, scalar commands like `Brightness 50` target Zone N
(documented behavior, not yet locally re-checked under the new lab topology).

### Default destination is Master (verified 2026-05-04)

Earlier notes hypothesized that the default destination might be something
other than `Master`, which would explain why `AngleX`/`MasterSpeed` writes
seemed not to update `Master.*` paths. **That hypothesis is now rejected.**
Runtime observations from the macOS laptop against BEYOND on the LAN show:

- `Brightness 50` (no `ControlMaster` prefix) → `Master.Brightness` reads 50.
- `Zoom 60` (no prefix) → `Master.Zoom` reads 60.
- Adding `ControlMaster` first changes nothing - both writes already land on
  Master by default.

So LiveControl-style write commands default to the Master destination. The
AngleX/MasterSpeed mystery has a different cause (see next section).

Evidence: live BEYOND runtime readback.

## BEYOND-side log channels - investigated, not useful

Investigated 2026-05-04 (do not re-investigate without new information):

- **Syslog client** (Network > SysLog client, RFC 3164/5424). Works, but
  forwards only UI hint messages (e.g. tooltip text). Does not log script
  command execution, parse errors, or property writes - even with a deliberate
  garbage command sent over Talk UDP.
- **`BEYONDLog.dat`** in the BEYOND `Log/` directory. Binary file with header
  `PangolinCrshLg1` ("Pangolin Crash Log"). Tiny (~1.5 KB) regardless of
  session length - appears to be metadata only. Not greppable.
- **`BEYOND_<timestamp>_PartN.log`** files (multi-MB). Look like text but
  contents are encrypted/encoded (Notepad++ shows gibberish). Pangolin's
  intensive-logging output is intended for Pangolin support, not user
  inspection.

Conclusion: BEYOND has no plain-text runtime trace channel reachable over
the network. **OSC readback is the only programmatic diagnostic surface**.

**However, BEYOND DOES have a runtime-command-failure log - but it's
in-app only**: the **Notification Center** (PangoScript panel →
Notification center tab in the BEYOND UI) emits human-readable diagnostics
when commands silently fail (e.g. *"Select Zone - Command has not action
because no selected Zone."*). When a runtime check inexplicably produces no
observable change, the user can check the Notification Center for the
explanation. This was discovered 2026-05-04 while debugging the
destination model - it doesn't appear in any of the three log channels
above and cannot be piped over the network as of build 5.5.0.2044.

## Silent zero on unknown property reads (footgun)

**BEYOND returns `0` for any `Master.<unknown>` read with no error.** Verified
against `Master.RotX`, `Master.SpeedMaster`, `Master.Angle`,
`Master.AngleX.Value`, `Master.RotateX`, `Master.RotationX`,
`Master.MasterSpeed`, and `MasterSpeed` (no object prefix) - all returned 0
indistinguishably from a property that genuinely holds zero.

**Implications:**

1. A `0` readback proves nothing - the path may not exist at all.
2. The "Confirmed readable `Master.*` properties" list below was built on the
   assumption that any responding read path was real. Properties whose default
   value happens to be 0 (`AngleX`, `AngleY`, `AngleZ`, `Speed`, etc.) need
   re-validation via **write a distinctive value, require readback to match**.
3. Runtime checks generally should not treat a 0 readback as evidence. Write a
   non-zero value first, then compare.

Evidence: live BEYOND runtime readback.

### AngleX / MasterSpeed write behavior - still unexplained

`AngleX 30` and `MasterSpeed 80` were sent via Talk UDP and confirmed to
reach BEYOND (the OSC return path completed normally). Neither write
manifested at any of 8 candidate read paths each (`Master.AngleX`,
`Master.Angle.X`, `Master.RotateX`, `Master.RotationX`, `Master.RotX`,
`Master.AngleX.Value`, `AngleX`, `Master.Angle`; analogous list for
MasterSpeed). All returned 0 before and after the write.

Plausible remaining explanations (none verified):

- The commands are no-ops in the current BEYOND state (no cue loaded, output
  locked, projector disabled).
- The write hits internal state that isn't exposed via `Master.*` dot syntax.
- The write requires a `Save`, `Refresh`, or playback tick to commit before a
  read sees it.

Future checks: load an active cue first, retry; or watch UI state directly to
see if the write took effect outside the script-readable surface.

## `Master.*` property taxonomy (revalidated 2026-05-04)

An early runtime readback pass listed 41 readable `Master.*` properties. After
the silent-0-on-unknown-property finding, those claims were re-checked with a
stricter protocol: write a distinctive value (73, or a property-appropriate
test value), then read back and require an exact match.

### Tier 1 - confirmed writable + readable (20)

`Master.<Name>` reads back the value just written via `<Name> <value>`. Safe
to lint and validate with confidence:

```
Brightness, SizeX, SizeY, SizeZ, Zoom,
PositionX, PositionY, PositionZ,
RotoSpeedX, RotoSpeedY, RotoSpeedZ, AnimationSpeed,
Hue (-1 = disabled), HueShift, Saturation, ScanRate,
StrobeSpeed, VisiblePoints, BeamBrush, ColorSlider
```

### Tier 2 - confirmed readable only; direct write doesn't take (8)

These read consistent non-zero values that are too distinctive to be the
silent-0 footgun, so the read path is real. `<Name> <value>` does not update
them - they need a different write mechanism (typically tab-scoped or via a
specialized command):

| Property | Default observed | Likely write path |
|---|---|---|
| `BPM` | 120 | `TapBPM`, system clock, or `ManualBPM` |
| `FXSpeed` | 1 | scoped under FX tab |
| `CueSpeed` | 1 | scoped under cue tab |
| `LCSpeed` | 1 | scoped under LiveControl tab |
| `ZoneFXSpeed` | 1 | scoped under zone FX tab |
| `ShowBrightness` | 100 | show-scoped command |
| `ShowSpeed` | 1 | show-scoped command |
| `TransitionIndex` | 3 | cue-selection driven |

### Tier 3 - no evidence the `Master.<Name>` read path exists (14)

These properties read 0 with original=0, and stayed at 0 through every
alternate write attempt: direct command, property-assignment syntax
(`Master.X = value`), multi-arg variants (`Color R,G,B,A`), integer-tag
readback. None responded.

```
Speed, Size, AngleX, AngleY, AngleZ,
ColorR, ColorG, ColorB, Alpha,
ClockShift, MetroShift, Pause,
ManualBPM, AudioBPM
```

**Update 2026-05-04 (color components)**: the `ColorR/ColorG/ColorB/Alpha`
entries above were checking the WRONG names. The actual Tier-1 readable
master color paths are **`Master.Red`, `Master.Green`, `Master.Blue`,
`Master.Alpha`** (no `Color` prefix on the component). Verified by writing
via `RGBA r,g,b,a` and `ColorBGR/ColorRGB <hex>` - see the "Color writes"
section. The `ColorR/ColorG/ColorB/Alpha` paths remain genuinely
silent-0 and should not be relied on.

**Update 2026-05-04 (Pause graduates to Tier 1)**: re-tested with proper
destination context (`SelectZone 1 + ControlZone 1 + Pause 1`), then with
direct property assignment (`Master.Pause = 1`). The COMMAND `Pause 1`
does NOT update `Master.Pause`, but the **direct property assignment
`Master.Pause = 1` works** (Master.Pause: 0 → 1, restored to 0 cleanly).
So `Master.Pause` IS a real Tier-1 read+write path; the same-named command
either targets a different scope or no-ops.

**Generalizing**: when a `<Name>` command silently no-ops, try
`<scope>.<Name> = <value>` direct assignment. The command and the
readable property may be on different surfaces. Evidence: live BEYOND runtime readback.

**Update 2026-05-04 (RegisterOscFeedback as the disambiguation tool)**:
the silent-0 footgun is finally solvable. `RegisterOscFeedback "<addr>",
"<property>"` correctly stays silent for unknown property paths and only
fires callbacks when a real property changes - even with cue running for
runtime-state-dependent commands. Verified `master.totallymadeupthing`
(fabricated) → no callbacks; `master.brightness` (real) → callbacks fired
with new values. Evidence: live BEYOND runtime readback.

Caveat per the engineering standards runtime-safety posture: registrations LEAK until
BEYOND restart. Use a unique run prefix to avoid colliding with prior
runs.

**Tier-1 graduations from feedback observation**:

- `Master.BPM` - `Master.BPM = 137` triggers callback. Was Tier 2
  (readable, command-write inert); now Tier 1 (assignable).
- `Master.Pause` - confirmed from previous check; assignment fires
  callback as expected.

**Confirmed-fake property paths** (assignment via `Master.<X> = value`
produces NO feedback callback, same as the negative control - these are
NOT real registered properties):

- `master.anglex`, `master.angley`, `master.anglez` (real names are
  `master.rotoanglex/y/z` - see below)
- `master.speed`
- `master.size` (the aggregate; `master.sizex/y/z` work as Tier 1)

**Update 2026-05-04 (BEYOND Object Tree data)**: see
[`master-object-tree.md`](master-object-tree.md) for the full visible
`Master` property surface. Several name-mismatches resolved by checking
the tree and checking via feedback:

| Command | Actual write target | Verified by |
|---|---|---|
| `AngleX 30` | `Master.RotoAngleX` | feedback callback args=[30] |
| `AngleY 30` | `Master.RotoAngleY` | feedback callback args=[30] |
| `AngleZ 30` | `Master.RotoAngleZ` | feedback callback args=[30] |
| `ColorBGR <hex>` | `Master.RGBColor` (aggregate) AND `Master.Red/Green/Blue` (per-component) | feedback callbacks on both |

**New Tier-1 graduations from the tree-driven check**:

- `Master.RotoAngleX/Y/Z` - both command (`AngleX 30`) and assignment
  (`Master.RotoAngleX = 30`) write here.
- `Master.RGBColor` - aggregate color path; `ColorBGR/RGB <hex>` write
  here in addition to per-component `Master.Red/Green/Blue`.
- `Master.CueSpeed` - assignment works (`Master.CueSpeed = 0.7`).
- `Master.Pan` - assignment works.
- `Master.Tilt` - assignment works.

**Update 2026-05-04 (BEYOND command reference)**:
cross-referenced our outstanding mysteries against BEYOND's in-app
command documentation, then verified each candidate with
`RegisterOscFeedback`:

- **`SetBpm 137`** is the real BPM-setting command - writes to
  `master.bpm` cleanly (verified by feedback callback args=[137], 120
  on restore). NOT `BPM` and NOT `ManualBPM` (which appear in the
  command list but didn't fire feedback against `master.bpm`).
- Several speed-setting commands are documented as separate:
  `MasterCueSpeed`, `MasterLCSpeed`, `MasterFXSpeed`, `MasterShowSpeed`.
  Of these, only `Master.CueSpeed` fires feedback under
  `MasterCueSpeed` (Tier 1, verified). The other commands' write
  targets remain opaque from the introspection plane.
- `Size <v>` is documented as setting "Size X, Y and Z of the current
  Live Control" - explicit Live Control destination requirement, same
  prerequisite pattern as `RotoAngleX`. Needs `SelectZone`+`ControlZone`
  retest with the right indexing.

**Still unresolved**:

- `MasterSpeed`, `MasterLCSpeed`, `MasterFXSpeed`, `MasterShowSpeed`
  command write surfaces - feedback registration produces no callbacks
  at the most obvious candidate property names. Treat as opaque
  write surface; effects probably visible in BEYOND UI but not via
  the Talk+OSC introspection plane.
- `Master.MasterBrightness` exists in the tree but assignment produced
  no feedback callback - likely read-only or scope-restricted.

**Linter posture**: do not include these in any known-properties list driving
completions, hovers, or diagnostics. They were over-attributed in the original
readback coverage check via the silent-0 footgun. Evidence: live BEYOND runtime readback.

**What we know about each (despite the read failure)**:

- `Size` is documented as an aggregate; per-axis SizeX/Y/Z work (Tier 1).
- `Pause`, `Color*`, `ManualBPM` are real BEYOND concepts - the entities exist,
  but their script-readable surface isn't `Master.<Name>` over Talk+OscOutTTS.
- `AudioBPM` is likely read-only audio-analyzer output - 0 with no audio input
  is plausible, but unverified as a real path.
- `AngleX/Y/Z` writes reach BEYOND (no error) but don't manifest at any read
  path tried. Possibly no-op without an active cue.

### Other confirmed paths

`Zone.N.property` (dot, 0-indexed) confirmed readable for: `mute`, `select`,
`Brightness`, `Size`, `Zoom`, `SizeX`, `PositionX`, `PositionY`.

`Projector.N.property` confirmed readable for: `SizeX`
(`Projector.0.SizeX = 50`).

## Color writes (verified 2026-05-04)

Evidence: live BEYOND runtime readback.

### What works

| Pattern | Notes |
|---|---|
| `Zone.N.Red = <0..255>` | Per-component write. Works. |
| `Zone.N.Green = <0..255>` | Per-component write. Works. |
| `Zone.N.Blue = <0..255>` | Per-component write. Works. |
| `Zone.N.Alpha = <0..255>` | Per-component write. Works. |
| `ColorChannel.N.R = <0..255>` (case-insensitive) | Per-component write. Works. |
| `ColorChannel.N.G = <0..255>` | Per-component write. Works. |
| `ColorChannel.N.B = <0..255>` | Per-component write. Works. |
| `ColorChannel.N.Color = <packed>` | **BGR-packed** (see below). Works. |

### Packed-color encoding for `ColorChannel.N.Color`

The packed integer is **BGR-ordered**: R in the low byte, G in the middle,
B in the top byte.

```
packed = (B << 16) | (G << 8) | R
R = packed & 255
G = (packed >> 8) & 255
B = (packed >> 16) & 255
```

Verified by writing `ColorChannel.0.Color = 3302600` (R=200, G=100, B=50
under BGR-packed assumption) and reading back `ColorChannel.0.R = 200`,
`.G = 100`, `.B = 50`. Writing the RGB-packed equivalent (13132850)
produces a transposed result - R and B byte positions swap.

This matches the `build_colorchannel_commands` helper in
`Beyond_Preview_Builder/src/beyond_preview_builder/protocols/talk_udp.py`.

### Note on the SWAPCOLOR-style decode/encode pattern

The SWAPCOLOR working example and the per-color button scripts (REDBUTTON1
etc.) decode `ColorChannel.N.Color` values like:

```pangoscript
var b; b = c & 255
var g; g = (c >> 8) & 255
var r; r = (c >> 16) & 255    // misnamed: this is actually B
// ... channel-symmetric transformation T (lerp, max, etc.) ...
var newC; newC = (nb | (ng << 8) | (nr << 16))
```

The variable names assume RGB-packed, but the input is BGR-packed. The
variables labeled `r` and `b` are swapped in semantic content. **However,
the output bytes still land in the correct bit positions** because:

1. The encoder uses the same convention as the decoder (so what came out of
   bit position N goes back into bit position N).
2. The transformation `T` is channel-symmetric (linear interpolation per
   channel, max-of-channels) - applying it to R and B is equivalent to
   applying it to B and R.

So these scripts produce **visually correct** colors despite the misleading
naming. A future refactor could rename for clarity (`r` → `b` and vice
versa, or fix the bit shifts) without changing any output. Do not "fix"
these scripts as if they were buggy - the math works.

The bug pattern would only manifest if a transformation treated channels
asymmetrically (e.g. "boost only R" or "shift hue clockwise"). None of the
checked-in working examples do that.

### What does not work as expected

| Attempted | Result |
|---|---|
| `Color <r>, <g>, <b>` | **Not a real command** - bare `Color` is not in the BEYOND export. Silently dropped. |
| `Color 0xRRGGBB` and `Color 0xBBGGRR` | Same - `Color` is not a real command. |
| `Zone.N.Color` (aggregate read) | Always reads 0. Likely silent-0 unknown path; per-component reads are the answer. |

### Master-scope color commands (verified 2026-05-04)

Evidence: live BEYOND runtime readback.

The BEYOND export contains three color-input commands. All three write to
`Master.Red`, `Master.Green`, `Master.Blue` (and `Master.Alpha` where
applicable) - these are confirmed Tier-1 readable paths, distinct from the
silent-0 `Master.ColorR/G/B` names checked earlier.

| Command | Form | What it writes |
|---|---|---|
| `RGBA r, g, b, a` | per-component (0..255) | Master.Red=r, .Green=g, .Blue=b, .Alpha=a (clean, recommended) |
| `ColorBGR <hex>` | packed integer | Master.Red = `(hex >> 16) & 0xFF`, .Green = `(hex >> 8) & 0xFF`, .Blue = `hex & 0xFF` |
| `ColorRGB <hex>` | packed integer | Master.Red = `hex & 0xFF`, .Green = `(hex >> 8) & 0xFF`, .Blue = `(hex >> 16) & 0xFF` |

**Counter-intuitive naming**: the command suffix describes what the user
wants visually, not the byte order of the integer:

- `ColorBGR 0x0000FF` → top byte=0 → R=0, low byte=0xFF → B=255 → **blue**
- `ColorRGB 0x0000FF` → low byte=0xFF → R=255, top byte=0 → B=0 → **red**

If you want blue, type the hex such that B is in the position the command
suffix implies. The two commands are inverses of each other.

**Recommendation**: prefer `RGBA r, g, b, a` for new code - no ambiguity,
explicit components.

**Master color readable paths** (Tier 1, verified):

```
Master.Red, Master.Green, Master.Blue, Master.Alpha
```

These are distinct from `Master.ColorR/G/B` (silent-0 unknown - Tier 3).
The previously-recorded Tier 3 entries `ColorR, ColorG, ColorB, Alpha` may
have been the wrong names - `Red/Green/Blue/Alpha` is the actual surface.

### Destination model - verified rules and gotchas (2026-05-04)

Evidence: live BEYOND runtime readback (checked against live BEYOND
with the user observing the in-app Notification Center, which revealed
the missing prerequisite that no other channel exposes).

**The full per-zone redirect pattern**:

```pangoscript
SelectZone 1        // 1-indexed, required prerequisite
ControlZone 1       // 1-indexed, sets the destination
Brightness 73       // now writes to Master.Zone[0].Brightness (Zone.0.Brightness reads 73)
RGBA 200,100,50,200 // now writes to Zone.0.Red/Green/Blue/Alpha
```

**Two indexing systems coexist**:

- **Commands** are **1-indexed**: `SelectZone 1`, `ControlZone 1`,
  `SelectAndFocusZone 1`, `UnSelectZone 1`. The first zone is `1`.
- **Object paths** are **0-indexed**: `Zone.0.Red`, `Zone.0.Brightness`.
  The first zone is `0`.

Note: BEYOND validation on 2026-05-07 rejected a direct expression read
of `Zone.0.Points[0].X` with invalid-array-index and unknown-variable
errors. Property-animation docs still show `Zone.0.Points[3].X` as a
quoted string target path; do not assume that string-path support also
means bracketed point paths are valid live expression reads.

`ControlZone 1` redirects to the same zone that `Zone.0.X` accesses.
Off-by-one is the easiest mistake here.

**`SelectZone N` is a hard prerequisite for `ControlZone N`**. If you
issue `ControlZone N` without first selecting the zone (or while no zone
is currently selected from the BEYOND UI), the command is silently
rejected and **all subsequent commands until the next destination switch
are no-ops** at any observable path.

When this happens, BEYOND emits a diagnostic to its in-app **Notification
Center** (PangoScript tab → Notification center): *"Select Zone - Command
has not action because no selected Zone."* This is the only place the
failure is reported - it does NOT appear in syslog, the binary
`BEYONDLog.dat`, or the encrypted intensive `.log` files. The
Notification Center is BEYOND's runtime-command-failure oracle.

**Verified outcomes**:

| Pattern | Effect |
|---|---|
| `Brightness 73` | `Master.Brightness` = 73 (default destination is Master) |
| `SelectZone 1` + `Brightness 73` | `Master.Brightness` = 73 (SelectZone alone does not redirect) |
| `ControlZone 1` + `Brightness 73` (no SelectZone) | **silently no-op** at all paths; check Notification Center |
| `SelectZone 1` + `ControlZone 1` + `Brightness 73` | `Zone.0.Brightness` = 73 ✓ |
| `SelectZone 1` + `ControlZone 1` + `RGBA r,g,b,a` | `Zone.0.Red/Green/Blue/Alpha` all updated ✓ |
| `ControlZone 0` (any combination) | invalid index, silent no-op |

**Recommendation for scripts**:

- For per-zone writes, prefer the explicit property-assignment form
  `Zone.N.Red = X` (0-indexed) - no destination state to manage, no
  prerequisite. Works regardless of selection state.
- Use `SelectZone N` + `ControlZone N` only when you specifically need
  the destination model (e.g., to forward many scalar commands to one
  zone in sequence without repeating the path).
- Always pair `SelectZone N` with `UnSelectZone N` (or `ControlMaster`)
  on exit to leave BEYOND's selection state clean.

**Diagnostic tip**: when a runtime check behaves inexplicably, check BEYOND's
Notification Center. Most "silently failed" commands log a human-readable
explanation there.

### Per-zone vs per-channel distinction

- `Zone.N.<component>` writes set the **projection-zone** RGBA. Use this when
  you want to tint a specific zone's output.
- `ColorChannel.N.<component>` writes set a **named global color channel**
  that scripts and palettes can reference. Use this for shared color state
  consumed by other UI elements (button captions, color-pickers, etc.).

These are independent surfaces - writing one does not affect the other.

## Operator semantics relevant to property paths

These notes come from the external PangoScript intro reference and matter
for parsing assignment vs comparison correctly:

- `=` is **assignment** at statement level but **comparison** inside `()`.
  `if (a = b)` compares `a` with `b`. `a = b` (no parens) assigns.
- `<>` is "not equal" (Pascal-style). Don't parse as `<` followed by `>`.
- `!` is **inversion**, not logical-not: `!x = -(x) - 1`. So `!1 = -2`. This
  is the only unary operator.
- Comparison operators don't chain. `(a < b < c)` evaluates `a < b` to a
  boolean, then compares the boolean with `c`. Use `((a < b) & (b < c))`.
- `%` (mod) is integer-only. Floats are rounded before the operation.
- `0x` prefix denotes hexadecimal integer literals. Output is always decimal.

## What this means for the linter

1. **Permissive bias on object paths.** Any `<Identifier>(\.<Identifier>|\[<expr>\])+` should parse and lint cleanly, even if the head identifier is unknown - it could be a user-defined universe.
2. **Both `Zone.N.X` and `Zone[N].X` parse.** Don't error on either form.
3. **Property-write assignments** (`Master.X = value`, `Zone.N.X = value`,
   `Universe.Item.Caption = value`) are valid statements and the existing
   `findAssignmentOperator` already handles them correctly.
4. **`<>` and `!` operators** must not be misinterpreted by the parser. As of
   2026-05-05 we don't explicitly tokenize them, but `findAssignmentOperator`
   correctly skips `<>` (the `=` check excludes adjacent `>`/`<`).
5. **Diagnostic on bracket-write footgun.** A future enhancement could warn
   when `Zone[N].property = value` is used (bracket-assignment is a no-op for
   state changes), but this is opinionated and not implemented.
6. **Object Tree alias placeholders.** Generated object-property data uses
   `ZoneAlias` and `UniversePanelAlias` as stable placeholders for
   user-configured names. They identify replaceable name slots, not literal
   roots that must exist in every show.

## Maintenance

When new runtime evidence contradicts or extends a claim here, edit this file,
update related public-safe overlay notes in
[`data/pangoscript/commands.overlay.json`](../../../../data/pangoscript/commands.overlay.json).
This file is the canonical record - claims here outrank older notes in
agent-local memory.
