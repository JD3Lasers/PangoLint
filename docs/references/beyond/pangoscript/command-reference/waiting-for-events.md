---
category: Waiting for events - time, beats, DMX, etc
order: 26
---
# Waiting for events - time, beats, DMX, etc

WaitFor commands block script execution until a specific event occurs: a beat tick, a time position, a MIDI message, a DMX channel value, a cue state change, a cell gesture, a custom event, a page change, or a hot key. They are the core of event-driven PangoScript programming.

## Commands

### WaitForMidi

Signature: `WaitForMidi <command>, <data1>, <data2>`

Suspend execution until a matching MIDI message arrives. The `-1`
sentinel matches any value on a given field, so `WaitForMidi 0x90, -1, -1`
waits for any NoteOn from any note at any velocity.

Pair with `SelectMidi` to scope the wait to a specific MIDI input
device; otherwise the wait fires on any device.

Observed in BEYOND on 2026-05-07: after
`WaitForMidi 0xB0, 0x00, -1`, `ExtValue(0, 127)` used the matching
CC value as its external input context. CC 0 values `0`, `64`, and
`127` produced `ExtValue(0, 127)` results `0`, `64`, and `127`;
`ExtValue(0, 8.999)` produced `0`, `4.534929`, and `8.999`;
`ExtValue(1, -1)` produced `1`, `-0.007874`, and `-1`.
The script resumes once and then continues normally, so a terminal
`exit` stops the one-shot wait script after the callback.

Parameters:
- command (integer, 0x80..0xFF): MIDI status byte (e.g. 0x90 NoteOn,
 0x80 NoteOff, 0xB0 ControlChange, 0xC0 ProgramChange).
- data1 (integer, 0..0x7F or -1): first data byte (note number,
 controller index, etc.); -1 matches any.
- data2 (integer, 0..0x7F or -1): second data byte (velocity, controller
 value, etc.); -1 matches any.

Example:

    WaitForMidi 0x90, 0x01, -1 // any velocity NoteOn for note 1
    WaitForMidi 0xC0, 0, ANY // any value of program 0 program-change

Safety: T0 - script-only blocking.

Related: `SelectMidi`, `MidiOut`, `DefineMidiTrigger`.

### WaitForDmx

Signature: `WaitForDmx <channelIndex>`

Suspend execution until the specified incoming DMX channel changes
value. The `-1` sentinel matches any channel.

Use this for ArtNet input as well - BEYOND's DMX bridge surfaces ArtNet
channels through the DMX channel space.

Parameters:
- channelIndex (integer, 1..512 or -1): DMX channel to watch; -1 matches any.

Example:

    WaitForDmx 2 // wait for DMX channel 2 to change
    WaitForDmx -1 // wait for any channel change

Safety: T0 - script-only blocking.

Related: `WaitForChannel`.

### WaitForChannel

Signature: `WaitForChannel <channelIndex>`

Suspend execution until the specified internal BEYOND Channel changes
value. BEYOND has 256 internal channels typically used by effects,
shapes, and abstracts. The `-1` sentinel matches any channel.

Parameters:
- channelIndex (integer, 1..255 or -1): internal channel index; -1 matches any.

Example:

    WaitForChannel 5

Safety: T0 - script-only blocking.

Related: `WaitForDmx`.

## Cue lifecycle

### WaitForCueStart

Signature: `WaitForCueStart <page>, <cell>`

Suspend execution until the specified cue starts playing. Either
parameter accepts `-1` to mean "any" - `WaitForCueStart -1, 10` fires
when cell 10 on any page starts.

Parameters:
- page (integer, 1..100 or -1): grid page index; -1 matches any page.
- cell (integer, 1..100 or -1): cell index inside the page; -1 matches any cell.

Example:

    WaitForCueStart -1, 10 // wait for any page's cell 10 to start
    WaitForCueStart 1, 1 // wait for the specific cue at (1,1)

Safety: T0 - script-only blocking.

Related: `WaitForCueStop`, `StartCue`.

### WaitForCueStop

Signature: `WaitForCueStop <page>, <cell>`

Suspend execution until the specified cue stops playing. Same `-1`
sentinel and addressing semantics as `WaitForCueStart`.

Parameters:
- page (integer, 1..100 or -1): grid page index; -1 matches any page.
- cell (integer, 1..100 or -1): cell index inside the page; -1 matches any cell.

Example:

    WaitForCueStop -1, 10

Safety: T0 - script-only blocking.

Related: `WaitForCueStart`, `StopCue`.

### WaitForCellDown

Signature: `WaitForCellDown <cellIndex>`

Suspend execution until a mouse-down event occurs on the specified
grid cell. This is the raw input event before BEYOND's input manager
translates it into a cue start/stop, so use this when you want to react
to the click itself rather than the resulting cue state.

Parameters:
- cellIndex (integer, 1..255 or -1): linear cell index; -1 matches any.

Example:

    WaitForCellDown 1

Safety: T0 - script-only blocking.

Related: `WaitForCellUp`, `CueDown`.

