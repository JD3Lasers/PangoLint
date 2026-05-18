---
category: Code
order: 15
---
# Code

Code commands manage PangoScript code objects: name them, assign keyboard shortcuts, apply color markers, and start or stop running code blocks from within other scripts. These commands interact with the Script/Code editor inside BEYOND.

## Commands

### Restart

Signature: `Restart`

Re-execute the current script from its first line and reset the
script-local clock to zero (relevant for `WaitForTimePos`).

This is the "loop forever" primitive for wait-driven handlers. For
finite counter/state loops that should keep local variables and resume
at a later label, use `if (<condition>) goto <label>` instead of
`Restart`.

PangoScript has no accepted `While` / `Repeat` block syntax, and
Delphi-style `For name = start To end` range syntax is rejected by the
BEYOND editor.

Example:

    WaitForHotkey
    DmxOut 1, 255
    Sleep 500
    DmxOut 1, 0
    Restart

Safety: T0 - script-only.

Related: `Exit`, `WaitForTimePos`, every `WaitFor*` command.

### Exit

Signature: `Exit`

Stop execution at this point in the script. The Pangolin Wiki frames
Exit as "an instruction to stop script execution. Typically used at
the end of script section, such as universe components, or a
triggers." Its most common use is **not** "abort early" - it's
**structural section separation** in trigger-driven and label-driven
scripts. PangoScript has no block delimiters, so without an explicit
`Exit`, execution would silently fall through from the setup section
into the body of the first labelled section below.

Use the bare command name (`exit` or `Exit`) with no trailing
semicolon. The BEYOND editor reports `Invalid expression` for `exit;`.
An omitted final `exit` can still parse and run in a single-section
script, but PangoLint recommends `Exit` as the fall-through guard for
production scripts.

Preferred idiom - trigger declarations at the top, an `Exit` to mark
the end of the setup section, then labelled handler sections that each
end with their own `Exit`:

 DefineMidiTrigger 0xB0, 0x00, "Brightness slider"
 InRangeTrigger 0, 63, "Low"
 InRangeTrigger 64, 127, "High"
 exit // stop fall-through into Low: below

 Low:
 DisableLaserOutput
 exit // stop fall-through into High:

 High:
 EnableLaserOutput
 exit

Same idea inside a `Goto` chain - every section terminates with `Exit`
so it doesn't run the next labelled section by accident:

 goto mylabel
 DisplayPopup "It does not work"
 exit // dead-code guard; also blocks fall-through

 mylabel:
 DisplayPopup "It works"

Use Exit as a conditional early-abort too - `if (cond) Exit` - but
the trigger / label fall-through guard is the load-bearing case.

Safety: T0 - script-only.

Related: `Restart`, `Goto`, `If`, `DefineMidiTrigger`,
`DefineDmxTrigger`, `InRangeTrigger`.

### CodeShortcut

Signature: `CodeShortcut "<shortcutText>"`

Assign a keyboard shortcut to this script. The shortcut text uses
Delphi's `TextToShortcut` format (e.g. `"F1"`, `"Ctrl+A"`,
`"Shift+F12"`). The same shortcut string can later be passed to
`WaitForHotkey "<shortcutText>"` from another script to subscribe to
its press.

The Code tab in BEYOND has a UI for assigning shortcuts; placing
`CodeShortcut` in the script source documents the assignment alongside
the script itself rather than relying on UI state.

Parameters:
- shortcutText (string): Delphi-style shortcut name.

Example:

    CodeName "Drop"
    CodeShortcut "Ctrl+D"

Safety: T0 - declaration only.

Related: `CodeName`, `WaitForHotkey`.

### CodeName

Signature: `CodeName "<name>"`

Set the display name for this script in BEYOND's Code list. Also the
identifier other scripts use to address this one with `StartCode` /
`StopCode`.

Parameters:
- name (string): display / lookup name for the script.

Example:

    CodeName "Rotate Z"

Safety: T0: declaration only.

Related: `CodeShortcut`, `StartCode`, `StopCode`.

### CodeColorMarker

Signature: `CodeColorMarker <packedColor>`

Set this script's color marker in BEYOND's Code list. It is a
visual/identification aid for browsing scripts in the UI. Per
BEYOND export example: `CodeColorMarker 0x00FF00 | green color
marker`.

Pairs with `CodeName` and `CodeShortcut` to give each script a
trio of identity attributes (name, hotkey, color) that operators
can scan visually in the Code list.

