---
category: MIDI, DMX, Channel, OSC output
order: 23
---
# MIDI, DMX, Channel, OSC output

Output commands send data on MIDI, DMX, Channel, and OSC busses from within a PangoScript. They let a script drive external devices (synthesizers, lighting consoles, DMX fixtures, OSC-capable software) in sync with laser cues. OSC output uses the OscOut* family; MIDI output uses MidiOut; DMX output uses SetDmx.

## Commands

### SelectMidi

Signature: `SelectMidi <deviceIndex>`

Set the calling script's MIDI device index. Subsequent `MidiOut*`
calls send to this device, and subsequent `WaitForMidi` waits listen
on this device. Each scripter has its own value; `SelectMidi` in
script A doesn't affect script B.

Parameters:
- deviceIndex (integer, 1..4): index of the MIDI device pair to use.

Example:

    SelectMidi 1
    MidiOut 0x90, 0x40, 0x7F // sent on device 1
    WaitForMidi 0x80, -1, -1 // listens on device 1

Safety: T1 - script-local configuration; no immediate MIDI output.

Related: `SetMidiLayer`, `MidiOut`, `WaitForMidi`.

### MidiOut

Signature: `MidiOut <command>, <data1>, <data2>`
Signature: `MidiOut <command>, <data1>, <data2>, <deviceIndex>`

Send a single **fixed 3-byte** MIDI message to the script's
selected MIDI device. Optional fourth argument selects a specific
device for this call only, overriding `SelectMidi`.

Verified at runtime in BEYOND 2030: the parser strictly requires
exactly 3 data arguments - 1-arg, 2-arg, and 6-arg (SysEx-shaped)
forms all fail with "Code contain errors". Wire output verified
via loopMIDI → Protokol: `MidiOut 0x90, 0x40, 0x7F` emits exactly
the bytes `90 40 7F` (NoteOn ch 1 note 64 vel 127), no padding or
wrapping. For variable-length MIDI (SysEx, 2-byte Program Change /
Channel Pressure, 1-byte System Real-Time messages), use
`MidiOutLong` below.

Parameters:
- command (integer, 0x80..0xFF / 128..255): MIDI status byte
 (e.g. 0x90 NoteOn, 0x80 NoteOff, 0xB0 ControlChange,
 0xC0 ProgramChange).
- data1 (integer, 0..0x7F / 0..127): first MIDI data byte (note
 number, controller index, program number, etc.).
- data2 (integer, 0..0x7F / 0..127): second MIDI data byte
 (velocity, controller value, etc.).
- deviceIndex (integer, 1..4, optional): device index for this call
 only.

Example:

    MidiOut 0x90, 0x40, 0x7F // NoteOn, note 64, velocity 127
    Sleep 500
    MidiOut 0x80, 0x40, 0x00 // NoteOff, note 64

    MidiOut 0xB0, 7, 100, 2 // ControlChange CC 7 to 100 on device 2

Safety: T3 - emits MIDI output that downstream hardware / software
will react to.

Related: `MidiOutLong`, `MidiSysexSend`, `SelectMidi`,
`WaitForMidi`.

### MidiOutLong

Signature: `MidiOutLong <byte1>, <byte2>,...`

Send a **variable-length** MIDI message (1..N bytes) to the
script's selected MIDI device. Counterpart to `MidiOut` (which is
strictly 3 bytes). Use this for any MIDI message that isn't exactly
3 bytes:

- **SysEx** - vendor-specific messages framed with 0xF0..0xF7.
- **2-byte channel-voice** - Program Change (0xC0..0xCF), Channel
 Pressure (0xD0..0xDF).
- **1-byte System Real-Time** - Timing Clock (0xF8), Start (0xFA),
 Continue (0xFB), Stop (0xFC), Active Sensing (0xFE), Reset (0xFF).
- 3-byte channel-voice messages also work - `MidiOutLong` accepts
 any byte count, so you can use it uniformly if preferred.

Verified at runtime in BEYOND 2030 with a loopMIDI virtual port
observed in Protokol's MIDI monitor: `MidiOutLong` sends the
specified byte sequence **literally on the MIDI wire** - no padding,
no wrapping, no length prefix. Specific cases observed:

