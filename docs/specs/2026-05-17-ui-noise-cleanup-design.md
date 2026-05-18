# UI Noise Cleanup Design

## Goal

Remove evidence level and coverage status from all rendered surfaces in the reference site and sidebar. Remove the catalog data quality panel and coverage filter dropdown. Fix sparse parameter tables that look unfinished. Keep safety tier, "Sets property" chips, and all underlying catalog data.

## Background

Evidence level (`observed`, `documented`) and coverage status (`mapped`, `no-direct-property`, `deferred`, `unknown`) are internal knowledge-base metadata tracking our confidence in the data. They mean nothing actionable to an end user reading PangoScript documentation. Safety tier stays because it directly signals blast radius.

## Architecture

Pure UI subtraction across two surfaces (reference site bundle, sidebar webview bundle). No build script changes: all data remains in the catalog JSON. No new components or state shapes; the work is deletion of rendering paths and the `coverageStatus` filter scaffolding. CSS dead-class cleanup is part of the same pass to avoid leaving orphaned rules.

## Tech Stack

TypeScript (strict), esbuild bundles, Vitest test suite, Biome linter. CSS embedded in `media/reference/pangoscript-reference.html`.

---

## Changes by File

### `src/reference/bundle/detail.ts`

**Badge/chip removals from command detail header:**
- Delete the `COVERAGE_LABELS` constant at the top (fully unused after this cleanup).
- Delete the `Evidence: observed` chip block: `if (cmd.evidenceLevel) { chips.append(...) }` (~lines 118-126).
- Delete the `Coverage: Mapped` chip block: `const cov = cmd.coverage?.status ...; if (cov && cov !== "unknown") { chips.append(...) }` (~lines 127-132).

**Coverage callout removal:**
- Delete the `if (cmd.coverage?.notes)` block that renders an `aside.callout--coverage` (~lines 150-163). The callout header includes the coverage status label; removing the badge but keeping this block would be inconsistent.

**Evidence level from object summary strings:**
Remove the `evidenceLevel` push from each of the five summary functions:
- `objectValueSummary`: remove `if (metadata.evidenceLevel) parts.push(`evidence ${metadata.evidenceLevel}`)`
- `objectValueCardSummary`: remove `if (summary.evidenceLevel) parts.push(`evidence ${summary.evidenceLevel}`)`
- `objectReadbackSummary`: remove `if (metadata.evidenceLevel) parts.push(`evidence ${metadata.evidenceLevel}`)`
- `objectReadbackCardSummary`: remove `if (summary.evidenceLevel) parts.push(`evidence ${summary.evidenceLevel}`)`
- `objectBehaviorSummary`: remove `classification.evidenceLevel ? `evidence ${behaviorLabel(classification.evidenceLevel)}` : undefined` from the parts array

**Sparse parameter table fix in `renderForm`:**

Before rendering the `<table>`, evaluate whether any parameter carries meaningful data. A parameter is meaningful if it satisfies at least one:
- `p.type` exists and is not `"unknown"`
- `p.description` is a non-empty string
- `p.range` is defined
- `p.valueRange` is defined
- `p.acceptedValues` is a non-empty array

If no parameter in the form is meaningful, skip the table block entirely. The signature block and form description still render normally.

Implementation sketch:
```typescript
function hasAnyMeaningfulParam(params: ReferenceParameter[]): boolean {
  return params.some(
    (p) =>
      (p.type && p.type !== "unknown") ||
      p.description ||
      p.range ||
      p.valueRange ||
      (p.acceptedValues && p.acceptedValues.length > 0),
  );
}
```

In `renderForm`, wrap the table block:
```typescript
if (form.parameters.length > 0 && hasAnyMeaningfulParam(form.parameters)) {
  // ... existing table render ...
}
```

---

### `src/reference/bundle/list.ts`

**Remove from `renderCommandRow`:**
- Coverage badge block: `const cov = cmd.coverage?.status ?? "unknown"; if (cov && cov !== "unknown") { meta.append(...) }` (~lines 337-340)
- Evidence badge block: `if (cmd.evidenceLevel) { meta.append(...) }` (~lines 346-350)

**Remove toolbar coverage dropdown:**
- Delete `COVERAGE_LABELS` and `COVERAGE_BADGE_CLASS` constants (now fully unused).
- Delete `coverageSelect` element construction and `toolbar.append(coverageSelect)`.
- Remove `coverageSelect.value = ""` from the `clearBtn` click block.
- Remove `coverageSelect.hidden/disabled` and `coverageSelect.value` sync from `refreshToolbarChrome`.