### WaitForCellUp

Signature: `WaitForCellUp <cellIndex>`

Suspend execution until a mouse-up event occurs on the specified grid
cell - i.e. when the operator releases the click. Useful for
hold-to-trigger interactions where the action happens on release rather
than press.

Parameters:
- cellIndex (integer, 1..255 or -1): linear cell index; -1 matches any.

Example:

    label:
    WaitForCellUp 1
    MidiOut 0x90, 0x40, 127
    Sleep 100
    MidiOut 0x80, 0x40, 0
    Restart

Safety: T0 - script-only blocking.

Related: `WaitForCellDown`, `CueUp`.

## Custom events

### WaitForTime

Signature: `WaitForTime <hour>, <minute>, <second>, <millisecond>`

Suspend execution until the PC system clock reaches the specified
wall-clock time. Use this for time-of-day cues (e.g. fire at 9:00 PM).

If the specified time has already passed today, the wait will resolve
immediately on the next clock tick - `WaitForTime` does **not** wait
until tomorrow.

Parameters:
- hour (integer, 0..23): hour of the day.
- minute (integer, 0..59): minute of the hour.
- second (integer, 0..59): second of the minute.
- millisecond (integer, 0..999): millisecond of the second.

Example:

    WaitForTime 21, 0, 0, 0 // wait until 9:00 PM exactly

Safety: T0 - script-only blocking.

Related: `WaitForTimePos`, `WaitForTC`.

### WaitForTimePos

Signature: `WaitForTimePos <hour>, <minute>, <second>, <millisecond>`

Suspend execution until the specified time has elapsed **since the
script started executing**. Unlike `WaitForTime`, this is a relative
wait - `WaitForTimePos 0, 1, 45, 0` blocks until 1 minute 45 seconds
into the current script run.

The `Restart` command resets the script's local clock back to zero.

Parameters:
- hour (integer, 0..23): hours since script start.
- minute (integer, 0..59): minutes since script start.
- second (integer, 0..59): seconds since script start.
- millisecond (integer, 0..999): milliseconds since script start.

Example:

    WaitForTimePos 0, 1, 45, 0 // wait 1m45s after script start

Safety: T0 - script-only blocking.

Related: `WaitForTime`, `Restart`.

### WaitForTC

Signature: `WaitForTC <hour>, <minute>, <second>, <millisecond>`

Suspend execution until BEYOND's currently-configured timecode source
reaches the specified position. The wait is bound to whatever TC
source is selected in BEYOND's TC panel (MIDI TC, ArtNet TC, LTC,
internal show clock) - so the same script is portable across
sources as long as BEYOND is configured to receive the one driving
the show.

Verified at runtime in BEYOND 2030 with Timecode Expert sending
ArtNet TC: `WaitForTC 0, 0, 5, 0` unblocks when the generator's TC
reaches 00:00:05:00, and `WaitForTC 0, 0, 0, 500` unblocks
near-immediately (within ~0.5 s of generator start) - confirming
the fourth argument is **milliseconds**, not frames. BEYOND
internally converts the incoming HH:MM:SS:FF on the TC wire to
HH:MM:SS:ms (using the source framerate) before comparing to the
wait target.

Parameters:
- hour (integer, 0..23): timecode hour.
- minute (integer, 0..59): timecode minute.
- second (integer, 0..59): timecode second. **Verified**: a value
 of 5 here unblocks the wait when the TC source reaches 5 seconds.
- millisecond (integer, 0..999): timecode millisecond. **Verified**
 via `WaitForTC 0,0,0,500` - slider flipped near-immediately
 (matches ms; would have been ~16.7 s under frames-at-30fps).

Example:

    WaitForTC 0, 0, 5, 0 // fires at 5 seconds
    WaitForTC 15, 30, 0, 0 // fires at 15:30:00.000

Safety: T0 - script-only blocking.

Related: `WaitForTime`.

## Input devices

### WaitForHotKey

Signature: `WaitForHotKey`
Signature: `WaitForHotKey "<shortcutText>"`

Suspend execution until the script's assigned hotkey is pressed (no
argument), or until the supplied named shortcut is pressed (string
form). Each script in BEYOND's Code list can be assigned a hotkey
through the UI.

The BEYOND export uses `WaitForHotKey` with a capital `K`. Older local
notes and examples may show `WaitForHotkey`; PangoScript parsing is
case-insensitive and PangoLint keeps that spelling as an alias.

Combined with `Restart`, this is the preferred pattern for a
hotkey-driven loop:

    label:
    WaitForHotKey
    DmxOut 1, 255
    Sleep 500
    DmxOut 1, 0
    Restart

Parameters:
- shortcutText (string, optional): named shortcut (e.g. `"F1"`, `"Ctrl+A"`).
 Without this argument, the script waits for whichever hotkey is
 assigned to itself in the Code tab.

Example:

    WaitForHotKey
    WaitForHotKey "F1"

Safety: T0 - script-only blocking.