| Script | Wire output |
| --------------------------------------------------- | ---------------------------- |
| `MidiOutLong 0x90, 0x41, 0x7F` | `90 41 7F` (NoteOn, 3-byte) |
| `MidiOutLong 0xC0, 0x05` | `C0 05` (Program Change, 2-byte) |
| `MidiOutLong 0xF8` | `F8` (Timing Clock, 1-byte) |
| `MidiOutLong 0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7` | `F0 7E 7F 06 01 F7` (SysEx, 6-byte) |

Parameters:
- bytes (variadic integers, 0..0xFF each): MIDI bytes to send. The
 first byte is normally a status byte (0x80..0xFF); subsequent
 bytes are data (0..0x7F). For SysEx, start with 0xF0 and end with
 0xF7.

Example:

    MidiOutLong 0x90, 0x40, 0x7F // 3-byte: NoteOn note 64
    MidiOutLong 0xC0, 0x05 // 2-byte: ProgramChange to program 5
    MidiOutLong 0xF8 // 1-byte: Timing Clock
    MidiOutLong 0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7 // 6-byte: SysEx Identity Request

Safety: T3 - same as `MidiOut`.

Related: `MidiOut`, `MidiSysexSend`, `SelectMidi`.

## SysEx output

System Exclusive (SysEx) messages are MIDI's variable-length escape
hatch - used for vendor-specific patches, firmware updates, configs,
etc. PangoScript builds a SysEx buffer in three stages:

1. `MidiSysexStart` - clear the buffer.
2. `MidiSysexAdd <bytes>` - append bytes one or more times.
3. `MidiSysexSend` - send the buffered message.

The Pangolin Wiki notes the buffer is internally a Delphi
`TMemoryStream` - capacity is essentially "as many bytes as you
need."

### MidiSysexStart

Signature: `MidiSysexStart`

Clear the SysEx send buffer to begin building a new message. Always
call this before the first `MidiSysexAdd` of a new message.

Example:

    MidiSysexStart
    MidiSysexAdd "F0477F"
    MidiSysexAdd "0102030405"
    MidiSysexSend

Safety: T2 - buffer mutation only; no MIDI output until `MidiSysexSend`.

Related: `MidiSysexAdd`, `MidiSysexSend`.

### MidiSysexAdd

Signature: `MidiSysexAdd "<hexString>"`
Signature: `MidiSysexAdd <byte1>, <byte2>,...`

Append bytes to the SysEx buffer. Two input forms:

- **Hex string** - a string of hex characters representing
 consecutive bytes (e.g. `"F0477F"` adds three bytes: 0xF0, 0x47,
 0x7F).
- **Integer arguments** - one or more integer values, each
 representing one byte.

The two forms can be interleaved across multiple `MidiSysexAdd`
calls building a single message.

Parameters:
- hexString (string): even-length string of hex characters.
- bytes (variadic integers, 0..255 each): byte values.

Example:

    MidiSysexStart
    MidiSysexAdd "F0477F" // header + manufacturer ID
    MidiSysexAdd 0x01, 0x02 // payload bytes via integer form
    MidiSysexAdd "F7" // SysEx end byte
    MidiSysexSend

Safety: T2 - buffer mutation only; no MIDI output until `MidiSysexSend`.

Related: `MidiSysexStart`, `MidiSysexSend`.

### MidiSysexSend

Signature: `MidiSysexSend`

Send the prepared SysEx buffer to the script's currently-selected
MIDI device. The buffer is **not** cleared automatically afterwards
 - call `MidiSysexStart` again before building the next message.

Example:

    MidiSysexStart
    MidiSysexAdd "F0477F010203F7"
    MidiSysexSend

Safety: T3 - emits MIDI output.

Related: `MidiSysexStart`, `MidiSysexAdd`, `SelectMidi`.

### DmxOut

Signature: `DmxOut <channel>, <value>`
Signature: `DmxOut <channel>, <value>, <value16>`

Set a single DMX output channel.

The 3-argument form is for 16-bit DMX where the value is split
across two consecutive channels (high byte at `channel`, low byte at
`channel + 1`). Use the 2-argument form for standard 8-bit channels.

Use the special value `-1` to mark a channel as **transparent** - it
won't override any other source feeding the same channel (e.g. a
fixture-control script can yield to manual operator changes by
writing -1).

Verified at runtime in BEYOND 2030 with all 4 ArtNet output
universes configured: `DmxOut 600, 128` writes successfully and
reads back as `DmxOutput.599 = 128` (0-based property index = ch
600 - 1, which sits in universe 2 at channel 88). No
wrap-to-universe-1 was observed; reads of out-of-bounds channels
(e.g. `DmxOutput.512`, `DmxOutput.600`) returned `-1` as the
"channel does not exist" sentinel.

