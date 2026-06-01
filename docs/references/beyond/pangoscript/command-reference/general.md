---
category: General
order: 1
---
# General

General commands cover the broadest BEYOND controls: laser output enable/disable, blackout, master pause, display helpers (popups, previews, HTML browser), show-level messaging, and clipboard capture. These commands operate across all BEYOND surfaces and are accessible from any PangoScript context. Output-activating commands (BlackOut, EnableLaserOutput) are T3-tier and require operator supervision.

## Commands

### BlackOut

Signature: `BlackOut`

Activate BEYOND's system-wide blackout. Per Pangolin Wiki: "System
wide reset. Has most impact when laser output enabled." Used as the
operator-visible "kill the lasers" button.

**This command is complex** per the Wiki - "do not use inside
loops." Use it as a one-shot reaction (e.g. operator MIDI button,
trigger handler), not as a recurring tick.

`StopOnBlackout` (see [code.md](./code.md#stoponblackout))
controls whether BEYOND also halts the calling script when blackout
is activated; default is "keep running."

Example:

    BlackOut

Safety: T3 - system-wide reset; affects every cue, zone, and
projector. The Wiki framing ("system wide reset") suggests this is
heavier than just stopping output - it also resets internal state
that downstream scripts may depend on.

Property mapping: no stable Object Tree blackout-state property is
published. A runtime probe after `EnableLaserOutput` confirmed that
`BlackOut` does not write `Status.LaserEnabled`.

Related: `EnableLaserOutput`, `DisableLaserOutput`,
`StopOnBlackout`.

## Output capture

### EnableLaserOutput

Signature: `EnableLaserOutput`

Switch BEYOND into laser output (streaming) mode. Per Pangolin Wiki:
"Enable Laser Output. This command change internal mode of BEYOND
to streaming."

**Two operational gotchas** the Wiki calls out:

1. **License confirmation may be required** before output starts.
 Scripts that assume immediate streaming after the call may run
 for some real time before output actually flows.
2. **Autostart-style execution may be too early.** Scripts that
 `EnableLaserOutput` from `Autostart` can fire before BEYOND has
 finished its boot sequence; the call may be a no-op in that case.
 Defer or retry inside an `Autostart` script if you depend on
 output being on.

Example:

    EnableLaserOutput

Safety: T3 - turns laser hardware on. Operator supervision
required; do not invoke from a script that can run unattended unless
the show context explicitly requires it.

Property mapping: runtime readback confirmed this writes
`Status.LaserEnabled` to `1`. The probe was run with no laser
controller connected and restored with `DisableLaserOutput`.

Related: `DisableLaserOutput`, `BlackOut`.

### DisableLaserOutput

Signature: `DisableLaserOutput`

Switch BEYOND out of streaming mode and stop laser output. Per
Pangolin Wiki: "Disable Laser Output. This command change internal
mode of BEYOND and stop output."

**This command is slow** per the Wiki - avoid calling it in tight
loops or as a frequent reaction handler. Use `BlackOut` for "stop
output now" cases where you want to keep streaming-mode state
intact.

Example:

    DisableLaserOutput

Safety: T3 - direct laser-output state change.

Property mapping: runtime readback confirmed this writes
`Status.LaserEnabled` to `0` after `EnableLaserOutput`.

Related: `EnableLaserOutput`, `BlackOut`.

### MasterPause

Signature: `MasterPause <state>`

Pause or resume master playback. **System-wide** per Pangolin Wiki
(entry 0053): "affects both laser and audio outputs." Mirror of the
"Pause" button on BEYOND's main toolbar.

the `state` argument accepts `ON`, `OFF`,
`TOGGLE` constants in addition to numeric `0` / `1` / `2`. Reads
back as `Master.Pause` (0 = not paused, 1 = paused).

Parameters:
- state (integer | constant, 0..2): 0 = OFF (resume), 1 = ON
 (pause), 2 = TOGGLE.

Example:

    MasterPause ON
    MasterPause Toggle
    MasterPause 1 // equivalent to ON

Safety: T2 - system-wide pause; affects audio as well as laser
playback.

Related: `MasterPauseTime`, `MasterSpeed`, `BlackOut` (see
[general.md](./general.md#blackout)).

### AddSms

Signature: `AddSms`

Add an SMS message to the ShowItNow queue. The export shows no
parameters in the example signature, suggesting either: the
message is queued from a separately-configured source, or the
command has implicit-string semantics not documented in the
export. Behavior unverified.

Example:

    AddSms

Safety: T1 - modifies SMS queue; doesn't display until shown.

Related: `ShowItNowSMS`.

### CaptureToClipboard

Signature: `CaptureToClipboard`

Capture the current preview-window output frame and place it on the
system clipboard as an image. Useful for quick visual diff of show
state during script development.

Example:

    CaptureToClipboard

Safety: T1 - read-only capture; affects only the system clipboard.

## Projector selection and focus

These commands manage which projector(s) are **selected** in the UI
(the highlighted set that subsequent operator actions act on) and
which projector currently has UI **focus**. They don't directly
change laser output - they change UI state - so they're T1.

### Chat

Signature: `Chat "<text>"` (1 overload, documentation entry)

**Status: prototype, T0, do not use.**

documentation says verbatim: "Prototype stage command. Under construction.
Do not use."

## HTTP-only blob loaders (internal, T4)

These two commands are part of BEYOND's HTTP integration layer for
loading workspace content from in-memory binary blobs. The documentation
says explicitly that PangoScript callers should not use them.

### DisplayPopup

Signature: `DisplayPopup "<message>"`
Signature: `DisplayPopup <expression>`

Display a notification popup in the BEYOND UI. The popup auto-dismisses
after a few seconds.

Parameters:
- message (string) **or** expression (numeric/string): text or value
 to show.

Example:

    DisplayPopup "It works"
    DisplayPopup Dmx(10) // show value of 10th DMX channel
    var b
    b = Master.Brightness
    DisplayPopup b // show numeric value

Safety: T1 - UI popup only.

Related: `DisplayPopupOnTop`, `QLog`, `WriteLn`.

### DisplayPopupOnTop

Signature: `DisplayPopupOnTop "<message>"`
Signature: `DisplayPopupOnTop <expression>`

Same as `DisplayPopup` but the popup stays above other application
windows - useful when BEYOND isn't the focused window during
development.

Parameters:
- message (string) **or** expression (numeric/string): text or value
 to show.

Example:

    DisplayPopupOnTop "Trigger fired"

Safety: T1 - UI popup only.

Related: `DisplayPopup`.

## Preview panel

### DisplayPreview

Signature: `DisplayPreview <expression>`
Signature: `DisplayPreview <expression>, <color>`

Display a value in the Preview panel as an overlay. Replaces any
previous `DisplayPreview` content. Useful for showing live counter
values, current property reads, or debug labels without filling
the QLog tab.

Per the BEYOND export example, the second form takes a color value
(e.g. `0x0000ff` for blue), an RGB color literal.

Parameters:
- expression (numeric/string): text or value to show.
- color (integer, optional): packed RGB integer. Hex literals are
 documented, e.g. `0x0000ff`; accepted numeric bounds are not
 readback-confirmed.

Example:

    var counter
    DisplayPreview counter // current value, default color
    DisplayPreview "Hello world!", 0x0000ff // blue text overlay

Evidence note: local docs document RGB integer and hex-literal use.
No Preview overlay readback path was found for stored text color or
out-of-range behavior. Transmission through Talk UDP is not treated
as accepted-range proof.

Safety: T1: preview panel overlay only.

Related: `DisplayPopup`, `QLog`.

## Log tab

### HtmlBody

Signature: `HtmlBody "<html>"`

Set the body section of the Guide window's HTML document. Per
Pangolin Wiki (entry 1304): "Sets the HTML body content for the
Guide window viewer component. This command accepts an HTML string
that defines the body section of the displayed document."

Note: same export-documentation gap as `HtmlHead` - the export
signature omits the string parameter.

Parameters:
- html (string): HTML markup for the document `<body>` section.

Example:

    HtmlBody "<body><h1>Show in progress</h1><p>Cue 4 of 12</p></body></html>"
    HtmlUpdate

Safety: T2 - writes Guide window content; no laser-output effect.

Related: `HtmlClearBody`, `HtmlHead`, `HtmlUpdate`.

## Clearing content

### HtmlClearBody

Signature: `HtmlClearBody`

Reset the document body string to empty. Per Pangolin Wiki (entry
1303).

Example:

    HtmlClearBody
    HtmlBody "<body><p>Status reset</p></body></html>"
    HtmlUpdate

Safety: T2 - writes Guide window content state; visible after
`HtmlUpdate`.

Related: `HtmlBody`, `HtmlClearHead`.

## Render and visibility

### HtmlClearHead

Signature: `HtmlClearHead`

Reset the document head string to empty. Per Pangolin Wiki (entry
1301).

Example:

    HtmlClearHead
    HtmlHead "<html><head><title>New Title</title></head>"
    HtmlUpdate

Safety: T2 - writes Guide window content state; visible after
`HtmlUpdate`.

Related: `HtmlHead`, `HtmlClearBody`.

### HtmlHead

Signature: `HtmlHead "<html>"`

Set the head section of the Guide window's HTML document. Per
Pangolin Wiki (entry 1302): "Establishes the header string for the
Guide window HTML document."

Note: the BEYOND export's example signature shows `HtmlHead` with
no parameter - the wiki clarifies it takes a string argument
(`htmlhead(string param1)`). Export documentation is incomplete.

Parameters:
- html (string): HTML markup for the document `<head>` section
 (title, styles, meta tags).

Example:

    HtmlHead "<html><head><title>Status</title><style>body { font: 14px sans-serif }</style></head>"
    HtmlUpdate

Safety: T2 - writes Guide window content; no laser-output effect.

Related: `HtmlClearHead`, `HtmlBody`, `HtmlUpdate`.

### HtmlHide

Signature: `HtmlHide`

Close the Guide window. Per Pangolin Wiki (entry 1306): "Closes
the HTML Viewer window."

To re-open, the head/body strings persist in script state - call
`HtmlUpdate` after `HtmlHide` to confirm whether re-rendering
re-opens the window automatically. (Behavior unverified - 
operationally the viewer may need to be re-opened from BEYOND's UI
or via a separate "show" command.)

Example:

    HtmlHide

Safety: T2 - changes Guide window visibility; doesn't clear content.

Related: `HtmlUpdate`.

### HtmlUpdate

Signature: `HtmlUpdate`

**Refresh the Guide window to reflect the current head + body
strings.** Per Pangolin Wiki (entry 1305): "Must be called after
modifying HtmlHead or HtmlBody content to render changes in the
window."

Without `HtmlUpdate`, modifications to the head/body strings stay
in the script's buffered state and don't appear in the viewer.

Example:

    HtmlBody "<body><p>Frame 1</p></body></html>"
    HtmlUpdate // viewer now shows "Frame 1"
    HtmlBody "<body><p>Frame 2</p></body></html>"
    HtmlUpdate // viewer now shows "Frame 2"

Safety: T2 - renders the buffered Guide window content.

Related: `HtmlHead`, `HtmlBody`.

### LogError

Signature: `LogError "<message>"`

Append an error-level message to the QLog tab. Per BEYOND export
example: `LogError "My message to QLog tab"`.

Parameters:
- message (string): error text.

Example:

    LogError "Failed to load cue file"

Safety: T0 - log append only.

Related: `LogWarning`, `LogInfo`, `QLog`.

### LogInfo

Signature: `LogInfo "<message>"`

Append an informational message to the QLog tab.

Parameters:
- message (string): info text.

Example:

    LogInfo "Show started"

Safety: T0 - log append only.

Related: `LogError`, `LogWarning`, `QLog`.

## Connectivity ping

### LogWarning

Signature: `LogWarning "<message>"`

Append a warning-level message to the QLog tab.

Parameters:
- message (string): warning text.

Example:

    LogWarning "Beat detection threshold low"

Safety: T0 - log append only.

Related: `LogError`, `LogInfo`, `QLog`.

### MasterAudioVolume

Signature: `MasterAudioVolume <percent>`

Set the master audio volume in percent. **Verified 2026-05-06**:
writes `Master.AudioVolume`. Range `[0, 100]`; values < 0 silently
clamp to 0; values > 100 silently clamp to 100. BEYOND's audio
output level only - does not affect laser output, and is independent
of the analyzed audio input controlled by `SetAudioInGain` /
`SetAudioInRelease` (see [general.md](./general.md)).

Parameters:
- percent (integer, 0..100): audio volume; 100 = full. Out-of-range
 values silently clamp.

Example:

    MasterAudioVolume 80
    MasterAudioVolume 1000 // clamps to 100
    MasterAudioVolume -50 // clamps to 0

Safety: T1 - audio output only; no laser-output effect.

Related: `MasterAudioVolumeMute`.

### MasterAudioVolumeMute

Signature: `MasterAudioVolumeMute <state>`

Mute or unmute the master audio output. **Verified 2026-05-06**:
writes `Master.AudioVolumeMute`. Numeric values follow BEYOND's
standard checkbox convention (0 = Off / unmute, 1 = On / mute,
2 = Toggle). Symbolic tokens `OFF` / `ON` / `TOGGLE` also accepted
(case-insensitive - both upper and lowercase forms work). Toggle
verified to actually flip current state (0 → 1 → 0).

**Out-of-range values silently no-op (state preserved)** - values
like `3`, `999`, `-1`, `100` do NOT clamp the state to 0; they
leave whatever the current state is unchanged. This differs from
some other checkbox commands and is worth noting if you write
defensive code that assumes OOR forces a known state.

Parameters:
- state (integer, 0..2): 0 = Off (unmute), 1 = On (mute), 2 = Toggle.
 Symbolic OFF/ON/TOGGLE also accepted (case-insensitive).
 Out-of-range values silently no-op.

Example:

    MasterAudioVolumeMute 1 // mute
    MasterAudioVolumeMute ON // mute (symbolic)
    MasterAudioVolumeMute 2 // toggle (numeric)
    MasterAudioVolumeMute toggle // toggle (symbolic, lowercase)
    MasterAudioVolumeMute 999 // silently no-op; state unchanged

Safety: T1 - audio mute only.

Related: `MasterAudioVolume`.

## Timing shift

These commands shift BEYOND's internal clock or metronome reference
by a fixed offset. Useful for syncing to an external time source
that's running ahead/behind.

**Verified write targets (2026-05-06)**: the writable paths differ
from the obvious `Master.ClockShift` and `Master.MetroShift` names.
Those properties are not exposed as durable readback paths. Runtime
readback shows these targets:

| Command | Real readback path | Unit (input → stored) |
| --- | --- | --- |
| `MasterClockShift` | `Master.CueClockShift` | seconds → seconds |
| `MasterMetroShift` | `Master.CueBeatShift` | beats → beats |
| `MasterShowShift` | `Master.ShowShift` | ms → seconds (÷1000) |
| `MasterEffectClockShift` | `Master.MasterEffectClockShift` (doubly-prefixed!) | seconds → seconds |
| `MasterEffectMetroShift` | `Master.MasterEffectMetroShift` (doubly-prefixed!) | beats → beats |

**Naming inconsistency warning**: Pangolin uses three different
conventions in this 5-command family:
- `MasterClockShift` writes `Master.CueClockShift` (drops "Master",
 adds "Cue")
- `MasterMetroShift` writes `Master.CueBeatShift` (drops "Master",
 swaps "Metro" for "Beat", adds "Cue")
- `MasterShowShift` writes `Master.ShowShift` (drops "Master")
- `MasterEffectClockShift` and `MasterEffectMetroShift` write to
 doubly-prefixed `Master.MasterEffect*Shift` paths

When writing scripts that round-trip values, double-check the
exact readback path for the command in use.

### MasterClockShift

Signature: `MasterClockShift <seconds>`

Shift the master clock timing by `seconds`. Writes
`Master.CueClockShift`, not `Master.ClockShift`.

Runtime note (2026-05-11): this is an absolute setter, not a
relative shift. `MasterClockShift 7` followed by `MasterClockShift 2`
read back `2`. Inputs `-3.5` and `10000` passed through verbatim.
Use `0` to clear the shift.

Parameters:
- seconds (number): shift in seconds (positive = ahead, negative
 = behind). Stored verbatim on `Master.CueClockShift`.

Example:

    MasterClockShift 0 // no shift
    MasterClockShift 0.05 // 50 ms ahead

Safety: T2: affects global timing reference.

Related: `MasterMetroShift`, `MasterShowShift`,
`MasterEffectClockShift`.

### MasterCueLcSpeed

Signature: `MasterCueLcSpeed <percent>`

LiveControl-style cue playback speed, in percent. Distinct from
`MasterCueSpeed` (which scales cue playback timing); this one scales
the LiveControl-modulated cue speed. The naming overlap with
`MasterLCSpeed` is unfortunate: different scopes.

Runtime note (2026-05-11): reads back as
`Master.CueLcSpeed = input / 100`. Inputs `0`, `9999`, and `-1`
were accepted and stored as `0`, `99.98999786376952`, and
`-0.009999999776482582`.

Parameters:
- percent (integer): LC-style cue speed input percent. 100 = normal.

Example:

    MasterCueLcSpeed 100

Safety: T2: global LC cue speed change.

Related: `MasterCueSpeed`, `MasterLCSpeed`.

### MasterCueSpeed

Signature: `MasterCueSpeed <percent>`

Master cue playback speed multiplier. **Input is in percent, where
100 = normal speed.** Reads back as `Master.CueSpeed = input / 100`.

Runtime note (2026-05-11): input `22` read back
`0.2199999988079071`, input `0` read back `0`, input `9999` read
back `99.98999786376952`, and input `-1` read back
`-0.009999999776482582`. Input `100` restored normal speed.

Parameters:
- percent (number): cue speed input percent. 100 = normal.

Example:

    MasterCueSpeed 100 // normal speed
    MasterCueSpeed 50 // half speed cue playback

Safety: T2: global cue speed change.

Related: `MasterCueLcSpeed`, `MasterSpeed`.

### MasterEffectClockShift

Signature: `MasterEffectClockShift <seconds>`

Shift the **effect** clock timing, separate from `MasterClockShift`.
Writes the doubly-prefixed `Master.MasterEffectClockShift` path.

Runtime note (2026-05-11): this is an absolute setter, not a
relative shift. `MasterEffectClockShift 7` followed by
`MasterEffectClockShift 2` read back `2`. Inputs `-3.5` and
`10000` passed through verbatim. Use `0` to clear the shift.

Parameters:
- seconds (number): shift in seconds (positive = ahead, negative
 = behind). 0 clears the shift.

Example:

    MasterEffectClockShift 0
    MasterEffectClockShift 0.05 // 50 ms ahead

Safety: T2: affects effect-system timing.

Related: `MasterClockShift`, `MasterEffectMetroShift`.

### MasterEffectMetroShift

Signature: `MasterEffectMetroShift <beats>`

Shift the **effect** metronome timing (separate from
`MasterMetroShift`). Writes the doubly-prefixed
`Master.MasterEffectMetroShift` path.

Runtime note (2026-05-11): this is an absolute setter, not a
relative shift. `MasterEffectMetroShift 5` followed by
`MasterEffectMetroShift 2` read back `2`. Inputs `-2.5` and
`10000` passed through verbatim. Use `0` to clear the shift.

Parameters:
- beats (number): shift in beats. 0 clears the shift.

Example:

    MasterEffectMetroShift 0
    MasterEffectMetroShift 0.5 // half-beat ahead

Safety: T2: affects effect-metronome timing.

Related: `MasterMetroShift`, `MasterEffectClockShift`.

### MasterFXSpeed

Signature: `MasterFXSpeed <percent>`

Set the master FX speed multiplier as a percentage. `100` = normal
speed.

Runtime note (2026-05-11): reads back as
`Master.FXSpeed = input / 100`. Inputs `0`, `9999`, and `-1`
were accepted and stored as `0`, `99.98999786376952`, and
`-0.009999999776482582`.

Parameters:
- percent (number): FX speed input percent. 100 = normal.

Example:

    MasterFXSpeed 50 // FX run at half speed
    MasterFXSpeed 100 // normal speed

Safety: T2: global speed change across all FX layers.

Related: `MasterZoneFxSpeed`, `MasterSpeed`.

### MasterLCSpeed

Signature: `MasterLCSpeed <percent>`

Global LiveControl playback speed multiplier. **Input is in percent,
where 100 = normal speed.** Reads back as
`Master.LCSpeed = input / 100`.

Runtime note (2026-05-11): input `44` read back
`0.4399999976158142`, input `0` read back `0`, input `9999` read
back `99.98999786376952`, and input `-1` read back
`-0.009999999776482582`. Input `100` restored normal speed.

Parameters:
- percent (number): LiveControl speed input percent. 100 = normal.

Example:

    MasterLCSpeed 100 // normal LC speed
    MasterLCSpeed 200 // 2x normal

Safety: T2: global LC speed change.

Related: `MasterCueLcSpeed`, `MasterSpeed`.

## Transport (pause / transition)

### MasterMetroShift

Signature: `MasterMetroShift <beats>`

Shift the master metronome timing by `beats`. Writes
`Master.CueBeatShift`, not `Master.MetroShift`.

Runtime note (2026-05-11): this is an absolute setter, not a
relative shift. `MasterMetroShift 7` followed by
`MasterMetroShift 2` read back `2`. Inputs `-2.5` and `10000`
passed through verbatim. Use `0` to clear the shift.

Parameters:
- beats (number): shift in beats (positive = ahead, negative
 = behind). Stored verbatim on `Master.CueBeatShift`.

Example:

    MasterMetroShift 0
    MasterMetroShift 0.25 // quarter beat ahead

Safety: T2: affects global metronome reference.

Related: `MasterClockShift`, `MasterEffectMetroShift`,
`SetBpm` (see [beat-timer.md](./beat-timer.md#setbpm)).

### MasterPauseTime

Signature: `MasterPauseTime <ms>`

Set the master pause duration in milliseconds. Used in conjunction
with `MasterPause` for timed pauses.

Runtime note (2026-05-11): runtime clamps to `0..5000`.
`MasterPauseTime -1` read back `0`; `5000` read back `5000`;
`5001` and `10000000` both read back `5000`.

Parameters:
- ms (integer, 0..5000): pause duration in milliseconds.

Example:

    MasterPauseTime 1000 // 1-second pause

Safety: T2: sets pause-duration parameter.

Related: `MasterPause`.

### MasterShowBrightness

Signature: `MasterShowBrightness <percent>`

Show-level master brightness in percent. **Caps every laser-output
value** that flows through the show, effectively a global brightness
limiter. Reads back as `Master.ShowBrightness`.

The documented normal-use range is 0..100. A 2026-05-12 MCP write/read
probe of `Master.ShowBrightness` stored `-1000`, `0`, `100`, `1000`,
`10000`, `100000`, and `1000000` verbatim, with no practical clamp found
in that tested span. This readback is runtime evidence; PangoLint lint
acceptance was not treated as proof. This differs from `Brightness`,
which clamps the routed Live Control value to 0..100.

Although classified T2 here, in practice this command behaves
similarly to a global limiter: lowering it clamps live laser output
across every fixture. Treat reductions cautiously.

Parameters:
- percent (number, nominal 0..100): show brightness percent. 100 = full,
 0 = blackout in normal use. Runtime readback stores out-of-range values
 verbatim through the tested span -1000..1000000.

Example:

    MasterShowBrightness 100 // full
    MasterShowBrightness 50 // half-bright across the show

Safety: T2: global brightness cap; lowering directly reduces visible
laser output. Tier-bumping note: closer to T3 in practice.

Related: `SetLimiterDMX` (see
[dynamics-limiters.md](./dynamics-limiters.md#setlimiterdmx)),
`MuteAllZones` (see [projection-zone.md](./projection-zone.md#muteallzones)).

## Audio

### MasterShowShift

Signature: `MasterShowShift <ms>`

Shift the master show timing by `ms` milliseconds. Writes
`Master.ShowShift`, with **ms-to-seconds conversion**: the input is
in milliseconds but the stored property holds seconds.

Runtime note (2026-05-11): this is an absolute setter, not a
relative shift. `MasterShowShift 1000` followed by
`MasterShowShift 500` read back `0.5`, not `1.5`. Inputs `-250`
and `100000` passed through after conversion, reading back `-0.25`
and `100`. Use `0` to clear the shift.

Parameters:
- ms (number): shift in milliseconds. Stored as
 `Master.ShowShift = ms / 1000` (in seconds).

Example:

    MasterShowShift 0
    MasterShowShift 100 // 100 ms ahead, Master.ShowShift = 0.1

Safety: T2: affects show timeline reference.

Related: `MasterClockShift`, `MasterShowSpeed`.

### MasterShowSpeed

Signature: `MasterShowSpeed <percent>`

Show timeline speed multiplier (Timeline / PlayList mode). **Input
is in percent, where 100 = normal speed.** Reads back as
`Master.ShowSpeed = input ÷ 100`.

Verified scaling at runtime in BEYOND 2030:

| Input | Stored (`Master.ShowSpeed`) |
| ----- | --------------------------- |
| 50 | 0.5 (half speed) |
| 100 | 1.0 (normal - default) |
| 1000 | 10.0 (10× normal) |
| 9999 | 99.99 |

No upper cap observed up to 9999. Both the documentation "0..1"
and the Wiki's "0..10" ranges describe the *stored fractional*
value, not the input - actual input is in percent and scales to
the stored fractional via input ÷ 100. Same scaling verified for
`MasterCueSpeed`, `MasterLCSpeed`, and `MasterFXSpeed` in the same
probe (likely uniform across the per-target Master*Speed family).

Parameters:
- percent (number, 0..9999): show timeline speed in percent.
 100 = normal; 50 = half; 1000 = 10× normal.

Example:

    MasterShowSpeed 100 // normal speed (default)
    MasterShowSpeed 50 // half speed
    MasterShowSpeed 200 // 2× normal

Safety: T2 - global timeline speed change.

Related: `MasterSpeed` (no-op in current BEYOND, see above),
`MasterShowShift`.

### MasterSpeed

Signature: `MasterSpeed <ratio>`

Global speed multiplier for Grid-mode players, per Pangolin Wiki
(entry 0112).

Runtime probes found no observable exposed property effect. Older
probes checked input values {0.5, 1, 5, 10, 50, 100}, both with no
active cue and with a cue running, against all 12 Master.*Speed
properties exposed by the BEYOND object tree. A fresh 2026-05-11
MCP probe checked `MasterSpeed 0`, `50`, `100`, `9999`, and `-1`;
`Master.ShowSpeed`, `Master.FXSpeed`, `Master.CueSpeed`,
`Master.CueLcSpeed`, `Master.LCSpeed`, `Master.ZoneFxSpeed`,
`Master.AnimationSpeed`, `Master.LCScrollSpeed`,
`Master.StrobeSpeed`, and `Master.RotoSpeedX/Y/Z` stayed unchanged.

`MasterSpeed` appears to be either a no-op in current builds or an
internal-only writer with no PangoScript-readable surface. The
documented/Wiki range debate (0..1 vs 0..10) cannot be resolved
without a readback path.

**Use the per-target alternatives instead**: see
[`MasterShowSpeed`](#mastershowspeed),
[`MasterCueSpeed`](#mastercuespeed),
[`MasterLCSpeed`](#masterlcspeed),
[`MasterFXSpeed`](./general.md#masterfxspeed), all of which have verified
input-percent semantics and `Master.<X>Speed` readback paths.

Parameters:
- ratio (number): speed multiplier per the docs. Current probes find
 no exposed property effect.

Example:

    MasterSpeed 1 // documented as "normal speed"; no-op in current BEYOND
    MasterShowSpeed 100 // verified working: 100% = normal show speed

Safety: T2: documented as a global speed change, but currently a
no-op.

Property mapping: no direct shipped Object Tree mapping. Runtime
readback found no change on the exposed `Master.*Speed` properties.

Related: `MasterShowSpeed`, `MasterCueSpeed`, `MasterLCSpeed`,
`MasterFXSpeed`, `MasterPause`.

### MasterTransition

Signature: `MasterTransition <state>`

Toggle or set the master transition state. Mirror of the "Transition"
button on BEYOND's main toolbar. When ON, BEYOND fades between cues
on cue change instead of cutting.

**Verified at runtime to be aliased with `Transition`** (toolbar-modes
section): both commands write the same `Master.TransitionState` flag.
PangoLint can suggest `MasterTransition` as the more explicit
parser-bound name for new scripts. ON/OFF/TOGGLE all behave identically
across both names.

Parameters:
- state (constant | integer): `ON`, `OFF`, `TOGGLE` (or numeric
 `0` / `1` / `2`).

Example:

    MasterTransition ON
    MasterTransition Toggle

Safety: T2: affects cue-transition behavior; visible during cue
changes.

Related: `Transition` (alias), `MasterTransitionIndex`,
`MasterTransitionTime`.

### MasterTransitionIndex

Signature: `MasterTransitionIndex <index>`

Select the master transition preset by index. Reads back as
`Master.TransitionIndex`. Runtime readback on 2026-05-11 confirmed
that both `MasterTransitionIndex` and `SetTransitionIndex` clamp values
to `0..24`.

Parameters:
- index (integer): transition preset index, range `0..24`.
 Inputs below 0 clamp to 0; inputs above 24 clamp to 24.

Example:

    MasterTransitionIndex 2

Safety: T2: sets transition preset; takes effect on next cue
change.

Related: `MasterTransition`, `MasterTransitionTime`.

### MasterTransitionTime

Signature: `MasterTransitionTime <seconds>`

Set the master transition duration. Per the BEYOND export example
(`MasterTransitionTime 0.1`), the parameter is fractional seconds.
No readable `Master.TransitionTime` style property is known, so the
stored value and clamp behavior are not currently observable through
Object Tree readback. Representative writes for `-1`, `0`, `0.5`, `2`,
and `10000` were transmitted without PangoLint errors, then reset to
`0.1`.

Parameters:
- seconds (number): transition duration in seconds. Range evidence is
 unverified because no direct readback path exposes the stored duration.

Example:

    MasterTransitionTime 0.5 // 500ms transition

Safety: T2: affects transition duration; visible on next cue
change.

Property mapping: no direct shipped Object Tree mapping is known.
This is treated as a hidden transition-duration setter unless a future
readback surface is identified.

Related: `MasterTransition`, `MasterTransitionIndex`.

## Brightness

### MasterZoneFxSpeed

Signature: `MasterZoneFxSpeed <percent>`

Set the master FX speed multiplier scoped to zones (separate from
`MasterFXSpeed` which covers all FX). `100` = normal speed.

Runtime note (2026-05-11): reads back as
`Master.ZoneFxSpeed = input / 100`. Inputs `0`, `9999`, and `-1`
were accepted and stored as `0`, `99.98999786376952`, and
`-0.009999999776482582`.

Parameters:
- percent (number): zone FX speed input percent. 100 = normal.

Example:

    MasterZoneFxSpeed 100

Safety: T2: global zone FX speed change.

Related: `MasterFXSpeed`, `ResetZonesFX`.

### MeshCurve

Signature: `MeshCurve <pt1>, <pt2>, <pt3>`

Define a quad-spline curve through three previously-defined points
(by index). Per the BEYOND export comment: "quad-spline between
point 1, 2 and 3."

Parameters:
- pt1, pt2, pt3 (integer): 1-based indices of points previously
 declared via `MeshPoint`. Zero behavior and upper bound are
 unverified.

Example:

    MeshPoint 0, 0, 0, "A"
    MeshPoint 50, 100, 0, "B"
    MeshPoint 100, 0, 0, "C"
    MeshCurve 1, 2, 3 // quad-spline through A to B to C

Safety: T4: output mesh geometry write.

Property mapping: deferred. Mesh state accumulation and cleanup
semantics need a bounded T4 fixture before PangoLint publishes a
fixed target surface for this family.

Evidence note: runtime probing is blocked until an inactive-output
mesh fixture can prove the state model and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `MeshSpline`, `MeshPoint`.

### MeshPoint

Signature: `MeshPoint <x>, <y>, <z>, "<name>"`

Define a mesh point at the given 3D coordinates with a string name.
Per the BEYOND export example: `MeshPoint -100, -100, 0, "LeftBottom"`.

The numeric range is undocumented in the export. The example uses
`-100` and `100`, so the documented example is not normalized 0..1.
Accepted bounds and clamp behavior are unverified.

Parameters:
- x, y, z (number): 3D coordinates.
- name (string): point name (used as a label and likely as a
 reference for subsequent shape commands, though shape commands
 in this family appear to use numeric indices, not names; the role
 of `name` is unverified).

Example:

    MeshPoint -100, -100, 0, "LeftBottom"
    MeshPoint 100, -100, 0, "RightBottom"
    MeshPoint 100, 100, 0, "RightTop"
    MeshPoint -100, 100, 0, "LeftTop"

Safety: T4: output mesh geometry write.

Property mapping: deferred with the rest of the mesh family until a
bounded geometry fixture proves the stored state surface and restore
path.

Evidence note: runtime probing is blocked until an inactive-output
mesh fixture can prove the state model and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `MeshPointChan`, `MeshTriangle`, `MeshRect`.

### MeshPointChan

Signature: `MeshPointChan <a>, <b>, <c>`

Define a mesh point with a channel-style 3-arg shape. Per the
BEYOND export: `MeshPointChan 1, 0, 0`. The parameter semantics
aren't documented, likely (channel, X, Y) or (point-index, channel,
value), but unverified.

Parameters:
- a, b, c (number): three parameters. The export example uses
 `1, 0, 0`; semantics, coordinate space, and bounds are unverified.

Example:

    MeshPointChan 1, 0, 0

Safety: T4: output mesh geometry write.

Property mapping: deferred with the rest of the mesh family until a
bounded geometry fixture proves the stored state surface and restore
path.

Evidence note: runtime probing is blocked until an inactive-output
mesh fixture can prove the state model and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `MeshPoint`.

### MeshPolygon

Signature: `MeshPolygon <pt1>, <pt2>`

Define a polygon edge connecting two previously-defined points (by
index). Per the BEYOND export comment: "connect 1st and 2nd point."
Despite the "polygon" name, this is actually a single-edge primitive
where multiple `MeshPolygon` calls would build up a polyline by chaining
edges.

Parameters:
- pt1, pt2 (integer): 1-based indices of the two endpoint points.
 Zero behavior and upper bound are unverified.

Example:

    MeshPolygon 1, 2 // edge from point 1 to point 2

Safety: T4: output mesh geometry write.

Property mapping: deferred with the rest of the mesh family until a
bounded geometry fixture proves the stored state surface and restore
path.

Evidence note: runtime probing is blocked until an inactive-output
mesh fixture can prove the state model and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `MeshTriangle`, `MeshRect`.

## Zone warp grid

### MeshRect

Signature: `MeshRect <pt1>, <pt2>, <pt3>, <pt4>`

Define a rectangular mesh region from four previously-defined
points (by index).

Parameters:
- pt1..pt4 (integer): 1-based indices of the four corner points.
 Zero behavior and upper bound are unverified.

Example:

    MeshRect 1, 2, 3, 4 // rectangle from points 1-4

Safety: T4: output mesh geometry write.

Property mapping: deferred with the rest of the mesh family until a
bounded geometry fixture proves the stored state surface and restore
path.

Evidence note: runtime probing is blocked until an inactive-output
mesh fixture can prove the state model and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `MeshTriangle`, `MeshPolygon`.

### MeshSpline

Signature: `MeshSpline <base1>, <handle1>, <handle2>, <base2>`

Define a cubic-spline curve through four points. Per the BEYOND
export comment: "cubic-spline based on 4 points. 1,4 bases, 2,3
'handles'." So the curve runs base1 → base2 with handles 1 and 2
controlling the curvature (Bézier-style).

Parameters:
- base1 (integer): 1-based index of first base point.
- handle1 (integer): 1-based index of first handle point.
- handle2 (integer): 1-based index of second handle point.
- base2 (integer): 1-based index of second base point.

Zero behavior and upper bound are unverified for all point-index
parameters.

Example:

    MeshSpline 1, 2, 3, 4 // base1, handle1, handle2, base2

Safety: T4: output mesh geometry write.

Property mapping: deferred with the rest of the mesh family until a
bounded geometry fixture proves the stored state surface and restore
path.

Evidence note: runtime probing is blocked until an inactive-output
mesh fixture can prove the state model and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `MeshCurve`, `MeshPoint`.

### MeshTriangle

Signature: `MeshTriangle <pt1>, <pt2>, <pt3>`

Define a triangular mesh region from three previously-defined
points (by index).

Parameters:
- pt1, pt2, pt3 (integer): 1-based indices of the three corner
 points. Zero behavior and upper bound are unverified.

Example:

    MeshTriangle 1, 2, 3

Safety: T4: output mesh geometry write.

Property mapping: deferred with the rest of the mesh family until a
bounded geometry fixture proves the stored state surface and restore
path.

Evidence note: runtime probing is blocked until an inactive-output
mesh fixture can prove the state model and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `MeshRect`, `MeshPolygon`.

### MoboNotify

Signature: `MoboNotify "<message>"`

Send a notification to the connected **MoboLaser** mobile companion
app (Pangolin's iOS / Android remote-control app). Per BEYOND export
example: `MoboNotify "Hello!"`. **Verified 2026-05-06** with a
MoboLaser mobile app connected to BEYOND: the message is delivered
to the mobile device as an in-app notification, with in-order
delivery for multi-call sequences.

**Connection prerequisite.** A MoboLaser device must be paired and
connected to BEYOND (visible in BEYOND's notification panel as
"MOBOLASER: Mobile connected from (<beyond-host>:<mobile-port> <-
<mobile-ip>:<ephemeral-port>)") for messages to be received. **When no mobile
is connected, MoboNotify silently no-ops** - three sentinels sent
before the mobile app connected produced no observable destination.

Parameters:
- message (string): notification text. Delivered as-is to the
 connected MoboLaser app.

Example:

    MoboNotify "Show started"
    MoboNotify "Cue 1.1 fired"

Safety: T1 - sends an external event to a paired mobile device;
doesn't change BEYOND state or laser output. Useful for show
operators wanting one-way alerts from the show script to the
remote-control app.

## Command dispatch

### PreviewAsUninverse

Signature: `PreviewAsUninverse <state>`

Enable or disable display of the Universe page in the Main Preview
panel. The preferred command name is "PreviewAsUninverse" per the
BEYOND parser/export and command cache; the corrected spelling
`PreviewAsUniverse` is not documented as a command. Preserved here
so hover matches what BEYOND emits.

Per the BEYOND export example (`PreviewAsUninverse 1`), the command
takes a single integer parameter.

Parameters:
- state (integer, 0..1): 0 = classic preview modes, 1 = display
 Universe page in this panel.

Example:

    PreviewAsUninverse 1

Safety: T1 - preview rendering toggle only.

Property mapping: no direct shipped Object Tree mapping is known for
this preview-panel mode.

Related: `PreviewMaster`.

### PreviewMaster

Signature: `PreviewMaster`

Show master output in the preview window.

Example:

    PreviewMaster

Safety: T1 - preview window content only.

Property mapping: no direct shipped Object Tree mapping is known for
this preview-panel routing command.

Related: `PreviewNxN`, `PreviewAsUninverse`.

### PreviewNxN

Signature: `PreviewNxN <layout>`

Set the preview window's grid layout. Per the BEYOND export comment:
1 = single laser, 2 = 2x2, 3 = 3x3, 4 = 4x4, 11/12/13 = Custom 1/2/3.

Parameters:
- layout (integer): documented layout enum. Values are 1 = laser,
 2 = 2x2, 3 = 3x3, 4 = 4x4, 11 = Custom 1, 12 = Custom 2,
 13 = Custom 3. Out-of-range behavior is unverified.

Example:

    PreviewNxN 1 // single laser preview
    PreviewNxN 2 // 2x2 preview grid
    PreviewNxN 11 // Custom 1 layout

Evidence note: `PreviewNxN 1`, `2`, `3`, `4`, `11`, `12`, and
`13` match the BEYOND export enum. Representative values `0` and
`99` were transmitted during a supervised probe, but no readback
path exposed the selected layout or clamp behavior. Transmission
through Talk UDP is not treated as accepted-range proof.

Safety: T1: preview window layout only.

Property mapping: no direct shipped Object Tree mapping is known for
the selected preview layout.

Related: `PreviewMaster`, `PreviewZoneGrid`.

### PreviewZoneGrid

Signature: `PreviewZoneGrid`

Show the zone grid in the preview window - a per-zone tiled view
useful for diagnosing which zones are active.

Example:

    PreviewZoneGrid

Safety: T1 - preview window content only.

Related: `PreviewZoneMatrix`, `PreviewMaster`.

### PreviewZoneMatrix

Signature: `PreviewZoneMatrix <matrixIndex>`

Show a specific zone matrix in the preview. Per the BEYOND export
comment: 0 = default preview, 1..N = zone matrix index.

Parameters:
- matrixIndex (integer): 0 for default preview; 1..N for a zone
 matrix index. Upper bound and out-of-range behavior are unverified.

Example:

    PreviewZoneMatrix 0 // default preview
    PreviewZoneMatrix 1 // zone matrix 1

Evidence note: the BEYOND export documents `0` as default preview
and `1..N` as zone matrix indices. Representative value `99` was
transmitted during a supervised probe, but no readback path exposed
the selected matrix or clamp behavior. Transmission through Talk UDP
is not treated as accepted-range proof.

Safety: T1: preview window content only.

Related: `PreviewZoneGrid`.

## Dialogs

### PulseEvent

Signature: `PulseEvent "<eventName>"`
Signature: `PulseEvent "<eventName1>", "<eventName2>",...`

Fire one or more custom events. Any scripts currently suspended on
`WaitForEvent "<eventName>"` will resume.

"at least one name of the
event. It will reactivate the scripts that suspended by
WaitForEvent."

Parameters:
- eventName1..N (string, repeatable): one or more event names to
 pulse simultaneously.

Example:

    PulseEvent "FadeDone"
    PulseEvent "PhaseA", "PhaseB" // fire two events at once

Safety: T0 - pure flow control; no output or state change.

Related: `WaitForEvent` (see
[waiting-for-events.md](./waiting-for-events.md#waitforevent)),
`AnimateProp` finishEvent argument (see
[object-property-animation.md](./object-property-animation.md#animateprop)).

### QLog

Signature: `QLog <args>...`

Append a message to the **QLog** tab in BEYOND's UI. Useful for
debug output.

The QLog tab maintains a scrollback, so multiple `QLog` calls
accumulate. Recommended over `Write` / `WriteLn` for longer-running
scripts where you want a history.

Parameters:
- args (variadic): one or more string or numeric arguments,
 concatenated in the log line.

Example:

    QLog "trigger fired"
    QLog "counter=", counter
    QLog Master.Brightness

Safety: T0 - appends to log; no UI focus change, no laser-output
effect.

Related: `WriteLn`, `Write`, `DisplayPreview`.

## Output window

`Write` and `WriteLn` write to BEYOND's special output window - 
similar to QLog but a separate UI surface. The window is created on
first use.

### SetAudioGain

Signature: `SetAudioGain <level>`

Set the audio gain. Runtime verified alias for `SetAudioInGain`: both
write `Master.AudioInGain`. **Clamps to `[1, 15]`** (the documented
export range): `SetAudioGain 0` -> property = 1; `SetAudioGain 16` /
`100` / `1000` -> property = 15. Use this rather than
`SetAudioInGain` if you want the documented bounds enforced.

Parameters:
- level (integer, 1..15): gain level. Higher = more amplification.
 Out-of-range values silently clamp to `[1, 15]`.

Example:

    SetAudioGain 10 // mid-range default
    SetAudioGain 15 // maximum gain
    SetAudioGain 1000 // clamps to 15

Safety: T1: audio analysis configuration.

Related: `SetAudioInGain` (no-clamp variant), `SetAudioRelease`.

### SetAudioInGain

Signature: `SetAudioInGain <level>`

Set the audio-input gain. Writes the `Master.AudioInGain` property.
Per BEYOND export comment: "1 is min, 15 is max, 10 default."

The documented normal-use range is 1..15, but a 2026-05-12 MCP
write/read probe confirmed that `SetAudioInGain` does not enforce those
bounds. `-1000`, `-1`, `0`, `0.5`, `5.5`, `15`, `16`, `100`, `1000`,
and `100000` all read back verbatim from `Master.AudioInGain`. No
runtime clamp was found through `100000`. If you want the export's
`1..15` bounds enforced, use the non-`In` alias `SetAudioGain` instead.
This is BEYOND property readback evidence, not PangoLint lint
acceptance.

Parameters:
- level (number): input gain. Documented normal-use range `1..15`,
 default `10`. Runtime stores out-of-range values verbatim through the
 tested span `-1000..100000`.

Example:

    SetAudioInGain 10 // default
    SetAudioInGain 1 // documented minimum
    SetAudioInGain 15 // documented maximum
    SetAudioInGain 100 // accepted unchecked (no clamp)

Safety: T1: audio input configuration.

Related: `SetAudioGain` (clamps to 1..15), `SetAudioInRelease`.

### SetAudioInRelease

Signature: `SetAudioInRelease <time>`

Set the audio-input release time. Writes `Master.AudioInRelease`
(stored as float32). Per BEYOND export comment: "1 is min, 99 is
max (slowest) 75 is default."

The documented normal-use range is 1..99, but a 2026-05-12 MCP
write/read probe confirmed that `SetAudioInRelease` does not enforce
those bounds. `-1000`, `-1`, `0`, `45.5`, `99`, `100`, `1000`, and
`100000` read back verbatim from `Master.AudioInRelease`; `0.05` read
back as `0.05000000074505806` due to float32 storage. No runtime clamp
was found through `100000`. If you want the export's `1..99` bounds
(and the 0.1 floor that the non-`In` variant enforces) applied, use the
alias `SetAudioRelease` instead. This is BEYOND property readback
evidence, not PangoLint lint acceptance.

Parameters:
- time (number): release decay value. Documented normal-use range
 `1..99`, default `75`. Runtime stores out-of-range values through the
 tested span `-1000..100000`.

Example:

    SetAudioInRelease 75 // default
    SetAudioInRelease 1 // documented minimum
    SetAudioInRelease 99 // documented maximum (slowest)
    SetAudioInRelease 5000 // accepted unchecked (no clamp)

Safety: T1: audio input configuration.

Related: `SetAudioRelease` (clamps to 0.1..99), `SetAudioInGain`.

### SetAudioRelease

Signature: `SetAudioRelease <time>`

Set the audio release time. **Verified alias** for
`SetAudioInRelease` - both write `Master.AudioInRelease`.
**Clamps to `[0.1, 99]`**: `SetAudioRelease 0` → property = 0.1;
`SetAudioRelease 100` / `5000` → property = 99. The export comment
gives the range as `1..99`, but the actual lower bound is `0.1`,
not `1` - `SetAudioRelease 0` lands at 0.1, not 1, per OSC readback
on `Master.AudioInRelease` (stored as float32). Use this rather
than `SetAudioInRelease` if you want bounds enforced.

Parameters:
- time (integer, 0.1..99): release decay value. Out-of-range values
 silently clamp to `[0.1, 99]`. Higher = slower decay (longer hold).

Example:

    SetAudioRelease 75 // typical default
    SetAudioRelease 1 // documented minimum
    SetAudioRelease 99 // maximum (slowest)
    SetAudioRelease 5000 // clamps to 99

Safety: T1 - audio analysis configuration.

Related: `SetAudioInRelease` (no-clamp variant), `SetAudioGain`.

### SetLocation

Signature: `SetLocation <index>, <x>, <y>, <z>`

Set one of BEYOND's 256 location-preset position slots (1-based index, 1..256).
Input index is 1-based; readback is at `Location.<index-1>.X/Y/Z` (0-based).
Values out of range (257+) are silently dropped.
The underlying `Location.<N>.*` property tree exposes 1024 slots; indices 257..1024
require `SetProp "Location.<N>.X",...` directly.

**Status:** Prototype/unstable. BEYOND's documentation marks this command as
"Locations are at prototype phase. Please do not use this command, it may change
or might be removed." Use with caution.

**Safety tier:** T2 - writes show geometry; no live beam risk but changes are
persistent to the show file.

**Sources:** Runtime probe 2026-05-06.

### SetProp

Signature: `SetProp "<propertyPath>", <value>`

Universal property setter - writes any BEYOND property by string
path. Per BEYOND export example: `SetProp "Master.bpm", 123`.

For known properties, functionally equivalent to `Master.bpm = 123`
direct property assignment. Useful when the property name is built
dynamically (e.g. constructed from a variable) or when iterating over
a property family without writing N typed commands.

**Verified case-insensitive at runtime in BEYOND 2030.** All four
case variants of `Master.BPM` were tested (`Master.BPM`,
`Master.bpm`, `MASTER.bpm`, `master.bpm`); each successfully
updated `Master.BPM`. The export's lowercase `Master.bpm` is one
valid spelling among many.

**Verified silent no-op on unknown paths.** A `SetProp
"NotAProperty", 999` call after a known-good write left existing
properties untouched and produced no error popup or Talk-bus
diagnostic. Out-of-range and otherwise-invalid property paths
silently succeed at the parser level but do nothing at runtime - 
debug carefully when SetProp seems to have no effect (likely a
typo that the runtime swallowed).

This silent no-op behavior is specific to `SetProp`'s quoted string
property path form. Direct expression reads or assignments of unknown
properties are separate syntax and can be BEYOND editor errors; for
example, `badValue = Master.RotoAngeX` was rejected as an unknown
function / undeclared variable in the regression corpus.

The `value` argument is typeless - accepts integer, float, or
string depending on the target property's type.

Parameters:
- propertyPath (string): dotted property path (e.g.
 `"Master.bpm"`, `"Master.Brightness"`, `"Channels.0.Color"`).
 Case-insensitive. Unknown paths silently no-op in `SetProp` string
 path dispatch.
- value (any): value to assign - type must match the target
 property.

Example:

    SetProp "Master.bpm", 123 // export example
    SetProp "Master.Brightness", 0.5

    var prop // dynamic property name
    prop = "Master.FX" + n + "TimeMul"
    SetProp prop, 2

Safety: T2 (variable) - the dispatched property write carries its
own tier. Treat as if the equivalent typed command were inlined.

Related: `Master.<Property> = <value>` (direct assignment), every
typed setter that has a `Master.<Property>` readback (e.g.
`MasterBrightness`, `MasterShowBrightness`).

### SetRecordFile

Signature: `SetRecordFile "<path>"`

Set the output file path for the next `StartAudioRecord` or
`StartQuickRecord` call. Per the BEYOND export example, the path is
a Windows-absolute path with `.best` extension
(`"C:\BEYOND50\MyFile.best"`) - `.best` is BEYOND's recording
container format.

Parameters:
- path (string): absolute file path (Windows-style).

Example:

    SetRecordFile "C:\BEYOND50\MyFile.best"

Safety: T1 - file path setting only. The actual recording starts
on `StartAudioRecord` / `StartQuickRecord`.

Related: `StartAudioRecord`, `StartQuickRecord`.

### SetUiFPS

Signature: `SetUiFPS <fps>`

Set BEYOND's UI rendering frame rate. Per BEYOND export example:
`SetUiFPS 25`. Affects panel / window redraw frequency only, it does
**not** change laser output rate or scanner timing.

Use lower values (e.g. `15`, `25`) on resource-constrained hosts
to free CPU; higher values (e.g. `60`) for smoother UI on
workstations dedicated to BEYOND.

The documented default and export example are `25` FPS. Pangolin's
documentation suggests `50` or `60` for smoother design work, but
accepted bounds and clamp behavior are unverified.

Parameters:
- fps (integer): UI redraw frames per second. Accepted bounds are
 not readback-confirmed.

Example:

    SetUiFPS 25 // export example
    SetUiFPS 60 // smooth UI
    SetUiFPS 15 // lightweight UI for headless show machine

Evidence note: representative values `1`, `30`, `60`, and `0` were
transmitted during a supervised probe, followed by `SetUiFPS 25`.
No readback property exposed stored UI FPS or clamp behavior.
Transmission through Talk UDP is not treated as accepted-range proof.

Safety: T1: UI rendering only.

Related: `LinePerCycle`, `StartTvMode`.

### ShowHint

Signature: `ShowHint "<message>"`

Display a hint window in the center of BEYOND's main window. Per
the BEYOND export comment: "show hint window in center of main
window."

Distinct from `DisplayPopup` (auto-dismissing notification) and
`DisplayPopupOnTop` (top-pinned) - see
[general.md](./general.md#displaypopup) for the popup
family.

Parameters:
- message (string): hint text.

Example:

    ShowHint "Hello!"

Safety: T1 - UI dialog only.

Related: `DisplayPopup`, `DisplayPopupOnTop`.

### ShowItNowSMS

Signature: `ShowItNowSMS <state>`

Toggle the ShowItNow SMS overlay. The ShowItNow subsystem is
BEYOND's audience-message display feature (typically used at events
to surface SMS messages from the audience).

Note: the BEYOND export's example signature for this command reads
`ShowIsNowSMS 1` - a typo in Pangolin's export. The preferred
command name is `ShowItNowSMS` per the export's command-name
column.

Parameters:
- state (integer): 1 = show, 0 = hide (interpretation inferred
 from the example).

Example:

    ShowItNowSMS 1

Safety: T1 - UI overlay only.

Related: `AddSms`.

### ShowMasterHelpFile

Signature: `ShowMasterHelpFile`

Open BEYOND's master help file in the help viewer.

Example:

    ShowMasterHelpFile

Safety: T1 - opens a help-viewer window.

### ShutDownWindows

Signature: `ShutDownWindows`

Shut down the host Windows operating system. Per BEYOND export
comment: "require ShutDownWindows.exe application" - BEYOND does
not perform the shutdown itself; it shells out to a separate
`ShutDownWindows.exe` helper that must be installed alongside
BEYOND.

Effect: every running show stops, BEYOND closes, and Windows
begins its shutdown sequence. There is no in-band cancel.

Example:

    ShutDownWindows // terminate Windows

Safety: T4 - host OS shutdown. Terminates every running show; no
recovery without manual reboot. Reserve for end-of-show automation
on dedicated show-machines, never on a workstation handling other
work.

### StartAudioRecord

Signature: `StartAudioRecord`

Start capturing audio input to the file path set by `SetRecordFile`.
Continues until `StopAudioRecord` is called.

Example:

    SetRecordFile "C:\Shows\session1.best"
    StartAudioRecord
    //... show plays...
    StopAudioRecord

Safety: T1 - audio capture only; no laser-output effect.

Related: `StopAudioRecord`, `SetRecordFile`, `StartQuickRecord`.

### StartQuickRecord

Signature: `StartQuickRecord`

Start a "quick recording" capture. Per the BEYOND export this is
distinct from `StartAudioRecord` - Quick Recording captures
BEYOND's working output (laser frame data plus optional audio) for
later playback. Continues until `StopQuickRecord` is called.

Example:

    SetRecordFile "C:\Shows\quick.best"
    StartQuickRecord
    //... show plays...
    StopQuickRecord

Safety: T1 - capture only; no live laser-output effect.

Related: `StopQuickRecord`, `SetRecordFile`, `StartAudioRecord`.

### StopAudioRecord

Signature: `StopAudioRecord`

Stop the in-progress audio recording started by `StartAudioRecord`.

Example:

    StopAudioRecord

Safety: T1 - stops audio capture.

Related: `StartAudioRecord`.

### StopQuickRecord

Signature: `StopQuickRecord`

Stop the in-progress Quick Recording started by `StartQuickRecord`.

Example:

    StopQuickRecord

Safety: T1 - stops capture.

Related: `StartQuickRecord`.

## Timeline transport

These three commands drive Timeline mode (DAW-style sequence
playback). To switch BEYOND into Timeline mode, see
[tabs.md](./tabs.md#gotimelinemode).

### Write

Signature: `Write <args>...`

Append text to BEYOND's output window **without** a trailing newline.
Useful for building up a single log line in pieces.

Parameters:
- args (variadic): string or numeric arguments concatenated to the
 output.

Example:

    Write "value="
    Write counter
    WriteLn "" // close the line with a newline

Safety: T0 - output window only.

Related: `WriteLn`, `QLog`.

### WriteLn

Signature: `WriteLn <args>...`

Append text to BEYOND's output window **with** a trailing newline.
The everyday log call when you want one message per line.

Parameters:
- args (variadic): string or numeric arguments concatenated.

Example:

    WriteLn "Hello world!"
    WriteLn "counter=", counter

Safety: T0 - output window only.

Related: `Write`, `QLog`.
