---
category: Files
order: 22
---
# Files

File and show management commands: open, save, and close show files; manage the recent-shows list; add SMS media; and control workspace-level persistence. These commands interact with BEYOND's File menu and show-management subsystem.

## Commands

### LoadWorkspace

Signature: `LoadWorkspace "<path>"`

Load a complete workspace from a `.BeyondWorkspace` file. Replaces
the current project state.

Parameters:
- path (string): Windows-absolute path to a `.BeyondWorkspace` file.

Example:

    LoadWorkspace "c:\Shows\MyWorkspace.BeyondWorkspace"

Safety: T2 - replaces the current project state. Operator
supervision recommended; loading a workspace mid-show would replace
running cues with the workspace's stored state.

Related: `LoadCue`, `LoadPlaylist`.

## Dialog and overlay display

### LoadCue

Signature: `LoadCue "<path>"`

Load a cue from a `.bani` (BEYOND animation) file. Per the BEYOND
export comment: "Enter correct file name!"

Parameters:
- path (string): Windows-absolute path to a `.bani` file.

Example:

    LoadCue "c:\Shows\MyAnimation.bani"

Safety: T2: adds a cue to the current workspace; visible if cue is
then triggered.

Related: `LoadPlaylist`, `LoadWorkspace`.

### LoadCueFromBlob

Signature: `LoadCueFromBlob <page>, <cue>, <stream>` (documentation)

documentation: "Command designed for special project, do not use in
PangoScript." The third `stream` argument is documented as "binary
stream, not supported by PangoScript."

Parameters:
- page (integer): zero-based page index per documentation. Upper bound
 and direct PangoScript usability are unverified.
- cue (integer): zero-based cue index per documentation. Upper bound and
 direct PangoScript usability are unverified.
- stream (binary stream): explicitly not supported by PangoScript.

Safety: T4: internal blob load that can mutate workspace cue content.

Evidence note: runtime probing is blocked until there is a disposable
blob stream, inactive target cue, and restore path. PangoLint lint
acceptance and Talk UDP transmission are not range evidence.

### LoadZoneFromBlob

Signature: `LoadZoneFromBlob <param1>, <param2>` (documentation)

documentation: "Load workspace from BLOB. This is HTTP oriented command,
do not use in script directly."

Parameters:
- param1 (integer): undocumented HTTP/blob selector. Meaning and
 bounds are unverified.
- param2 (unknown): undocumented HTTP/blob argument. Type and bounds
 are unverified.

PangoLint keeps property mapping deferred for this command. It can
replace a broad zone configuration surface, and the blob format does
not provide a small, reversible property target suitable for the
command-property ledger.

Safety: T4: internal blob load that can replace workspace or zone
content.

Evidence note: runtime probing is blocked until there is a disposable
blob payload, inactive target content, and restore path. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

### MakeSecuredFile

Signature: `MakeSecuredFile "<inputPath>", "<outputPath>", <clientHardwareSerial>`

Generate a Pangolin "secured" (encrypted / hardware-bound) file
from an input file. Per BEYOND export example:
`MakeSecuredFile "Input file name", "Output file name", ClientHardwareSerial`.

**Verified 2026-05-06**: the export's `ClientHardwareSerial` is
**NOT a built-in token** - it's just an example variable name. The
operator must declare and assign the variable explicitly:

 var ClientHardwareSerial
 ClientHardwareSerial = <hardwareSerial> // your target hardware serial
 MakeSecuredFile "in.bani", "out.bani", ClientHardwareSerial

OR pass an integer literal directly:

 MakeSecuredFile "in.bani", "out.bani", <hardwareSerial>

The verification probe declared `ClientHardwareSerial` as a `var`,
assigned a synthetic sentinel integer, and read that same sentinel
back - confirming it behaves as a regular variable. Reading the
bare identifier without prior assignment returned `0` (silent-zero
default for undefined identifier), refuting the built-in-token
hypothesis.

**Pulling the serial programmatically**: BEYOND exposes connected
hardware serials through the indexed projector namespace - 
`Projector.Count` gives the total, and each `Projector.<N>.Serial`
returns the serial as an integer. See
[midi-dmx-channel-osc-output.md](./midi-dmx-channel-osc-output.md)
for the full readback patterns. Example:

 var Serial
 var v
 v = Projector.0.Serial // pulls the first connected device's serial
 Serial = v
 MakeSecuredFile "in.bani", "out.bani", Serial

Parameters:
- inputPath (string): source file path (Windows-absolute).
- outputPath (string): destination path for the secured output.
- clientHardwareSerial (integer): hardware serial to bind to. Pass
 as a regular integer expression (variable or literal). The
 export's example name `ClientHardwareSerial` is NOT special.

Example:

    var Serial
    Serial = <hardwareSerial>
    MakeSecuredFile "C:\Shows\release.bani", "C:\Shows\release.secure", Serial

Safety: T2 - disk write; doesn't affect playback or laser output.