Parameters:
- channel (integer, 1..2048): 1-based DMX channel index across all
 4 universes (universe 1: 1..512; universe 2: 513..1024;
 universe 3: 1025..1536; universe 4: 1537..2048). Maps to
 `DmxOutput.<channel - 1>` in the BEYOND object tree for readback.
- value (integer, 0..255 or -1): DMX value; -1 means "transparent."
- value16 (integer, optional): low-byte value for 16-bit DMX
 (high byte goes to `channel`, low to `channel + 1`).

Example:

    DmxOut 1, 255 // universe 1 ch 1 = 255
    DmxOut 1, 0 // ch 1 = 0
    DmxOut 5, -1 // ch 5 = transparent (yield)
    DmxOut 7, 100, 200 // 16-bit value across ch 7+8
    DmxOut 600, 128 // verified: universe 2 ch 88 = 128

Safety: T3 - direct DMX output; affects external fixtures.

Related: `DmxOutRange`, `WaitForDmx`, `DefineDmxTrigger`.

### DmxInMute

Signature: `DmxInMute <channel>, <state>`

Mute or unmute a specific DMX **input** channel - incoming values on
the muted channel are ignored by BEYOND.

Parameters:
- channel (integer): DMX input channel index.
- state (integer, 0..1): 0 = unmuted (default), 1 = muted.

Example:

    DmxInMute 1, 1 // ignore incoming DMX on ch1

Safety: T2 - affects DMX input routing for the muted channel.

Property mapping: no shipped Object Tree readback path is currently
known for the per-channel mute state. A probe against
`DmxIO.MuteInput` did not move when `DmxInMute 1, 1` was sent.

Related: `EnableDmxIn`.

### ChannelOut

Signature: `ChannelOut <channelIndex>, <value>`

Set the value of a BEYOND internal channel directly from
PangoScript. The value range is 0..1000 internally mapped to a
normalized 0..1 (so 1000 means "full").

Parameters:
- channelIndex (integer, 1..255): internal channel index.
- value (integer, 0..1000): channel value; mapped to 0..1
 internally.

Example:

    ChannelOut 1, 1000 // channel 1 = full
    ChannelOut 1, 500 // channel 1 = half

Readback: `ChannelOut 1, 250` writes `Channels.1.Value = 0.25`.
PangoScript channel inputs are 1-based; PangoLint maps the family as
`Channels.N.Value`.

Safety: T3 - drives effect parameters that produce live laser
output.

Related: `WaitForChannel`, `SetChannelToChannelRatio`,
`SetDmxToChannelRatio`.

## Channel-ratio mapping

These four commands configure global source contribution ratios for
BEYOND's channel input mixing. Runtime readback confirms each command
is a **single-argument** global setter, despite older multi-channel
wording in some notes. Each ratio is a 0..100 percentage.

The four sources mirror BEYOND's input subsystems:

- **Channel-to-channel** - one internal channel feeds another.
- **DMX-to-channel** - incoming DMX feeds an internal channel.
- **FFT-to-channel** - audio FFT analysis feeds an internal channel.
- **VDJ-to-channel** - VirtualDJ data feeds an internal channel.

### OscOut

Signature: `OscOut "<address>"`
Signature: `OscOut "<address>", <arg1>, <arg2>,...`

Send an OSC message. The first argument is the OSC address (string).
Additional arguments are optional and become the message payload; the
type tag string is composed automatically from the runtime types of
those arguments (string → `s`, integer → `i`, float → `f`).

The address can use BEYOND's `<varName>` substitution to embed a
PangoScript variable into the path itself.

Use `OscOutTTS` instead when you need explicit type tags - for
example, when the receiver requires a specific tag the auto-inference
wouldn't produce.

Parameters:
- address (string): OSC address (the leading slash is part of the
 address, e.g. `/beyond/master/brightness`).
- args (variadic, optional): zero or more values; types are inferred.

Example:

    OscOut "/beam1/xy", -5, 100 // sends two integers
    OscOut "/main/volume", 0.75 // sends one float
    OscOut "/show/cue", "step-1" // sends one string

    var z
    z = 3
    OscOut "/beyond/zone/<z>/select", 1 // address with variable substitution

