---
category: Generating beats
order: 9
---
# Generating beats

Generating beats commands select and configure BEYOND's beat-source: internal timer, audio analysis, manual tap, MIDI clock, or timecode. These map to the Beat Source selector in the BEYOND Beat Timer panel.

## Commands

### TimerBeat

Signature: `TimerBeat`

Fire a single Timer beat event. Useful for driving the Timer beat from
a non-tempo source (e.g. one tick per loop iteration in a script).

Example:

    label:
    WaitForMidi 0x90, 0x40, -1
    TimerBeat
    Restart

Safety: T0 - fires a single event; no direct laser output. Downstream subscribers react.

Related: `WaitForTimerBeat`, `SetBpm`, `BeatResync`.

### AudioBeat

Signature: `AudioBeat`

Fire a single Audio beat event. The "real" audio beat source is
FFT-based peak detection on audio input; this command bypasses that
and fires the event directly.

Example:

    label:
    WaitForMidi 0x90, 0x40, -1
    AudioBeat
    Restart

Safety: T0 - fires a single event; no direct laser output. Downstream subscribers react.

Related: `WaitForAudioBeat`.

### ManualBeat

Signature: `ManualBeat`

Fire a single Manual beat event. The "real" Manual beat source is the
operator pressing the configured keyboard key; this command lets a
script generate the same event.

Example:

    label:
    WaitForHotkey "F2"
    ManualBeat
    Restart

Safety: T0 - fires a single event; no direct laser output. Downstream subscribers react.

Related: `WaitForManualBeat`.
