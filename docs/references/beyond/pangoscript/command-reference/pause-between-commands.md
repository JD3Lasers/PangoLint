---
category: Pause between commands
order: 24
---
# Pause between commands

Pause commands introduce a fixed time delay between PangoScript statements. `Sleep` accepts milliseconds; `Pause` accepts seconds. These are the primary flow-control primitives for adding timing gaps in a script sequence.

## Commands

### Sleep

Signature: `Sleep <timeMs>`

Pause script execution for a fixed number of milliseconds.

Sleep is the only direct-time wait command - it is not bound to any
external event. Use it to insert a deterministic delay between
operations (e.g. between two MIDI sends, or after starting a cue before
adjusting it).

Operator-supervised editor probing observed `Sleep 2000` as an
approximately 2 second delay. The MCP Talk UDP runtime refuses
`Sleep` because wait commands are control flow and Talk UDP only sends
straight-line command batches. Treat lower and upper boundary behavior
as requiring a BEYOND editor-run probe.

Parameters:
- timeMs (integer, milliseconds): duration to pause. `Sleep 100`
 pauses for 0.1 seconds; `Sleep 1000` pauses for 1 second. Use short
 waits when probing because this blocks script execution.

Example:

    MidiOut 0x90, 0x40, 0x7F // note on
    Sleep 500 // hold for half a second
    MidiOut 0x90, 0x40, 0x00 // note off

Safety: T0 - script-only blocking; no shared state.

Related: `WaitForTime`, `WaitForBeat`.

## Beat / metronome events

BEYOND has four independent beat sources that scripts can wait on. Use
the right one for the show context:

- **TimerBeat** - the BPM metronome on the main toolbar (most common).
- **AudioBeat** - beat detection from audio input + FFT analysis.
- **ManualBeat** - operator keystroke / external input simulating a beat.
- **Beat** (generic) - the merged beat used by VLJ; may match any of
 the above depending on configuration.
