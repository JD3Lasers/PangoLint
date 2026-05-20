---
category: Live Control
order: 11
---
# Live Control

Live Control property commands set the continuous effect parameters - size, position, angle, rotation speed, brightness, colors, animation speed, scan rate, strobe, and beam brush - on the currently routed Live Control target. Each property maps to a named slider in the BEYOND Live Control tab. Delta variants apply a relative offset; Reset variants restore the default value.

## Commands

### ClickLCTabMode

Signature: `ClickLCTabMode <mode>`

Set the active destination on the Live Control tab. Per Pangolin
Wiki (entry 0098): "Connect Live Control tab to Master LC." The
command is named for the *click* action - it simulates a click on
the corresponding mode button.

Runtime note (2026-05-11): this is a UI/routing action. The Object
Tree contains `MasterLC.*` data properties but no stable
LCTab/TabMode routing-state property, so this is classified as
no-direct-property for command/property coverage.

Parameters:
- mode (integer, 1..4): 1 = Master, 2 = Cue, 3 = Zone, 4 = ProTrack.

Example:

    ClickLCTabMode 2 // Cue mode

Safety: T1 - UI mode change.

Related: `ClickFXTabMode`, `ClickTCTabMode`, `ControlFromLcTab`
(see [selecting-live-control.md](./selecting-live-control.md#controlfromlctab)).

### Size

Signature: `Size <x>, <y>, <z>`

Set the LiveControl object's size on all three axes in one call.
Values are percent (100 = no scaling, 400 = max). Each parameter
writes the corresponding `Master.SizeX/Y/Z` property - there is no
aggregate "Master.Size" readback.

**Verified 2026-05-06**:

- **Exactly 3 args required.** The 1-arg form `Size 75`, the 2-arg
 form `Size 60, 80`, and the 4-arg form `Size 10, 20, 30, 40` are
 all silently dropped (no axes change). Use 3-arg only.
- **Upper clamp at 400.** `Size 1000, 1000, 1000` → all axes set
 to 400.
- **No lower clamp observed.** `Size -50, -50, -50` lands at
 -50/-50/-50 verbatim (negative-axis scaling = mirror with
 half-size). The documented range "0..400" describes the documented
 intent, but BEYOND only enforces the upper bound at runtime.
- **`Master.Size` is not a real readback property** - every
 readback returns 0 (silent-zero, the BEYOND expression evaluator's
 default for unknown property paths). Read `Master.SizeX/Y/Z`
 individually.

Parameters:
- x (number, 0..400 documented; runtime upper-clamps at 400, no
 lower clamp observed): X-axis size percent.
- y (number, 0..400 documented): Y-axis size percent.
- z (number, 0..400 documented): Z-axis size percent.

Example:

    Size 100, 100, 100 // default
    Size 50, 50, 50 // half-size in all axes
    Size 1000, 1000, 1000 // clamps to 400, 400, 400

Safety: T2 - visible scale change.

Related: `SizeDelta`, `SizeX`, `SizeY`, `SizeZ`, `SizeIndex`,
`Zoom`, `ResetLiveControl`.

### SizeX / SizeY / SizeZ

Signature: `Size<Axis> <value>`

Set a single axis without changing the others. Each reads back as
`Master.SizeX/Y/Z` (1.0 = 100% in float form on Master).

Parameters:
- value (number, 0..400): per-axis size percent.

Example:

    SizeX 100
    SizeY 200 // stretch vertically to 2x
    SizeZ 100

Safety: T2 - visible scale change on one axis.

Related: `Size`, `SizeIndex`.

### SizeDelta

Signature: `SizeDelta <x>, <y>, <z>`

Increment each axis size by the given deltas (also in percent).
Useful for MIDI-encoder-style incremental control.

Parameters:
- x, y, z (number): per-axis delta percent.

Example:

    SizeDelta 0, 1, 0 // grow Y by 1%

Safety: T2 - visible scale change.

Related: `Size`, `SizeIndex`.

### Position

Signature: `Position <x>, <y>, <z>`

Set the position on all three axes in one call.

The documented range is -400..400, but 2026-05-12 MCP write/read
probes of `Master.PositionX/Y/Z` found storage continues slightly past
that range. `400` stores exactly as `400`; `400.001` stores as
`400.0010070800781`; `400.01` stores as `400.010009765625`; and
`400.1`, `401`, `500`, and `1000` all store as `400.01220703125`.
The negative side mirrors this cap: `-400.1`, `-401`, and `-500` all
store as `-400.01220703125`. This is a hard saturation at the stored
float boundary, not an asymptotic curve. Evidence is BEYOND property
readback, not PangoLint lint acceptance.

Parameters:
- x, y, z (number, documented -400..400): per-axis position percent.
 Runtime storage caps at +/-400.01220703125.

Example:

    Position 0, 0, 0 // center
    Position 100, 0, 0 // right edge

Safety: T2: visible position change.

Related: `PositionDelta`, `PositionX/Y/Z`, `PositionIndex`,
`ResetPosition`.

### PositionX / PositionY / PositionZ

Signature: `Position<Axis> <value>`

Set a single position axis. Each reads back as
`Master.PositionX/Y/Z` when routed to Master.

Parameters:
- value (number, -100..100): per-axis position percent.

Example:

    PositionX 0
    PositionY -50

Safety: T2 - visible position change.

Related: `Position`, `PositionIndex`.

### PositionDelta

Signature: `PositionDelta <x>, <y>, <z>`

Increment each axis position by the given deltas.

Parameters:
- x, y, z (number): per-axis delta percent.

Example:

    PositionDelta -5, 0, 0 // move left 5%

Safety: T2 - visible position change.

Related: `Position`, `PositionIndex`.

### PositionIndex

Signature: `PositionIndex <axis>, <value>`

Per-axis setter using a numeric axis index. **Verified 0-based at
runtime in BEYOND 2030**: `0=X, 1=Y, 2=Z` (documentation correct;
export comment's `1=X, 2=Y, 3=Z` is wrong). `PositionIndex 3,...`
and higher are silently no-op'd.

Parameters:
- axis (integer, 0..2): axis index - **0=X, 1=Y, 2=Z**.
 Out-of-range values are silently dropped.
- value (number, -100..100): position value for that axis.

Example:

    PositionIndex 0, 50 // PositionX = 50
    PositionIndex 2, -25 // PositionZ = -25

Safety: T2 - visible position change.

Related: `Position`, `PositionDelta`, `PositionX/Y/Z`.

### AngleX / AngleY / AngleZ

Signature: `Angle<Axis> <degrees>`

Set rotation angle on a single axis. **Verified 2026-05-06**: each
command writes the corresponding `Master.RotoAngle<Axis>` property
(NOT `Master.Angle<Axis>` as the property name suggests). Each
command targets exactly one axis; the other two axes are unaffected.

**Range and clamping** (verified via OSC readback against
`Master.RotoAngleX`):

- Accepted range: `[-2880, +2880]` degrees (i.e. ±8 full rotations).
- Values inside the range pass through verbatim - including
 negatives (`AngleX -45` → -45) and values beyond `[0, 360)`
 (`AngleX 720` → 720). No modulo-360 wrap; the property holds the
 literal degree value.
- Values outside the range silently clamp to the boundary:
 `AngleX 12345` → 2880; `AngleX -10000` → -2880.

The earlier "writes do not manifest at Master.AngleX/Y/Z" runtime
observation was correct - the readback property is
`Master.RotoAngleX/Y/Z` instead. The `Master.AngleX/Y/Z` paths
exist in the object tree but are not the write target for these
commands.

Parameters:
- degrees (number, -2880..+2880): angle in degrees. Out-of-range
 values silently clamp to ±2880. Negatives and large multi-rotation
 values (e.g. 720) are accepted as-is - no wraparound.

Example:

    AngleX 45 // X-axis to 45°, leaves Y/Z untouched
    AngleZ 180 // Z-axis to 180°
    AngleX 720 // accepted as 720 (no wrap)
    AngleX 10000 // clamps to 2880

Safety: T2 - visible rotation change on the master output preview.

Related: `Angle`, `RotoSpeedX/Y/Z`, `ResetRotationX/Y/Z`.

### Angle

Signature: `Angle <x>, <y>, <z>`

Set rotation angle on all three axes in degrees. When routed to Master,
the command writes `Master.RotoAngleX/Y/Z`, not
`Master.AngleX/Y/Z`.

Runtime note (2026-05-11): direct aggregate writes match the
per-axis range. Values inside `-2880..2880` are stored verbatim,
including fractional values. Values outside that range silently clamp
to the nearest boundary.

Parameters:
- x, y, z (number, `-2880..2880`): per-axis angle in degrees.

Example:

    Angle 0, 0, 90 // 90° rotation around Z
    Angle -2881, 12.5, 2881 // reads back -2880, 12.5, 2880

Safety: T2: visible rotation change.

Related: `AngleDelta`, `AngleX/Y/Z`, `RotoSpeed`,
`ResetRotation`.

### AngleDelta

Signature: `AngleDelta <x>, <y>, <z>`

Increment each axis angle by the given deltas. The command reads and
writes the same routed destination properties as `Angle`.

Runtime note (2026-05-11): `AngleDelta` is additive, but boundary
results wrap modulo 2880 rather than clamp. From an angle of `2879`,
`AngleDelta 10, 0, 0` reads back `9` on X. From zero,
`AngleDelta 2881, -2881, 2880` reads back `1, -1, 0`.

Parameters:
- x, y, z (number): per-axis angle delta in degrees. The resulting
 angle wraps at the direct `Angle` boundary.

Example:

    AngleDelta 0, 0, 5 // step Z rotation by 5°

Safety: T2: visible rotation change.

Related: `Angle`.

### RotoSpeedX / RotoSpeedY / RotoSpeedZ

Signature: `RotoSpeed<Axis> <speed>`

Set continuous rotation speed on a single axis. Each reads back as
`Master.RotoSpeedX/Y/Z` when routed to Master.

Runtime note (2026-05-11): `RotoSpeedX 1.5`,
`RotoSpeedY -2.5`, and `RotoSpeedZ 3.5` wrote the matching
`Master.RotoSpeedX/Y/Z` paths exactly.

Range note (2026-05-12): values outside `-1440..1440` silently
clamp to the nearest bound. `RotoSpeedX/Y/Z 10000` read back as
`1440`; `RotoSpeedX/Y/Z -10000` read back as `-1440`.

Parameters:
- speed (number, -1440..1440): rotation speed in degrees per
 second. Values outside this range silently clamp.

Example:

    RotoSpeedX 0 // stop X rotation
    RotoSpeedZ 30 // 30°/sec around Z

Safety: T2: visible motion change.

Related: `RotoSpeed`, `AngleX/Y/Z`.

### RotoSpeed

Signature: `RotoSpeed <x>, <y>, <z>`

Set continuous rotation speed on all three axes.

Runtime note (2026-05-11): `RotoSpeed 4, 5, 6` wrote
`Master.RotoSpeedX=4`, `Master.RotoSpeedY=5`, and
`Master.RotoSpeedZ=6`.

Range note (2026-05-12): all three axes clamp to `-1440..1440`.
`1440` and `-1440` store verbatim; `1441` and `10000` read back as
`1440`; `-1441` and `-10000` read back as `-1440`.

Parameters:
- x, y, z (number, -1440..1440): per-axis speed in degrees per
 second. 0 = stop. Values outside this range silently clamp.

Example:

    RotoSpeed 0, 0, 0 // stop all rotation

Safety: T2: visible motion change.

Related: `RotoSpeedDelta`, `RotoSpeedX/Y/Z`, `Angle`.

### RotoSpeedDelta

Signature: `RotoSpeedDelta <x>, <y>, <z>`

Increment each axis rotation speed by the given deltas.

Runtime note (2026-05-12): resulting speeds clamp to `-1440..1440`.
From a zero baseline, `RotoSpeedDelta 10000, 10000, 10000` read
back as `1440, 1440, 1440`, and the negative form read back as
`-1440, -1440, -1440`.

Parameters:
- x, y, z (number): per-axis speed delta in degrees per second.
 Resulting speeds clamp to `-1440..1440`.

Example:

    RotoSpeedDelta 0, 0, -1 // decrement Z rotation speed

Safety: T2: visible motion change.

Related: `RotoSpeed`.

### Brightness

Signature: `Brightness <value>`

Set the LiveControl brightness. **Directly affects live laser
output** through the routed destination. Reads back as
`Master.Brightness` when routed to Master.

Parameters:
- value (number, 0..100): brightness percent. 0 = blackout,
 100 = full.

Example:

    Brightness 100 // full
    Brightness 50 // half-dimmed

Safety: T2 - visible brightness change. Restore the original value
to revert (per safety-runbook note in overlay).

Related: `BrightnessDelta`, `MasterShowBrightness` (see
[general.md](./general.md#mastershowbrightness)),
`VisiblePoints`, `ResetLiveControl`.

### BrightnessDelta

Signature: `BrightnessDelta <delta>`

Relative version of `Brightness`. Useful for MIDI-encoder
increments.

Parameters:
- delta (number): brightness delta percent (positive or negative).

Example:

    BrightnessDelta 1 // +1%
    BrightnessDelta -10 // -10%

Safety: T2 - visible brightness change.

Related: `Brightness`.

## Visible points

### StrobeSpeedDelta

Signature: `StrobeSpeedDelta <delta>`

Relative version of `StrobeSpeed`. documentation example:
`StrobeSpeedDelta 0.1` (increment strobe). **Verified 2026-05-06**:
applied to a baseline of 0.5 with a delta of 0.1, result was
~0.6 (additive, with float32 roundtrip noise: 0.6000000238...).
Final value clamps to `Master.StrobeSpeed` range `[0, 100]`.

Parameters:
- delta (number): strobe-speed delta in flickers/second.

Example:

    StrobeSpeedDelta 0.1
    StrobeSpeedDelta -0.5

Safety: T2 - visible flicker effect change.

Related: `StrobeSpeed`.

## Reset

These commands wipe partial or full LiveControl state on the routed
destination back to defaults. Use as a "clean slate" before
applying new property values.

### VisiblePoints

Signature: `VisiblePoints <value>`

Percentage of laser output points that render. Reduces visible
output without changing brightness - useful for dim/sparse looks.
Reads back as `Master.VisiblePoints` when routed to Master.

Parameters:
- value (number, 0..100): visible-points percent. 0 = no points
 rendered; 100 = all rendered.

Example:

    VisiblePoints 100 // full
    VisiblePoints 50 // half the points

Safety: T2 - visible output change.

Related: `VisiblePointsDelta`, `Brightness`, `ResetLiveControl`.

### VisiblePointsDelta

Signature: `VisiblePointsDelta <delta>`

Relative version of `VisiblePoints`. The documentation copy-pastes
the BrightnessDelta description ("delta-version of brightnes
control") for this entry - assume parity with `VisiblePoints`.

Parameters:
- delta (number): per-step delta percent.

Example:

    VisiblePointsDelta 0 // no change
    VisiblePointsDelta -5 // reduce by 5%

Safety: T2 - visible output change.

Related: `VisiblePoints`.

## Animation and scan rate

### ColorSlider

Signature: `ColorSlider <value>`

Set the LiveControl color slider value. Reads back as
`Master.ColorSlider` when routed to Master.

A 2026-05-12 MCP write/read probe showed non-integer inputs round to
nearest integer with half values rounded to even, then clamp to
0..255: `0.1`, `0.4`, and `0.5` read back 0; `0.6` and `0.9`
read back 1; `1.5` read back 2; `254.5` read back 254; `255.5`
read back 255. This is based on BEYOND runtime readback, not
PangoLint lint acceptance, because this command data is still being
filled in.

Parameters:
- value (number, 0..255): color slider value.

Example:

    ColorSlider 0
    ColorSlider 128 // mid-slider

Safety: T2: visible color change.

Related: `ColorSliderDelta`, `RGBA`.

### ColorSliderDelta

Signature: `ColorSliderDelta <delta>`

Relative version of `ColorSlider`.

Parameters:
- delta (number): slider delta value.

Example:

    ColorSliderDelta 5

Safety: T2 - visible color change.

Related: `ColorSlider`.

### AnimationSpeed

Signature: `AnimationSpeed <value>`

LiveControl animation speed slider. The documented range is
25..200 (with 100 = default). Per BEYOND export the range is
documented as "speed in %. Zero full stop." - implying 0..N. Treat
the wider range (0..N) as authoritative since the export is more
recent. Reads back as `Master.AnimationSpeed` when routed to
Master.

Parameters:
- value (number, 0..200): speed percent. 100 = default. 0 = full
 stop.

Example:

    AnimationSpeed 100 // default
    AnimationSpeed 0 // stop animation
    AnimationSpeed 200 // 2x speed

Safety: T2 - visible motion-speed change.

Related: `AnimationSpeedDelta`, `RotoSpeed`, `ScanRate`.

### AnimationSpeedDelta

Signature: `AnimationSpeedDelta <delta>`

Relative version of `AnimationSpeed`.

Parameters:
- delta (number): speed delta percent.

Example:

    AnimationSpeedDelta -10 // -10%

Safety: T2 - visible motion-speed change.

Related: `AnimationSpeed`.

### ScanRate

Signature: `ScanRate <value>`

LiveControl scan rate slider. Runtime readback against
`Master.ScanRate` confirms the absolute setter accepts values below
25 and clamps only outside 1..400. A 2026-05-12 probe read
`ScanRate 1`, `ScanRate 5`, `ScanRate 10`, and `ScanRate 25` back
exactly. Conceptually similar to `AnimationSpeed`, but controls the
laser scanner sweep rate rather than effect playback speed.

Parameters:
- value (number, 1..400): scan rate percent. 100 = default.

Example:

    ScanRate 1 // accepted by the absolute setter
    ScanRate 100 // default
    ScanRate 400 // observed upper clamp target

Safety: T2, affects laser scanner timing. Caution: values too far
from 100 can stress some scanners.

Related: `ScanRateDelta`, `AnimationSpeed`.

### ScanRateDelta

Signature: `ScanRateDelta <delta>`

Relative version of `ScanRate`. Runtime readback confirms the result
uses a narrower 25..200 clamp than absolute `ScanRate`. From a
baseline of 50, deltas `-49`, `-50`, and `-51` all read back 25.
From a baseline of 1, `ScanRateDelta 1` read back 25 rather than 2.
The 2026-05-12 hardware context had one connected `Projector.0`
endpoint while placeholder FB3 and FB4 roots read disconnected, so
hardware dependence was not proven across device families.

Parameters:
- delta (number): scan rate delta percent. Result clamps to 25..200.

Example:

    ScanRateDelta 10

Safety: T2, affects laser scanner timing.

Related: `ScanRate`.

## Color

Two color systems coexist on each LiveControl object:

- **`ColorSlider`** - single 0..255 slider (color-wheel mode).
- **`RGBA`** - direct R/G/B/A control. "RGBA is
 additional and independent layer to ColorSlider parameter."

They compose; both apply to the routed destination simultaneously.

### Zoom

Signature: `Zoom <value>`

Set the LiveControl zoom value. The documented parameter
is 0..100; per the BEYOND export comment, the range is -100..100
(allowing negative zoom for inversion). Reads back as `Master.Zoom`
when routed to Master.

Parameters:
- value (number, -100..100): zoom value. 0 = neutral.

Example:

    Zoom 100
    Zoom -50

Safety: T2 - visible zoom change.

Related: `ZoomDelta`, `Size`, `ResetLiveControl`.

### ZoomDelta

Signature: `ZoomDelta <delta>`

Relative version of `Zoom` - shift the current zoom value by
`delta`.

Parameters:
- delta (number): zoom delta value.

Example:

    ZoomDelta 5

Safety: T2 - visible zoom change.

Related: `Zoom`.

## Position

The `Position` family translates the LiveControl object on each axis.
"0,0,0 is a center. 100% is boundary. Max value
400%." Coordinates are signed percent (-400..400) where 0 is centered
and 100 is the visible boundary.

### BeamBrush

Signature: `BeamBrush <value>`

Set the laser line width on the routed destination. Per BEYOND
BEYOND documentation: "Set BeamBrush value (laser line
width)." documentation examples: `BeamBrush 0` (sharp line),
`BeamBrush 25` (1/4 width), `BeamBrush 100` (widest).

**Verified 2026-05-06**: writes `Master.BeamBrush`, range `[0, 100]`
with silent clamp on both ends.

Parameters:
- value (number, 0..100): beam line width. 0 = sharp, 100 = widest.
 Out-of-range silently clamps.

Example:

    BeamBrush 0
    BeamBrush 25
    BeamBrush 100

Safety: T2 - visible beam-shape change.

Related: `BeamBrushDelta`.

### BeamBrushDelta

Signature: `BeamBrushDelta <delta>`

Relative version of `BeamBrush`. documentation example: `BeamBrushDelta
1` (make beam wider). **Verified 2026-05-06**: applied to a baseline
of 50 with a delta of 7, result was 57 (additive). Final value
clamps to `Master.BeamBrush` range `[0, 100]`.

Parameters:
- delta (number): beam-brush delta.

Example:

    BeamBrushDelta 1 // slightly wider
    BeamBrushDelta -10 // narrower

Safety: T2 - visible beam-shape change.

Related: `BeamBrush`.

## Strobe

Strobe (flicker) effect on the routed LiveControl destination.

### ColorOn

Signature: `ColorOn <state>`

Enable or disable the color override. Per BEYOND export comment:
"1-enabled, 0-disabled." The semantics of "enabled" - what BEYOND
does differently when the override is on - are not documented in
the export.

Parameters:
- state (integer, 0..1): 1 = enabled, 0 = disabled.

Example:

    ColorOn 1 // enable
    ColorOn 0 // disable

Safety: T2 - toggles a color-override flag; downstream visible
effect depends on what consumes the flag.

Related: `ColorBGR`, `ColorRGB`.

### ColorRGB

Signature: `ColorRGB <packedColor>`

Set a color value with **RGB** byte ordering: low byte is Red,
middle is Green, high is Blue.

Runtime note (2026-05-11): when routed to Master from a non-white
baseline (`RGBA 1, 2, 3, 4`), `ColorRGB 1122867`
(`0x112233`) updated `Master.Red` to 51 and the packed
`Master.RGBColor`; `Master.Green`, `Master.Blue`, and
`Master.Alpha` stayed unchanged.

Runtime note (2026-05-12): from `RGBA 0, 0, 0, 4`, `ColorRGB`
applied the low byte to `Master.Red`: `257` read `1/0/0`, `511`
read `255/0/0`, `512` read `0/0/0`, `0x1FFFF` read `255/0/0`,
and `0xFF0000FF` read `255/0/0`. `Master.Green` and
`Master.Blue` stayed unchanged, and `Master.RGBColor` followed
`Master.Red`. This proves byte masking for the observed Master route,
not full per-channel behavior. PangoLint lint acceptance was not used
as proof because this command data is still being filled in.

Parameters:
- packedColor (integer): packed 24-bit color. Hex literal accepted
 (e.g. `0x0000FF` = pure red under RGB ordering, `0xFF0000` =
 pure blue).

Example:

    ColorRGB 0x0000FF // red
    ColorRGB 0x00FF00 // green
    ColorRGB 0xFF0000 // blue

Safety: T2: color state change.

Related: `ColorBGR` (same operation, different byte ordering),
`ColorOn`.

### ColorBGR

Signature: `ColorBGR <packedColor>`

Set a color value with **BGR** byte ordering: low byte is Blue,
middle is Green, high is Red.

Runtime note (2026-05-11): when routed to Master from a non-white
baseline (`RGBA 1, 2, 3, 4`), `ColorBGR 1122867`
(`0x112233`) updated `Master.Red` to 17 and the packed
`Master.RGBColor`; `Master.Green`, `Master.Blue`, and
`Master.Alpha` stayed unchanged.

Runtime note (2026-05-12): from `RGBA 0, 0, 0, 4`, `ColorBGR`
applied the high byte of the lower 24-bit value to `Master.Red`:
`257`, `511`, and `512` read `0/0/0`; `0x1FFFF` read `1/0/0`;
`0xFF0000FF` read `0/0/0`. `Master.Green` and `Master.Blue` stayed
unchanged, and `Master.RGBColor` followed `Master.Red`. Values above
24 bits ignored higher bits in this probe. PangoLint lint acceptance
was not used as proof because this command data is still being filled
in.

Parameters:
- packedColor (integer): packed 24-bit color. Hex literal accepted
 (e.g. `0x0000FF` = pure blue under BGR ordering, `0xFF0000` =
 pure red).

Example:

    ColorBGR 0x0000FF // blue
    ColorBGR 0x00FF00 // green
    ColorBGR 0xFF0000 // red

Safety: T2: color state change.

Related: `ColorRGB` (same operation, different byte ordering),
`ColorOn`.

### RGBA

Signature: `RGBA <r>, <g>, <b>, <a>`
Signature: `RGBA <r>, <g>, <b>`
Signature: `RGBA <index>, <value>`

Direct R/G/B/A color control. Three forms: full 4-channel, RGB
only (alpha unchanged), or single-channel by index.

Runtime note (2026-05-11): `RGBA 10, 20, 30, 40` wrote
`Master.Red`, `Master.Green`, `Master.Blue`, and `Master.Alpha`
directly; `Master.RGBColor` reflected the packed RGB value.

**Verified 0-based axis indexing at runtime in BEYOND 2030**: index
form uses `0=Red, 1=Green, 2=Blue, 3=Alpha`. Same convention as the
verified-0-based `PositionIndex`, so the family is consistent.

Indexed out-of-range note (2026-05-12): from `RGBA 0, 0, 0, 0`,
`RGBA 4, 55` wrote `Master.Red=55` and left
`Master.Green/Blue/Alpha=0`. `RGBA 5, 77`, `RGBA 6, 99`,
`RGBA 7, 11`, `RGBA -2, 33`, and `RGBA -1, 44` made no observable
channel change. This is not a general wrap mapping; keep indexed RGBA
writes in the documented 0..3 range.

Parameters (4-arg form):
- r, g, b (integer, 0..255): color channels.
- a (integer, 0..255): alpha (transparency) channel.

Parameters (3-arg form):
- r, g, b (integer, 0..255): color channels. Alpha unchanged.

Parameters (2-arg form):
- index (integer, 0..3): channel index, **0=Red, 1=Green,
 2=Blue, 3=Alpha** (verified). Stay within 0..3; index 4 has
 irregular Red alias behavior and other probed out-of-range indexes
 no-op.
- value (integer, 0..255): channel value.

Example:

    RGBA 255, 255, 0, 128 // yellow at 50% alpha
    RGBA 255, 255, 0 // yellow, alpha unchanged
    RGBA 3, 64 // alpha to 64

Safety: T2: visible color change.

Related: `RGBADelta`, `ColorSlider`, `PositionIndex` (same
0-based-axis convention).

### RGBADelta

Signature: `RGBADelta <r>, <g>, <b>, <a>`
Signature: `RGBADelta <r>, <g>, <b>`
Signature: `RGBADelta <index>, <value>`

Relative version of `RGBA`. Same three forms, applied as deltas.

Runtime note (2026-05-11): from `RGBA 10, 20, 30, 40`,
`RGBADelta 1, 2, 3, 4` produced `Master.Red=11`,
`Master.Green=22`, `Master.Blue=33`, `Master.Alpha=44`, and
updated packed `Master.RGBColor`.

Indexed out-of-range note (2026-05-12): from `RGBA 10, 20, 30, 40`,
`RGBADelta 4, 10` made no observable channel change. This differs from
`RGBA 4, value`, which writes Red.

Parameters: see `RGBA`. Each value is a per-channel delta instead of
absolute value.

Example:

    RGBADelta 0, 0, 0, -16 // decrease alpha by 16

Safety: T2: visible color change.

Related: `RGBA`.

## Hue, hue-shift, and saturation

Three independent color properties - `Hue` (replace), `HueShift`
(offset), and `Saturation` (offset) - each with a `*Delta` companion.
All write `Master.<property>` when routed to Master.

**Critical distinction**: `Hue` REPLACES the input color's hue
component (e.g. forces all output to red, regardless of cue colors).
`HueShift` ROTATES the existing hues by an offset (preserves the cue's
relative palette but rotates the whole thing). `Saturation` is a
SIGNED offset - 0 means no change, positive saturates further,
negative desaturates toward grey.

The three are designed to compose: `Hue` recolors, then `HueShift`
oscillates around the recolored value, then `Saturation` scales how
vivid the result looks.

### InvertRotationX / InvertRotationY / InvertRotationZ

Signature: `InvertRotation<Axis>`

Invert (reverse direction) the continuous rotation on a single axis.
Takes no parameters - it flips whatever speed is currently set.

Example:

    InvertRotationZ // reverse Z rotation direction

Safety: T2 - visible motion change.

Related: `RotoSpeed<Axis>`.

## Brightness

### ResetPosition

Signature: `ResetPosition`

Reset all three position axes to 0 (center).

Runtime note (2026-05-11): `Position 10, 20, 30` followed by
`ResetPosition` wrote `Master.PositionX=0`, `Master.PositionY=0`,
and `Master.PositionZ=0`.

Example:

    ResetPosition

Safety: T2 - visible position reset.

Related: `Position`, `ResetLiveControl`.

## Rotation angle

The `Angle` family sets a static rotation angle on each axis (in
degrees). For continuous rotation see `RotoSpeed*`.

### ResetRotation

Signature: `ResetRotation`

Reset all rotation angles to 0.

Example:

    ResetRotation

Safety: T2 - visible rotation reset.

Related: `ResetRotationX`, `ResetRotationY`, `ResetRotationZ`,
`ResetLiveControl`, `Angle`.

### ResetRotationX / ResetRotationY / ResetRotationZ

Signature: `ResetRotation<Axis>`

Reset a single axis rotation angle to 0.

Example:

    ResetRotationX

Safety: T2 - visible rotation reset on one axis.

Related: `ResetRotation`, `Angle<Axis>`.

## Rotation speed

The `RotoSpeed` family sets continuous rotation speed in degrees
per second (sign = direction).

### ResetLiveControl

Signature: `ResetLiveControl`

Reset every Live Control parameter (Size, Position, Rotation,
Brightness, Color, etc.) on the routed destination back to default.

Runtime note (2026-05-11): this is a sweeping multi-property reset.
A representative probe reset size, position, rotation angle,
brightness, color slider, animation speed, scan rate, visible
points, zoom, hue, hue-shift, and saturation to their defaults.
`Master.StrobeSpeed` was not reset in that probe, so the command is
kept as deferred coverage until the full reset surface is enumerated.

Example:

    ResetLiveControl

Safety: T2 - visible reset across every LC property.

Related: `ResetPosition`, `ResetRotation`, `ResetLCTab`.

### ResetLCTab

Signature: `ResetLCTab`

Reset the Live Control tab UI to its default state (collapsed view,
default destination). Distinct from `ResetLiveControl`, which resets
the routed object's actual property values.

Runtime note (2026-05-11): UI-only reset. No stable Object Tree
property for the LC tab state was found, so this is classified as
no-direct-property for command/property coverage.

Example:

    ResetLCTab

Safety: T1 - UI state only.

Related: `ResetLiveControl`, `ClickLCTabMode` (see
[live-control.md](./live-control.md#clicklctabmode)).

### ClickLockSize

Signature: `ClickLockSize <state>`

Toggle the **Lock Size** button - when ON, prevents Size adjustments
on the routed Live Control destination. Per BEYOND export comment.
Not documented in Pangolin Wiki.

Runtime note (2026-05-11): UI lock state only. The Object Tree
does not expose a `LockSize` property; `ClickLockSize 1` did not
write `Master.SizeX/Y/Z` directly and was restored with
`ClickLockSize 0`.

Parameters:
- state (integer, 0..2): 0 = Off, 1 = On, 2 = Toggle.

Example:

    ClickLockSize 1 // lock
    ClickLockSize 2 // toggle

Safety: T1 - UI lock state only.

## ClickScroll family

These commands simulate the operator holding down the scroll buttons
adjacent to a Live Control slider - they continuously increment or
decrement the slider value at a configured speed. Stopping requires
sending the same command with `0`.

Per Pangolin Wiki (entries 0070-0080) and the BEYOND export
comments, the speed parameter follows a consistent convention:
**recommended range −5..−1 or 1..5; 0 stops the scroll.**

Each variant scrolls a specific Live Control slider on whatever
destination is currently routed (see
[selecting-live-control.md](./selecting-live-control.md)). The full
property semantics live in the upcoming Live Control properties
section; this section just documents the click-and-hold mirror.

### Hue

Signature: `Hue <value>`

Set the LiveControl hue override. Replaces incoming color's hue with
the specified value. BEYOND documentation: "Set the
Hue component. Negative values treated as not active, and hue has not
impact on recolor."

**Verified 2026-05-06** (range probe): writes `Master.Hue`. Special
sentinel `-1` (and any negative value, which clamps to -1) means
"hue override DISABLED - pass through cue colors unchanged." Active
range `[0, 720]` (degrees, with 2× wrap allowed). Above 720 silent-
clamps to 720; below -1 clamps to -1.

Parameters:
- value (number, -1 disabled or 0..720): Hue in degrees, or -1 to
 disable. Out-of-range values silently clamp.

Example:

    Hue -1 // disable hue override
    Hue 0 // force red
    Hue 120 // force green
    Hue 240 // force blue

Safety: T2 - visible color change.

Related: `HueDelta`, `HueShift`, `HueShiftDelta`, `Saturation`.

### HueDelta

Signature: `HueDelta <delta>`

Relative version of `Hue` - adds the delta to the current
`Master.Hue`. documentation example: `HueDelta 5` (shift current hue by
5°). **Verified 2026-05-06**: applied to a baseline of 60 with a
delta of 30, result was 90 (additive).

Parameters:
- delta (number): hue delta in degrees.

Example:

    HueDelta 5 // rotate hue by 5°
    HueDelta -10 // rotate hue back by 10°

Safety: T2 - visible color change.

Related: `Hue`.

### HueShift

Signature: `HueShift <value>`

Set the LiveControl hue-shift offset. It applies on top of incoming
colors rather than replacing them. BEYOND documentation: (id
410): "Hue shift is an additional offset for the hue value. Made for
additional oscillation around current hue. If you need to recolor
then use Hue, which replaces the input color Hue."

Runtime note (2026-05-12): writes `Master.HueShift`. No clamp was
observed through `-1000000..1000000`; all probed values read back
verbatim.

Parameters:
- value (number, effectively unbounded): shift in degrees. Positive
 rotates one way, negative the other. Large values are supported in
 the probed span.

Example:

    HueShift 0 // no shift
    HueShift 90 // rotate all colors 90°
    HueShift -180 // rotate all colors -180° (complement)

Safety: T2: visible color change.

Related: `HueShiftDelta`, `Hue`, `Saturation`.

### HueShiftDelta

Signature: `HueShiftDelta <delta>`

Relative version of `HueShift`. documentation example: `HueShiftDelta 5`
(add 5 degrees to hue-shift). Runtime readback confirms additive
behavior. From a zero baseline, `HueShiftDelta 1000000` and
`HueShiftDelta -1000000` read back verbatim as final
`Master.HueShift` values.

Parameters:
- delta (number): hue-shift delta in degrees.

Example:

    HueShiftDelta 5 // add 5° to current shift
    HueShiftDelta -360 // back-rotate one full turn

Safety: T2: visible color change.

Related: `HueShift`.

### Saturation

Signature: `Saturation <value>`

Set the LiveControl saturation OFFSET. BEYOND documentation: "Sets saturation level of the current Live Control.
Saturation is not direct value. In Live Control it works as an
offset. Incoming color transformed to HSV, modified and transformed
back."

**Verified 2026-05-06**: writes `Master.Saturation`. **Saturation is
signed** - range `[-100, 100]` with silent clamp on both ends.
0 = no change (reset offset), negative = desaturate toward grey,
positive = saturate further.

Parameters:
- value (number, -100..100): saturation offset. Out-of-range values
 silently clamp.

Example:

    Saturation 0 // no change (reset offset)
    Saturation 50 // boost saturation
    Saturation -100 // fully desaturate to greyscale

Safety: T2 - visible color change.

Related: `SaturationDelta`, `Hue`, `HueShift`.

### SaturationDelta

Signature: `SaturationDelta <delta>`

Relative version of `Saturation`. **Verified 2026-05-06**: applied to
a baseline of 40 with a delta of 10, result was 50 (additive). Final
value clamps to `Master.Saturation` range `[-100, 100]`.

Parameters:
- delta (number): saturation delta.

Example:

    SaturationDelta 10 // increase saturation
    SaturationDelta -25 // decrease saturation

Safety: T2 - visible color change.

Related: `Saturation`.

## Beam brush

Laser line width - the beam-shape control on the LiveControl panel.
Sister command pair to the Hue / Saturation / StrobeSpeed pairs.

### SizeIndex

Signature: `SizeIndex <axis>, <value>`

Per-axis setter using a numeric axis index instead of a named command.
Runtime probes confirm 0-based axes: 0 = X, 1 = Y, 2 = Z, matching
`PositionIndex` and `RGBA`. Value is absolute, not a delta.
Out-of-range axes are silently dropped.

The documented normal-use range is 0..400. A 2026-05-12 MCP write/read
probe of `Master.SizeX` confirmed `SizeIndex 0, -0.001`, `-1`, `-100`,
and `-400` store those negative values, while `-401` clamps to `-400`.
The positive side stores `400` and clamps `401` to `400`. Readback proves
storage only; it does not prove whether negative size mirrors or inverts
rendered output.

Parameters:
- axis (integer, 0..2): **0 = X, 1 = Y, 2 = Z**.
- value (number, nominal 0..400): size percent for that axis. Absolute.
 Runtime readback stores -400..400 and clamps outside that span.

Example:

    SizeIndex 0, 50 // SizeX = 50%
    SizeIndex 2, 200 // SizeZ = 200%

Safety: T2: visible scale change.

Related: `Size`, `SizeX`, `SizeY`, `SizeZ`, `PositionIndex`.

## Zoom

### StrobeSpeed

Signature: `StrobeSpeed <value>`

Set the strobe rate in flickers per second. BEYOND documentation BEYOND documentation: "Command sets the strobe of the current Live
Control." documentation example: `StrobeSpeed 0.2` (period, flickers per
second).

**Verified 2026-05-06**: writes `Master.StrobeSpeed`, range
`[0, 100]` with silent clamp on both ends. 0 = no strobe (default).

Parameters:
- value (number, 0..100): flickers per second. 0 = no strobe.
 Out-of-range silently clamps.

Example:

    StrobeSpeed 0 // no strobe
    StrobeSpeed 0.2
    StrobeSpeed 5 // 5 flickers/sec

Safety: T2 - visible flicker effect.

Related: `StrobeSpeedDelta`.