Safety: T3 - can target any external OSC destination including ones
that change show state, output, or projector configuration depending
on what the receiving system does with the message.

Related: `OscOutTTS`, `RegisterOscFeedback`.

### OscOutTTS

Signature: `OscOutTTS "<address>", "<typeTags>", <arg1>, <arg2>,...`

Send an OSC message with an **explicit** type tag string instead of
the auto-inference `OscOut` does. Use this when the receiver expects
a specific tag - for example, a readback contract that always
requires a single-string `s` payload regardless of what the value
looks like.

A common readback-first pattern: send `OscOutTTS "/some/ping",
"s", "<request-id>"` and have the receiver echo the request-id back.
That confirms the round-trip without any laser-output side effect.

Keep each `OscOutTTS` invocation on one line. PangoScript does not
continue the argument list onto following lines.

Parameters:
- address (string): OSC address.
- typeTags (string): OSC type tag string composed of `i`, `f`, `s`
 characters (one per following argument). Mixed tags allowed
 (e.g. `"sif"` for string + integer + float).
- args (variadic, optional): values whose count and types must match
 `typeTags`.

Example:

    OscOutTTS "/main/volume", "i", 100 // force integer payload
    OscOutTTS "/probe/ping", "s", "ping-001" // readback-style ping shape

Safety: T1 for readback-only addresses (e.g. ping/echo patterns),
but **T3-capable** if pointed at a destination that mutates show
state. If you point this command at a write address, treat it as T3.

Related: `OscOut`, `RegisterOscFeedback`.

## Receiving

### DmxOutRange

Signature: `DmxOutRange <startChannel>, <value1>, <value2>,...`

Write multiple DMX channels in a single call starting at
`startChannel`. The first value goes to `startChannel`, the second
to `startChannel + 1`, and so on. Same `-1 = transparent` convention
as `DmxOut`. Same 1..2048 flat-universe channel model - the runtime
verification under `DmxOut` covers this command's range too (the
write path is identical).

Parameters:
- startChannel (integer, 1..2048): first DMX channel to write.
- values (variadic integers, 0..255 or -1 each): values for
 consecutive channels.

Example:

    DmxOutRange 1, 255, 128, 64, 0, -1 // ch1=255, ch2=128, ch3=64, ch4=0, ch5=transparent

Safety: T3 - direct DMX output; affects external fixtures.

Related: `DmxOut`.

## DMX input control

These commands configure BEYOND's DMX input subsystem rather than
producing output. Place them once during script startup; subsequent
`WaitForDmx` / `DefineDmxTrigger` consumers depend on input being
enabled.

### EnableDmxIn

Signature: `EnableDmxIn <state>`

Enable or disable BEYOND's DMX input subsystem globally.

Parameters:
- state (integer, 0..2): `OFF` (0), `ON` (1), or `TOGGLE` (2).

Example:

    EnableDmxIn ON
    WaitForDmx -1 // wait for any DMX channel change

Safety: T2 - global subsystem state; affects every DMX input
consumer in BEYOND.

Related: `EnableFb3StyleDmxIn`, `DmxInMute`, `RefreshDmxIn`.

### EnableFb3StyleDmxIn

Signature: `EnableFb3StyleDmxIn <state>`

Enable or disable FB3-style DMX input handling - a BEYOND-specific
input mode for FlashBack 3 style addressing. Toggling this changes
how incoming DMX maps to internal channels.

Parameters:
- state (integer, 0..2): `OFF` (0), `ON` (1), or `TOGGLE` (2).

Example:

    EnableFb3StyleDmxIn ON

Safety: T2 - global subsystem state.

Related: `EnableDmxIn`.

### Fb4DiscoveryMode

Signature: `Fb4DiscoveryMode <mode>`

Set this BEYOND instance's role in the multi-BEYOND FB4 failover
discovery system. Per BEYOND export comment: "0-always, 1-auto,
2-manual." **Verified 2026-05-06** by issuing each mode and
observing BEYOND's notification panel:

Parameters:
- mode (integer, 0..2):
 - `0` - **Always**: claim FB4s on the network unconditionally.
 Aggressive - useful when this BEYOND should be the sole
 controller.
 - `1` - **Auto** (default): cooperative - pick up FB4s when no
 other BEYOND has claimed them. Produces the notification
 "Discovery: Discovery automatically enabled".
 - `2` - **Manual / Wait-for-failover**: passive - don't claim;
 yield to other BEYONDs on the network. Produces the
 notification "Discovery: Waiting for other BEYOND in network".