**Remove coverage pills:**
- In `renderPills`, remove the `if (isCommands && f.coverageStatus)` block.
- In `hasAny`, remove `f.coverageStatus` from the boolean expression.

---

### `src/reference/bundle/nav.ts`

**Remove data quality panel:**
- Delete the `footer` element and all its children: the "Catalog data quality" title, the four coverage-status rows (Mapped / No direct property / Deferred / Unknown), and their click callbacks.
- Keep the `buildLine` (catalog build / generated date) by appending it directly to `root` instead of as a child of the removed `footer`. Use a simple wrapper or a `nav__build` class rather than repurposing the now-absent `nav__footer` layout.

---

### `src/reference/bundle/state.ts`

- Remove `coverageStatus: string | null` from `FilterState` interface.
- Remove `coverageStatus: null` from the `filter` literal in `setViewMode` and `clearFilters`.
- Remove the comment about clearing the coverage filter in `setViewMode`.
- Delete the `setCoverageStatus(status: string | null): void` method.
- In `filteredCommandHits`, remove:
  ```typescript
  const cov = this.filter.coverageStatus;
  // and
  if (cov) {
    const status = hit.item.coverage?.status ?? "unknown";
    if (status !== cov) return false;
  }
  ```

---

### `src/reference/bundle/router.ts`

- Remove `cov?: string` from `ParsedHash`.
- In `parseHash`, remove `"cov"` from the key whitelist (the `else if (k === "cmd" || k === "obj" || ...)` chain).
- In `buildHash`, delete `if (state.filter.coverageStatus) parts.push(...)`.
- In `apply`, delete `state.setCoverageStatus(parsed.cov ?? null)`.

---

### `src/sidebar/model/formatting.ts`

In `formatMetaLine`, remove `parts.push(`evidence: ${detail.evidenceLevel}`)`. The remaining two parts: category and `safety: ${detail.safetyTier}`: are sufficient.

---

### `src/sidebar/view/webview/objects-bundle/main.ts`

Remove `evidenceLevel` pushes from three functions:

`metadataSummary`:
```typescript
// remove:
if (summary.evidenceLevel) parts.push(summary.evidenceLevel);
```

`readbackSummary`:
```typescript
// remove:
if (summary.evidenceLevel) parts.push(summary.evidenceLevel);
```

`behaviorSummary`:
```typescript
// remove:
behaviorLabel(classification.evidenceLevel),
// from the parts array
```

---

### `media/reference/pangoscript-reference.html` (embedded CSS)

Remove the following rule groups from the `<style>` block:

**Evidence badges:**
- `.badge--evidence`
- `.badge--evidence-documented`
- `.badge--evidence-observed`

**Coverage badges:**
- `.badge--cov` (and any `.badge--cov-*` variants)
- `.badge--mapped`
- `.badge--deferred`
- `.badge--unknown`
- `.badge--no-direct-property` (if present)

**Coverage callout:**
- `.callout--coverage`
- `.callout--cov-*` variants

**Coverage dropdown:**
- `.toolbar__coverage`

**Data quality panel rows (keep `.nav__footer` and `.nav__footer-build`):**
- `.nav__footer-title`
- `.nav__footer-row`
- `.nav__footer-row:hover`
- `.nav__footer-dot`
- `.nav__footer-dot--mapped`
- `.nav__footer-dot--no-direct-property`
- `.nav__footer-dot--deferred`
- `.nav__footer-dot--unknown`
- `.nav__footer-label`
- `.nav__footer-count`

---

## What Is NOT Changing

- Safety tier badges: stay (blast radius signal).
- "Sets property" chips and "Related commands" section: stay (navigation value).
- `cmd.coverage.setsProperty` array: stays (drives the chips).
- All coverage/evidence fields in the catalog JSON: stay (no build script changes).
- `ReferenceObjectBehaviorClassification.evidenceLevel` type field: stays (data layer, only the rendering is removed).

## Error Handling

No new error paths. All removals are conditional renders that become unconditional non-renders.

## Testing

No test changes are needed. There are no tests asserting on `coverageStatus` state behavior, badge rendering, or the coverage filter path. The `hasAnyMeaningfulParam` function is pure and could have a unit test added, but given its simplicity (five OR conditions over a flat array) it is not required for this pass.

Verify with `npm run check` after all changes.
