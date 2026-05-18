---
category: Virtual LJ
order: 8
---
# Virtual LJ

Virtual LJ commands drive BEYOND's automatic cue-rotation engine, which cycles through cues on a beat or time interval without operator intervention. Commands cover enabling/disabling VLJ, setting the advance mode, and configuring beat or time intervals.

## Commands

### VirtualLJ

Signature: `VirtualLJ <state>`

Enable, disable, or toggle the Virtual LJ ("Live Jockey") subsystem
 - BEYOND's automated cue-mixing assistant. Per Pangolin Wiki (entry
0055): "Toggle Virtual LG" (sic - wiki typo for "LJ").

Parameters:
- state (integer | constant, 0..2): 0 = OFF, 1 = ON, 2 = TOGGLE.

Example:

    VirtualLJ ON
    VirtualLJ OFF
    VirtualLJ Toggle

Safety: T2 - enabling Virtual LJ may automatically start cues.

Related: `VLJFX`, `ClickFxVlj`.

### VLJFX

Signature: `VLJFX <fxLayer>, <state>`

Toggle the state of an FX-VLJ layer (1..8). Per Pangolin Wiki (entry
0069): "Toggle state of 1st FX layer" - the wiki's description
narrows the meaning to layer 1, but the BEYOND export comment makes
clear the parameter is `index of FX-VLJ 1..8`.

Parameters:
- fxLayer (integer, 1..8): FX-VLJ layer index.
- state (integer | constant, 0..2): 0 = OFF, 1 = ON, 2 = TOGGLE.

Example:

    VLJFX 1, Toggle
    VLJFX 5, ON

Safety: T2 - affects FX-VLJ playback state.

Property mapping: no direct shipped Object Tree mapping is known for
the FX-VLJ layer state.

Related: `VirtualLJ`, `ClickFxVlj`.

## Tab mode selectors

These commands set which Live Control destination is active in the
named UI tab. They drive the in-tab "Master / Cue / Zone / ProTrack"
toolbar above the relevant tab - separate from Live Control routing
in scripts (`ControlMaster`, etc., see
[selecting-live-control.md](./selecting-live-control.md)).