**Recovery role**: setting mode `1` (or `0`) is what re-enables
discovery after `StopFb4Discovery` has disabled it - without this
step, `StartFb4Discovery` alone won't reconnect a Stopped FB4.

Example:

    Fb4DiscoveryMode 0 // claim everything (sole BEYOND)
    Fb4DiscoveryMode 1 // cooperative default
    Fb4DiscoveryMode 2 // wait-for-failover (passive)

    // Recovery sequence after StopFb4Discovery:
    Fb4DiscoveryMode 1
    StartFb4Discovery

Safety: T2 - changes whether BEYOND polls / claims FB4s on the
network. Switching to `2` mid-show on the active controller would
release any in-flight FB4 claim and let another BEYOND take over;
switching to `0` or `1` is safe to do on an idle network.

Related: `StartFb4Discovery`, `StopFb4Discovery`.

### RebootConnectedFB4

Signature: `RebootConnectedFB4`

Reboot all connected FB4 hardware. Per the BEYOND export comment:

> If you need to use this command then please contact Pangolin
> (<report@pangolin.com>) and tell what is wrong with your FB4.
> Thanks.

In other words: this is a last-resort recovery command. Pangolin
explicitly asks operators to report the problem before resorting
to it, since routine use suggests an underlying FB4 issue worth
investigating.

Rebooting takes the FB4 offline for the duration of its boot
sequence - every laser routed through it goes dark.

Example:

    RebootConnectedFB4 // last-resort recovery

Safety: T4 - reboots hardware. Pangolin support contact requested
before use. Output drops for the duration of the reboot.

### RefreshDmxIn

Signature: `RefreshDmxIn`

Force BEYOND to re-evaluate its DMX input reactions immediately,
without waiting for the next data change. Use after a configuration
change that should re-fire whatever the current DMX state implies
(e.g. after toggling `EnableFb3StyleDmxIn`).

Example:

    EnableFb3StyleDmxIn ON
    RefreshDmxIn // apply new mapping immediately

Safety: T2 - re-fires DMX-driven reactions; downstream effects may
react.

Related: `EnableDmxIn`, `EnableFb3StyleDmxIn`.

## BEYOND internal channels

BEYOND has **255 internal "channels"** (independent of DMX) used by
effects, shapes, and abstracts as input values. External sources
(DMX, FFT-analyzed audio, VirtualLJ, other channels) feed into these
channels via the channel-ratio mapping commands below; effects then
read the channel values to drive their parameters.

### RegisterOscFeedback

Signature: `RegisterOscFeedback "<oscAddress>", "<objectProperty>"`

Register a BEYOND object property to be **published** as an outgoing
OSC message whenever the property's value changes. After registration,
BEYOND emits an OSC message at `<oscAddress>` carrying the current
value every time the named property changes.

Each registration is global to the BEYOND instance and survives
script Restart / Exit. The only documented ways to undo a registration
are restarting BEYOND or letting the address prefix become stale (no
listener cares anymore). `ResetOscFeedback` is **not** a clean
deregistration mechanism - see below.

Recommended discipline: scope every callback address under a
per-session prefix (e.g. `/myapp/verify/<run-id>/...`) so stale
registrations from a previous session don't pollute current output,
and treat cleanup as "wait for BEYOND restart."

Parameters:
- oscAddress (string): the address BEYOND emits the callback to.
- objectProperty (string): a BEYOND object/property path
 (e.g. `Master.Brightness`, `Zone.0.Active`).

Example:

    RegisterOscFeedback "/myapp/verify/abc-123/master_brightness", "Master.Brightness"
    // BEYOND now emits /myapp/verify/abc-123/master_brightness <value>
    // every time Master.Brightness changes.

Safety: T1 - this command itself only subscribes; it does not change
show state. The downstream OSC traffic it produces is also read-only
for the receiver. The leak risk (stale registrations) is what the
prefix discipline mitigates.

Related: `ResetOscFeedback`, `OscOut`.

## Feedback management

### ResetMidiFeedback

Signature: `ResetMidiFeedback`