BEYOND documentation: the color uses standard
GDI RGB encoding: `0x0000FF` is red, `0x00FF00` is green, and
`0xFF0000` is blue. No shipped Object Tree readback path exposes
the stored Code-list marker color, so this byte-order claim is
documented rather than runtime-readback-confirmed.

Parameters:
- packedColor (integer, 0x000000..0xFFFFFF): packed GDI RGB color.
 Behavior for values outside the documented 24-bit range is
 unverified.

Example:

    CodeName "Drop"
    CodeShortcut "Ctrl+D"
    CodeColorMarker 0x00FF00 // green marker (export example)
    CodeColorMarker 0x0000FF // red marker per GDI RGB docs

Safety: T0: UI metadata only.

Related: `CodeName`, `CodeShortcut`.

## Subroutine-style invocation

These commands let one script start and stop another by name. The
called script runs in its own scripter - it doesn't share local
variables with the caller. Use the pattern when a complex reaction
chain is easier to express as several short coordinated scripts than
as one long branching one.

### Autostart

Signature: `Autostart`

Mark this script for automatic execution when BEYOND starts. The
command itself is a metadata declaration - placing it anywhere in a
script (typically near the top) tells BEYOND to run the script on
launch in the **PangoScript tab** and **MIDI background** scripts. It
does not start the script when read; the autostart is wired up by
BEYOND when the project loads.

Example:

    Autostart
    SetBPM 120
    StartCue 1, 1

Safety: T0 - declaration only; behavior is governed by BEYOND's
project load.

Related: `CodeName`, `StartCode`.

## Blackout policy

### StopOnBlackout

Signature: `StopOnBlackout <state>`

Configure whether BEYOND's Blackout button (or the equivalent MIDI /
DMX-driven blackout) should also stop this script's execution.

By default, scripts continue running when the operator hits Blackout,
their laser-output side effects are simply masked by the blackout
state. `StopOnBlackout 1` opts the script in to actually halt on
blackout, which is appropriate when the script's logic shouldn't keep
ticking while output is muted (e.g. a beat-synchronized counter that
would drift).

Place `StopOnBlackout` once near the top of the script; it's a
configuration declaration that applies to the whole script.

Parameters:
- state (integer, 0..1): `OFF` (0, default) = continue running on
 blackout; `ON` (1) = halt on blackout. `TOGGLE` behavior is
 unverified because no script-local state readback path is exposed.

Probe note 2026-05-11:
- `StopOnBlackout 0`, `1`, `OFF`, `ON`, and `TOGGLE` were transmitted.
- This does not prove `TOGGLE` is accepted or reveal behavior for
 other out-of-range values.

Example:

    StopOnBlackout ON
    label:
    WaitForBeat 7, 1
    AngleDelta 0, 0, 5
    Restart

Safety: T0: script-only configuration.

Related: `BlackOut`, `BlackOutZones`.

## Code identity

These two commands give a script a name and a hotkey so it can be
addressed from the Code list, from `StartCode` / `StopCode`, and from
`WaitForHotkey`. Like `Autostart`, they are declarations - placing
them in a script registers the metadata; BEYOND reads them on project
load.

### StartCode

Signature: `StartCode "<codeName>"`
Signature: `StartCode "<codeName>", <arg1>, <arg2>,...` *(parses but args are silently discarded - see warning below)*

Start every script whose `CodeName` matches the supplied name. Only
scripts in BEYOND's main Code-tab listbox are addressable.

The Pangolin Wiki notes two semantics worth being explicit about:

1. **It starts every matching script, not just one.** If multiple
 scripts share a CodeName, all of them are started. This is rarely
 intentional - pick unique CodeNames.
2. **It's not a synchronous procedure call.** The wiki: "StartCode is
 not a procedure/function like call. It instruct internal BEYOND
 core to start code." The caller does not block; the called
 script(s) run concurrently in their own scripter.

#### Multi-arg form: do not use

The Pangolin Wiki documents an "overloaded" multi-arg form
(`StartCode "X", arg1, arg2,...`) that supposedly passes a
parameter list to the called script. Verified at runtime in
BEYOND 2030: **the parser accepts the multi-arg form but the
extra args are silently discarded** - there is no receiving-side
parameter accessor exposed to PangoScript. Specifically:

- Caller-side `StartCode "MyCode", 42` parses cleanly.
- Receiver-side `var v / v = Arg1` raises "Unknown function,
 undeclared or not initialized variable: arg1" at parse time.
- BEYOND Object Tree source data exposes no `Arg*` / `Argv*` /
 `Param[N]` / `Sender` / `Caller` / `Self` / `Local` paths that
 could surface the values (only `ProTrack.<n>.Param1..12` exists,
 which is FX-layer params, unrelated).
