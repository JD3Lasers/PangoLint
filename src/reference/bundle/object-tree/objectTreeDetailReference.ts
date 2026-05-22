import type { ObjectReferenceSelection, ReferenceState } from "../state";
import { buildCueTypeReference } from "./cueTypeReference";
import { buildFxEffectReference } from "./fxEffectReference";
import type { ObjectPropertyReferenceDetail } from "./objectTreeTypes";
import { buildUniverseComponentReference } from "./universeComponentReference";

export function findObjectTreeReferenceDetail(
  state: ReferenceState,
  selection: ObjectReferenceSelection,
): ObjectPropertyReferenceDetail | null {
  const reference =
    selection.section === "cue-types"
      ? buildCueTypeReference(state.catalog.objects ?? [])
      : selection.section === "universe-components"
        ? buildUniverseComponentReference(state.catalog.objects ?? [], state.catalog.universeComponents ?? [])
        : buildFxEffectReference(state.catalog.objects ?? []);
  return reference.details.find((detail) => detail.id === selection.id) ?? null;
}