Companion to `ResetOscFeedback` for the MIDI feedback channel.
Forces a resend of every currently-configured MIDI feedback's
current value; does **not** deregister anything. Verified
end-to-end in BEYOND 2030 with loopMIDI + Protokol: with a
feedback binding configured on the Live Control Brightness slider,
each `ResetMidiFeedback` call emits one MIDI message per binding
carrying the property's current value (Brightness at 49% emitted
DATA2 = 62, matching the standard 0..100 → 0..127 conversion), and
the binding continues to emit on subsequent slider movements after
the call.

**There is no PangoScript-side `RegisterMidiFeedback` command.**
Verified by parser-shape probe in BEYOND 2030: the candidate names
`RegisterMidiFeedback`, `MidiFeedback`, `RegisterMidi`, and
`SetMidiFeedback` all fail with "Code contain errors". MIDI
feedback bindings are configured per-property in BEYOND's UI - the
per-control "Learn / MIDI message / Enable MIDI feedback" dialog
(reachable from the right-click menu on most controls and Live
Control sliders). PangoScript can only **trigger a resend** of
those UI-configured bindings via `ResetMidiFeedback`; it cannot
add, remove, or modify them.

Workflow for setting up MIDI feedback on a property:

1. Right-click the property's control in BEYOND (e.g. the Live
 Control Brightness slider).
2. Open the MIDI binding dialog ("Size X 'loopMIDI Port'" or
 similar, depending on the control).
3. Optionally use the "Learn" button to capture incoming MIDI for
 binding the input direction.
4. Tick "Enable MIDI feedback" and configure the outgoing message
 bytes.
5. Click OK. The binding persists with the workspace.

From PangoScript, then call `ResetMidiFeedback` to force a fresh
re-emit of all such bindings - useful as an initial sync after a
controller (re)connects, or as a polling fallback.

Example:

    ResetMidiFeedback

Safety: T2 - same shape as ResetOscFeedback, on the MIDI bus.

Related: `ResetOscFeedback`.

### ResetOscFeedback

Signature: `ResetOscFeedback`

**Republish (refresh) every currently-registered OSC feedback's
current value**, regardless of whether the underlying property has
changed. Confirmed by live BEYOND testing: every call retransmits
the entire registered set out the OSC bus. Pangolin Wiki: "Force
sending the feedback of all OSC messages. BEYOND OSC feedback based
on checking specified variables and sending the OSC message when the
value changes."

This command's name is misleading - **it does not deregister
feedback subscriptions**. It is a refresh / republish, not a reset
of the registration list. Attempts to use it as cleanup (to undo
prior `RegisterOscFeedback` calls) will not work. Treat it strictly
as a "publish current state now" command.

Use cases:

- Initial sync - after a UI client connects, call `ResetOscFeedback`
 so the client receives the current value of every registered
 property without waiting for the next change.
- Polling fallback - if a client suspects it missed an update, ask
 for the full current state.

For actual cleanup of registrations, the only reliable mechanisms
are: restart BEYOND, or use a per-run address prefix that downstream
consumers stop caring about.

Example:

    ResetOscFeedback // resend every registered feedback value

Safety: T2 - emits OSC traffic to every registered address; can be
loud on the network. No direct laser output.

Related: `RegisterOscFeedback`, `ResetMidiFeedback`.

### SetChannelToChannelRatio

Signature: `SetChannelToChannelRatio <ratio>`

Set the global channel-to-channel contribution ratio. Runtime
readback confirms this writes `Master.ChannelToChannelRatio`.

Parameters:
- ratio (integer, 0..100): global contribution percentage.

Example:

    SetChannelToChannelRatio 50 // 50% channel-to-channel contribution

Safety: T2 - changes routing config; downstream effects react to the
new mix.

Related: `SetDmxToChannelRatio`, `SetFFTToChannelRatio`, `ChannelOut`.

### SetDmxEditorChannel

Signature: `SetDmxEditorChannel <channel>, <value>`

Set the DMX slider value in BEYOND's QuickDMX editor UI for the
given channel. Useful for binding MIDI controllers (or any external
input) to the QuickDMX editor sliders without having to script the
full DMX output.

Parameters:
- channel (integer, 1..2048): QuickDMX channel index.
- value (integer, 0..255): slider value.

Example:

    SetDmxEditorChannel 1, 128 // set QuickDMX editor ch1 slider to 128

Safety: T1 - sets a UI slider value; the slider's downstream effect
on actual DMX output depends on QuickDMX editor configuration.