- The editor's Command list shows only the single-arg example
 `StartCode "MyCode"`.

Use the single-arg form for portable scripts. To pass values
between scripts, use a shared object property (e.g. write to
`Master.<something>` from the caller and read it from the receiver),
or use `PulseEvent` / `WaitForEvent` for one-bit signals.

Parameters:
- codeName (string): the `CodeName` value of the target script(s).
- additional positional arguments (any, optional): parser accepts
 any number; values are **silently discarded** at runtime.

Example:

    // Caller
    WaitForHotkey "F1"
    StartCode "Rotate Z"
    WaitForHotkey "F1"
    StopCode "Rotate Z"
    Restart

    // Target script in another Code-list slot
    CodeName "Rotate Z"
    WaitForBeat 7, 1
    LCMaster
    AngleDelta 0, 0, 5
    Restart

Safety: T0 - script orchestration.

Related: `StopCode`, `CodeName`, `WaitForHotkey`, `PulseEvent`,
`WaitForEvent`.

### StopCode

Signature: `StopCode "<codeName>"`

Stop every script whose `CodeName` matches the supplied name (same
multi-target semantics as `StartCode`). No-op if no matching script is
currently running.

Parameters:
- codeName (string): the `CodeName` value of the script(s) to stop.

Example:

    StopCode "Rotate Z"

Safety: T0 - script orchestration.

Related: `StartCode`, `CodeName`.

### ExecCmd

Signature: `ExecCmd "<pangoScriptCommand>"`

Execute a PangoScript command supplied as a string. Per BEYOND
export example: `ExecCmd "Blackout"`. Useful for building command
strings dynamically (e.g. constructing the target cue from
variables) and dispatching them without resorting to label/goto
tricks.

The dispatched command's safety tier governs the actual blast
radius - `ExecCmd "Hello"` is only as risky as `Hello`, while
`ExecCmd "BlackOut"` carries the same T3 weight as calling
`BlackOut` directly. Because dynamic command strings can dispatch
output, geometry, file, or system commands, the catalog classifies
`ExecCmd` itself conservatively as T4 unless a caller/tool performs
its own static classification of a literal inner command.

Parameters:
- pangoScriptCommand (string): a complete PangoScript command line
 to execute.

Example:

    ExecCmd "Blackout"
    var cmd
    cmd = "StartCue " + page + ", " + cell
    ExecCmd cmd // dispatch dynamically built command

Safety: T4 - dynamic dispatcher. Treat `ExecCmd` calls as if the
dispatched command were inlined; only a statically-known literal
inner command can be reasoned down to that command's own tier.

### ExitBEYOND

Signature: `ExitBEYOND`

Close the BEYOND application. **No confirmation prompt** - the call
shuts down BEYOND immediately, dropping any unsaved show state.

Use only as the last line of an explicit shutdown script. Do not
call from triggers, autostart, or anywhere a stray invocation could
fire unexpectedly.

Example:

    ExitBEYOND

Safety: T4: closes BEYOND. Show state will be lost. Operator
supervision required.

### LinePerCycle

Signature: `LinePerCycle <lines>`

Set how many script lines the PangoScript runtime executes per
scheduling cycle for this script. BEYOND documentation:, the default is 30 lines per cycle. Higher values let a
large or time-critical script process more lines per BEYOND
scheduling tick.

This is not a laser-render or animation control. Accepted bounds,
`0` behavior, and the maximum accepted value are unverified.

Parameters:
- lines (integer): script lines per scheduling cycle. Default `30`.
 Accepted bounds, `0` behavior, and maximum are unverified.

Example:

    LinePerCycle 24 // export example
    LinePerCycle 30 // documented default
    LinePerCycle 100 // higher script throughput

Safety: T1: script-local scheduler setting. It does not directly
write show output.

Evidence note: MCP lint accepted sample values `1`, `10`, `100`, and
`0`, but lint acceptance is not BEYOND range evidence. No Object Tree
readback path is known for the active per-script limit.

Related: `SetUiFPS`, `StartTvMode`.

### SubCmd

Signature: `SubCmd "<channel>"` (1 overload)

**Status: prototype, T0, no observable effect in BEYOND 2030.**

Best-guess intent: subscribe to receive PangoScript command-strings
on the named channel and execute them. Probed by combining `SubCmd
"<ch>"` with `Pub "<ch>", "Brightness 50"`; the brightness write did
not fire.
