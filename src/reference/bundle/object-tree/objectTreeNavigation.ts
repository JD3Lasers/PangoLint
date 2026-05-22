import type { ObjectSection, ReferenceState } from "../state";
import { buildCueTypeReference } from "./cueTypeReference";
import { buildFxEffectReference } from "./fxEffectReference";
import { buildUniverseComponentReference } from "./universeComponentReference";

export interface ObjectTreeNavigationSection {
  label: string;
  section: ObjectSection;
  count: number;
}

export function buildObjectTreeNavigationSections(state: ReferenceState): ObjectTreeNavigationSection[] {
  const cueTypes = buildCueTypeReference(state.catalog.objects ?? []);
  const fxEffects = buildFxEffectReference(state.catalog.objects ?? []);
  const universeComponents = buildUniverseComponentReference(
    state.catalog.objects ?? [],
    state.catalog.universeComponents ?? [],
  );
  return [
    { label: "Schemas", section: "schemas", count: state.catalog.objects?.length ?? 0 },
    {
      label: "Universe Components",
      section: "universe-components",
      count: universeComponents.componentCount,
    },
    { label: "Cue Types", section: "cue-types", count: cueTypes.typeCount },
    { label: "FX Effects", section: "fx", count: fxEffects.effectCount },
  ];
}