Property mapping: no direct shipped Object Tree path is currently
known. A probe against `DmxOutput.N` and `DmxMasters.N.Value` did not
show a durable readback target for the QuickDMX editor slider.

Related: `DmxOut`.

## Universe view

### SetDmxToChannelRatio

Signature: `SetDmxToChannelRatio <ratio>`

Set the global DMX-to-channel contribution ratio. Runtime readback
confirms this writes `Master.DmxToChannelRatio`.

Parameters:
- ratio (integer, 0..100): global contribution percentage.

Example:

    SetDmxToChannelRatio 100 // full DMX-to-channel contribution

Safety: T2 - changes routing config; downstream effects react.

Related: `SetChannelToChannelRatio`, `WaitForDmx`.

### SetEffectChannelAction

Signatures (verified 2026-05-06):

- `SetEffectChannelAction <value>` - single-arg, writes channel 1
- `SetEffectChannelAction <value>, <index>` - two-arg, writes channel `<index>`

Set the **effect-channel action parameter** for one of 8 channels.
BEYOND documentation: "Defines channel action parameter
which impact channel calculation." The parameter is a numeric
intensity / mix amount, not an enum selector.

**Important corrections from earlier overlay** (verified at runtime
in BEYOND 2030):

- The parameter order is **`(value, index)`**, NOT
 `(action, value)`. Earlier overlay had this backwards - scripts
 that used the old order were sending value as the index.
- The documentation lists the index range as "0 to 7", but **runtime
 requires `1..8`** (1-based). Index 0, negatives, and values > 8
 are all silently dropped.
- The value parameter clamps to `[0, 100]`: `<0` → 0, `>100` → 100.
- `SetEffectChannelAction <value>` (single-arg) writes channel 1.
- `Master.EffectChannelAction` (unindexed property) is a **mirror
 of channel 1**, not a separate register.

Parameters:
- value (number, 0..100): effect action intensity. Out-of-range
 values silently clamp.
- index (integer, 1..8): channel index. Optional; defaults to 1
 (i.e. single-arg form writes channel 1). Out-of-range silently
 dropped.

Example:

    SetEffectChannelAction 50 // ch1 = 50 (single-arg form)
    SetEffectChannelAction 75, 3 // ch3 = 75
    SetEffectChannelAction 200, 8 // ch8 = 100 (value clamped)
    SetEffectChannelAction 50, 0 // silently dropped (idx 0 invalid)
    SetEffectChannelAction 50, 9 // silently dropped (idx > 8 invalid)

Readback paths: `Master.EffectChannelAction1..8`. The unindexed
`Master.EffectChannelAction` mirrors channel 1.

Safety: T2 - changes effect-channel binding; downstream effects
react.

Related: `ChannelOut`.

### SetFFTToChannelRatio

Signature: `SetFFTToChannelRatio <ratio>`

Set the global FFT-to-channel contribution ratio. Runtime readback
confirms this writes `Master.FFTToChannelRatio`.

Parameters:
- ratio (integer, 0..100): global contribution percentage.

Example:

    SetFFTToChannelRatio 100 // full FFT-to-channel contribution

Safety: T2 - changes routing config.

Related: `SetDmxToChannelRatio`, `WaitForAudioBeat`.

### SetVdgPlugin

Signature: `SetVdgPlugin <state>`

Enable, disable, or toggle the **Virtual DJ (VDJ)
clock-for-BPM-control** plugin. **Verified 2026-05-06**: writes
`Master.EnableVdjClockForBpmControl`. When enabled, BEYOND's
master BPM clock is driven by the Virtual DJ integration - every
Timer-beat-driven cue / FX downstream is affected.

Per BEYOND export comment: `SetVdgPlugin 1 | 0 disable, 1 enable,
2 toggle`.

**Naming note**: the command's "Vdg" is a typo of "Vdj" (Virtual
DJ). Same typo pattern appears inside BEYOND's own
`SetChannelToChannelRatio` documentation, which describes the
channel formula using both "Vdj" and "VdgValue"
interchangeably. The actual write target is the Vdj-prefixed
property `Master.EnableVdjClockForBpmControl` - confirming the
VDJ identification.

Parameters:
- state (integer, 0..2): `0` = disable, `1` = enable, `2` =
 toggle. The standard checkbox-state convention used by
 `EnableDmxIn`, `SetPhysicsCheckbox`, `ResyncByCueClick`, etc.
 Toggle (verified 2026-05-06) flips the current state correctly:
 0 → 1 → 0.