Related: `Restart`, `CodeShortcut`, `StartCode`.

### WaitForAudioBeat

Signature: `WaitForAudioBeat <beats>`

Suspend execution for N beats on the audio-detected beat (same source
as VirtualLJ's audio analyzer). Useful when the show is driving off live
audio input rather than a fixed BPM.

Parameters:
- beats (number): number of audio beats to wait.

Example:

    WaitForAudioBeat 1

Safety: T0 - script-only blocking.

Related: `WaitForBeat`, `AudioBeat`.

### WaitForManualBeat

Signature: `WaitForManualBeat <beats>`

Suspend execution for N manual beats. Manual beat is fired by an
operator pressing the configured key on the main toolbar (or by
`ManualBeat` from another script).

Parameters:
- beats (number): number of manual beats to wait.

Example:

    WaitForManualBeat 1

Safety: T0 - script-only blocking.

Related: `WaitForBeat`, `ManualBeat`.

## Wall-clock and timecode

### WaitForTimerBeat

Signature: `WaitForTimerBeat <beats>`

Suspend execution for N beats on the BPM **timer** specifically (the
metronome panel on the main toolbar). Use this instead of `WaitForBeat`
when you want to bind to the timer source regardless of how
BEYOND's merged beat is configured.

Parameters:
- beats (number): number of timer beats to wait. Fractional, zero, and
 upper-bound runtime behavior is not yet verified in the BEYOND
 editor. MCP Talk UDP refuses `WaitForTimerBeat` because wait
 commands are control flow.

Example:

    WaitForTimerBeat 1

Safety: T0 - script-only blocking.

Related: `SetBPM`, `WaitForBeat`, `TimerBeat`.

### WaitForBeat

Signature: `WaitForBeat <beatMask>, <count>`

Suspend execution until the given number of beats have elapsed on the
specified beat-source bit mask. The two-argument form is the only form
accepted by current BEYOND editor parsing - both the zero-argument form
(`WaitForBeat`) and the one-argument form (`WaitForBeat <count>`)
documented in Pangolin documentation are rejected at parse time. If a
script uses either of those, BEYOND raises a "Code contain errors"
popup and refuses to run.

Parameters:
- beatMask (integer, required): bit mask selecting beat sources.
 Documented bits are `1 = timer beat`, `2 = manual beat`, and
 `4 = audio beat`. Combine bits to wait for multiple sources;
 `7` selects all three documented sources. Mask `0` and bits above
 `4` are not confirmed.
- count (number, required): number of matching beat events to wait.
 Linear behavior has been verified for whole-event counts: at master
 BPM 120, `WaitForBeat 7, 1` toggled every metronome tick (= 1
 matching event per wait), and `WaitForBeat 7, 2` toggled every 2
 ticks. Fractional, zero, and upper-bound behavior is not yet
 verified in the BEYOND editor.

Example:

    label:
    WaitForBeat 7, 1 // wait one event from timer/manual/audio
    AngleDelta 0, 0, 5
    Restart

    WaitForBeat 1, 4 // wait four timer-beat events

Safety: T0 - script-only blocking. A `WaitForBeat` against a mask whose
selected source is not currently emitting beats will block the script
indefinitely. In observed probes, `WaitForBeat 4, 1` did not unblock in
a lab state with no active audio beat, while `WaitForBeat 7, 1` returned
every timer beat at 120 BPM. Mask `100` has no documented meaning in the
current BEYOND command documentation.

Related: `WaitForTimerBeat`, `WaitForAudioBeat`, `WaitForManualBeat`,
`SetBPM`, `BeatTap`, `Restart`.

### WaitForEvent

Signature: `WaitForEvent "<name>"`
Signature: `WaitForEvent "<name1>", "<name2>", "<name3>"`

Suspend execution until any of the named custom events fires. Custom
events are user-defined string identifiers; another script triggers
them with `PulseEvent`. Useful for cross-script coordination - one
script publishes events, others subscribe via `WaitForEvent`.

Parameters:
- name (string, one or more): event name(s) to wait for. The wait fires
 on the first matching `PulseEvent` from any other script.

Example:

    WaitForEvent "Drop"
    WaitForEvent "BeatBuildup", "BeatBuildupHard"

Safety: T0 - script-only blocking.

Related: `PulseEvent`.

## Workspace state

### WaitForPageChange

Signature: `WaitForPageChange`

Suspend execution until the active page on **Grid1** (the main cue
grid) changes. Verified at runtime in BEYOND 2030: fires on both
UI clicks on Grid1's page tabs and on `SetGrid1Page <n>` invoked
from another script. Does **not** fire on Grid2 page changes (UI
click on Grid2's page tabs or scripted `SetGrid2Page`), and does
**not** fire on `SetPage` (which is a silent no-op in current
BEYOND 2030 despite the Pangolin Wiki claim of being an alias for
`SetGrid1Page`).

Example:

    WaitForPageChange

Safety: T0 - script-only blocking.

Related: `SetGrid1Page`, `SetGrid2Page`, `SetPage`.
