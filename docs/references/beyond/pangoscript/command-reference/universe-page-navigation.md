---
category: Universe page navigation
order: 20
---
# Universe page navigation

Universe page navigation commands move through the BEYOND Universe view, the grid of cue banks organized by universe (fixture group). Commands include absolute jump, relative step, and mode-select for the universe view.

## Commands

The Object Tree exposes Universe control properties, but not UMax
window page state or UCenter/UEdit/UPreview/URight/UTool page
state. These commands are classified as UI navigation actions rather
than direct property setters.

### SetUEditPage

Signature: `SetUEditPage <index>`

Switch the Edit UMax panel to page `<index>`.

Parameters:
- index (integer, 1..N): page index for the Edit panel.

Example:

    SetUEditPage 1

Safety: T1: Edit panel page change only.

Related: `ToggleUEditPage`.

### SetUCenterPage

Signature: `SetUCenterPage <index>`

Switch the Center UMax panel to page `<index>`.

Parameters:
- index (integer, 1..N): page index for the Center panel.

Example:

    SetUCenterPage 1

Safety: T1: Center panel page change only.

Related: `ToggleUCenterPage`.

### SetUToolPage

Signature: `SetUToolPage <index>`

Switch the Tool UMax panel to page `<index>`.

Parameters:
- index (integer, 1..N): page index for the Tool panel.

Example:

    SetUToolPage 1

Safety: T1: Tool panel page change only.

Related: `ToggleUToolPage`.

## Relative page togglers

Despite the `Toggle` prefix, these are **relative-shift** commands.
A `<delta>` of `+1` advances one page; `-1` goes back one. The
behavior of `0` and larger positive or negative deltas is not
readback-confirmed.

Evidence note: representative values `0`, `1`, `-1`, `99`, and
`-99` were transmitted for the UMax page togglers during a supervised
probe. No Object Tree readback path exposed selected UMax window,
UCenter, UEdit, UPreview, URight, or UTool page state. Transmission
through Talk UDP is not treated as accepted-range proof.

### SetURightPage

Signature: `SetURightPage <index>`

Switch the Right UMax panel to page `<index>`.

Parameters:
- index (integer, 1..N): page index for the Right panel.

Example:

    SetURightPage 1

Safety: T1: Right panel page change only.

Related: `ToggleURightPage`.

### SetUPreviewPage

Signature: `SetUPreviewPage <index>`

Switch the Preview UMax panel to page `<index>`.

Parameters:
- index (integer, 1..N): page index for the Preview panel.

Example:

    SetUPreviewPage 1

Safety: T1: Preview panel page change only.

Related: `ToggleUPreviewPage`.

### SetUMaxPage

Signature: `SetUMaxPage <index>`

Switch the UMax window to page `<index>` (1-based).

Parameters:
- index (integer, 1..N): page index in the UMax window.

Example:

    SetUMaxPage 1 // first page
    SetUMaxPage 3 // third page

Safety: T1: UMax window page change only.

Related: `ToggleUMaxPage`, `CloseUmax` (see
[universe-page-navigation.md](./universe-page-navigation.md#closeumax)).

### ToggleUEditPage

Signature: `ToggleUEditPage <delta>`

Shift the Edit panel's page by `<delta>`.

Parameters:
- delta (integer): page shift amount. Positive values move forward,
 negative values move backward. Bounds are not readback-confirmed.

Example:

    ToggleUEditPage 1

Safety: T1: Edit panel page change only.

Related: `SetUEditPage`.

### ToggleUCenterPage

Signature: `ToggleUCenterPage <delta>`

Shift the Center panel's page by `<delta>`.

Parameters:
- delta (integer): page shift amount. Positive values move forward,
 negative values move backward. Bounds are not readback-confirmed.

Example:

    ToggleUCenterPage 1
    ToggleUCenterPage -1

Safety: T1: Center panel page change only.

Related: `SetUCenterPage`.

### ToggleUToolPage

Signature: `ToggleUToolPage <delta>`

Shift the Tool panel's page by `<delta>`.

Parameters:
- delta (integer): page shift amount. Positive values move forward,
 negative values move backward. Bounds are not readback-confirmed.

Example:

    ToggleUToolPage 1

Safety: T1: Tool panel page change only.

Related: `SetUToolPage`.

### ToggleURightPage

Signature: `ToggleURightPage <delta>`

Shift the Right panel's page by `<delta>`.

Parameters:
- delta (integer): page shift amount. Positive values move forward,
 negative values move backward. Bounds are not readback-confirmed.

Example:

    ToggleURightPage 1

Safety: T1: Right panel page change only.

Related: `SetURightPage`.

### ToggleUPreviewPage

Signature: `ToggleUPreviewPage <delta>`

Shift the Preview panel's page by `<delta>`.

Parameters:
- delta (integer): page shift amount. Positive values move forward,
 negative values move backward. Bounds are not readback-confirmed.

Example:

    ToggleUPreviewPage 1

Safety: T1: Preview panel page change only.

Related: `SetUPreviewPage`.

### ToggleUMaxPage

Signature: `ToggleUMaxPage <delta>`

Shift the UMax window's visible page by `<delta>`. Per BEYOND export
comment: "+1 means next page, -1 means previous."

Parameters:
- delta (integer): page shift amount. Positive = forward,
 negative = backward. Bounds are not readback-confirmed.

Example:

    ToggleUMaxPage 1 // next page
    ToggleUMaxPage -1 // previous page
    ToggleUMaxPage 3 // larger delta, behavior unverified

Safety: T1: UMax window page change only.

Related: `SetUMaxPage`.

### CloseUmax

Signature: `CloseUmax`

Close the UMax (custom user-interface) window. UMax is BEYOND's
custom-control-panel system, see Pangolin's UMax documentation.

Example:

    CloseUmax

Safety: T1: closes the UMax window; underlying UMax state intact.
