---
category: Trigger Definition (test mode)
order: 32
---
# Trigger Definition (test mode)

Trigger definition commands register DMX, MIDI, and timecode triggers that invoke PangoScript handlers when the specified input value is received. These commands are used in BEYOND's test/scripted-trigger mode and interact with the Trigger editor panel.

## Commands

### DefineTrigger

Signature: `DefineTrigger "<expression>"`
Signature: `DefineTrigger "<expression>", "<caption>"`

Set the script into trigger mode bound to an arbitrary PangoScript
expression. The expression is re-evaluated on every BEYOND tick and
its numeric result drives the actions. Use this when no built-in
input source fits - DMX, MIDI, timecode, audio, BEYOND object
properties, or arbitrary mixes can all be combined inside the
expression string.

Slower than `DefineDmxTrigger` / `DefineMidiTrigger` because the
expression is evaluated by BEYOND on every tick rather than precompiled
into a native handler. Use the typed Define* variants when possible.

Parameters:
- expression (string): PangoScript expression yielding a number. The
 expression text is enclosed in double quotes when written in source.
- caption (string, optional): display name for the trigger in the
 PangoScript tab.

Example:

    DefineTrigger "Master.Brightness", "Master brightness"
    InRangeTriggerCmd 0, 10, "BlackOut"
    exit

Safety: T2 - registers a continuous expression evaluator; downstream
actions can have any tier.

Related: `DefineDmxTrigger`, `DefineMidiTrigger`.

## Range-based actions

### DefineDmxTrigger

Signature: `DefineDmxTrigger <channelIndex>`

Set the script into trigger mode bound to a DMX input channel. Every
incoming DMX update on this channel re-evaluates the script's
configured `*Trigger` actions.

Parameters:
- channelIndex (integer, 1..512): DMX channel to watch.

Example:

    DefineDmxTrigger 5
    InRangeTriggerCmd 0, 127, "BlackOut"
    InRangeTriggerCmd 128, 255, "EnableLaserOutput"
    exit

Safety: T2 - registers a continuous DMX subscription with downstream
actions whose tier depends on the configured handlers.

Related: `DefineMidiTrigger`, `DefineTcTrigger`, `DefineTrigger`,
`InRangeTrigger*`.

### DefineMidiTrigger

Signature: `DefineMidiTrigger <command>, <data1>`
Signature: `DefineMidiTrigger <command>, <data1>, "<caption>"`
Signature: `DefineMidiTrigger <command>, <data1>, "<caption>", <deviceIndex>`

Set the script into trigger mode bound to a MIDI message identified
by status byte and first data byte. Optional `caption` shows in the
PangoScript tab so the trigger is identifiable; optional
`deviceIndex` (0..3) restricts firing to a specific MIDI input
device.

Observed in BEYOND on 2026-05-07: a `DefineMidiTrigger` /
`InRangeTrigger` label handler fired for exact CC 0 ranges, but
`ExtValue(...)` inside that label handler returned direct-editor
default values (`0`, `0`, `1`) instead of the incoming CC value.
Use `WaitForMidi` or a direct MIDI-to-PangoScript slot when a script
needs `ExtValue` to read the current MIDI value.

Parameters:
- command (integer, 0x80..0xFF): MIDI status byte (e.g. 0x90 NoteOn,
 0xB0 ControlChange).
- data1 (integer, 0..0x7F): first MIDI data byte (note number,
 controller index, etc.).
- caption (string, optional): display name for the trigger.
- deviceIndex (integer, 0..3, optional): MIDI input device index.
 Defaults to "any device" when omitted.

Example:

    DefineMidiTrigger 0xB0, 0x00, "Brightness slider"
    InRangeTriggerCmd 0, 63, "DisableLaserOutput"
    InRangeTriggerCmd 64, 127, "EnableLaserOutput"
    exit

Safety: T2 - registers a MIDI subscription; downstream actions can
have any tier.

Related: `DefineDmxTrigger`, `DefineTcTrigger`, `DefineTrigger`,
`WaitForMidi`.

### DefineTcTrigger

Signature: `DefineTcTrigger "<caption>"`

Set the script into trigger mode bound to incoming SMPTE / MIDI
timecode. The actions then bind to specific timecode positions or
ranges.

Parameters:
- caption (string): display name for the trigger.

Example:

    DefineTcTrigger "TC Test"
    // Trigger actions follow - bind to timecode positions
    exit

Safety: T2 - registers a timecode subscription; downstream actions
can have any tier.

Related: `WaitForTC`, `DefineMidiTrigger`.
