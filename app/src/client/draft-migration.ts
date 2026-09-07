import { Schema } from "effect";
import type { PlannerDraft } from "./contracts";
const OldDraft = Schema.Struct({
  shortlist: Schema.Array(Schema.String),
  selected: Schema.Array(Schema.String),
  inverse: Schema.Boolean,
  limit: Schema.Number,
  name: Schema.String,
  activePlan: Schema.NullOr(Schema.String),
});
/** Old interpretation is confined to the one-time browser migration. */
export function migrateDraft(value: string): PlannerDraft {
  const old = Schema.decodeUnknownSync(Schema.parseJson(OldDraft))(value);
  return {
    version: 2,
    members: old.selected.map((pokemonId) => ({ kind: "owned", pokemonId })),
    shortlist: old.shortlist,
    inverse: old.inverse,
    limit: old.limit,
    name: old.name,
    activePlan: old.activePlan,
    hard: false,
  };
}