Example:

    SetVdgPlugin 1 // enable (export example)
    SetVdgPlugin 0 // disable
    SetVdgPlugin 2 // toggle current state

Safety: T2 - toggling the BPM clock source affects every
beat-synced cue / FX downstream. If a show has scripts or cues
locked to Master.BPM, switching the plugin on/off mid-show may
shift those triggers.

Related: `Master.EnableVdjClockForBpmControl` (direct property
assignment), `Master.EnableMidiClockForBpmControl` (parallel
plugin for MIDI clock source - different command pending).

### SetVdjToChannelRatio

Signature: `SetVdjToChannelRatio <ratio>`

Set the global VirtualDJ-to-channel contribution ratio. Runtime
readback confirms this writes `Master.VdjToChannelRatio`.

Parameters:
- ratio (integer, 0..100): global contribution percentage.

Example:

    SetVdjToChannelRatio 100

Safety: T2 - changes routing config.

Related: `SetDmxToChannelRatio`, `SetFFTToChannelRatio`.

## Effect channel control

### StartFb4Discovery

Signature: `StartFb4Discovery [<ignored>]`

Trigger an FB4 discovery scan and auto-reconnect any reachable FB4
hardware. **Verified 2026-05-06** via a disconnect-and-reconnect
cycle against a live FB4: the optional integer
parameter is **ignored** - `StartFb4Discovery 0`, `StartFb4Discovery
1`, and bare `StartFb4Discovery` all produce identical behavior
(reconnection within ~2.5s when the FB4 is reachable and discovery
is enabled). The export's example value `StartFb4Discovery 0` is
just a placeholder; treat the command as effectively zero-arg.

**Important sequencing - does NOT recover by itself after
StopFb4Discovery.** `StopFb4Discovery` disconnects FB4s AND
persistently disables discovery. To restore a Stopped FB4, the
correct sequence is:

 Fb4DiscoveryMode 1 // re-enable discovery (auto)
 StartFb4Discovery // trigger scan; reconnects in ~2.5s

Without the `Fb4DiscoveryMode` step, `StartFb4Discovery` alone (any
form) will not reconnect. This was verified by leaving the discovery
mode unset after `StopFb4Discovery` - `StartFb4Discovery 0` /
`StartFb4Discovery 1` standalone both timed out after 30+ seconds.

Parameters:
- ignored (integer, optional): runtime ignores the value. Provided
 for compatibility with scripts authored from the BEYOND export's
 `StartFb4Discovery 0` example.

Example:

    StartFb4Discovery // preferred form (no arg)
    StartFb4Discovery 0 // also valid; arg ignored
    Fb4DiscoveryMode 1 / StartFb4Discovery // recovery from StopFb4Discovery

Safety: T2 - triggers a network discovery scan. Reachable FB4s
auto-connect and become available for laser-output routing.
Existing connected devices are unaffected.

Related: `StopFb4Discovery`, `Fb4DiscoveryMode`.

### StopFb4Discovery

Signature: `StopFb4Discovery`

Disable FB4 auto-discovery and disconnect currently-connected FB4
devices. Per BEYOND export comment: "disconnect FB4 and disable
auto connect." **Verified 2026-05-06** via OSC readback against
`FB4_XXXXX.Connected`: the connection state drops from 1 → 0
within ~100ms of the call. FB3 devices in the same workspace
(`FB3_XXXXX.Connected`) are unaffected, confirming the command
targets only FB4 hardware.

The "disable auto connect" half of the export comment is also
real and persistent: a subsequent bare `StartFb4Discovery` (any
arg form) will NOT reconnect by itself. To recover, set
`Fb4DiscoveryMode 1` first, then call `StartFb4Discovery`. See
the `StartFb4Discovery` entry above for the verified recovery
sequence.

Calling this mid-show disconnects every active FB4, killing laser
output through them. Not a routine operation.

Example:

    StopFb4Discovery // disconnect & disable

    // Recovery sequence:
    Fb4DiscoveryMode 1
    StartFb4Discovery

Safety: T3 - disconnects FB4 hardware; affects laser output
through any FB4-routed projector. Tier-bumping note: closer to T3
in practice than T2 since disconnection has immediate output
impact.

Related: `StartFb4Discovery`, `Fb4DiscoveryMode`.
