import { Schema } from "effect";

export const idPattern = /^[a-zA-Z0-9_-]{8,80}$/;
export const cleanText = (value: string, max = 120): string => value.trim().slice(0, max);
const OptionalText = Schema.optionalWith(Schema.String, { default: () => "" });
const MemberId = Schema.String.pipe(Schema.maxLength(100));
export const PairRequest = Schema.Struct({ code: OptionalText, name: OptionalText });
export const NoteRequest = Schema.Struct({
  text: OptionalText,
  snapshotId: Schema.optional(Schema.NullOr(Schema.String)),
});
export const PlanRequest = Schema.Struct({
  id: Schema.optional(Schema.String.pipe(Schema.pattern(idPattern))),
  name: Schema.String.pipe(Schema.filter((value) => value.trim().length > 0)),
  memberIds: Schema.Array(MemberId).pipe(Schema.maxItems(6)),
  shortlistIds: Schema.optional(Schema.NullOr(Schema.Array(MemberId).pipe(Schema.maxItems(24)))),
  inverse: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  hardLimit: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  weaknessLimit: Schema.Int.pipe(Schema.between(0, 6)),
});
export const ContextRequest = Schema.Struct({
  difficulty: Schema.Literal("unknown", "Vanilla", "Difficult", "Expert", "Insane"),
  spoilerMode: Schema.Literal("hints", "full"),
  levelCap: Schema.NullOr(Schema.Int.pipe(Schema.between(1, 100))),
  checkpoint: OptionalText,
  favorites: Schema.optionalWith(
    Schema.Array(Schema.String.pipe(Schema.maxLength(99))).pipe(Schema.maxItems(100)),
    { default: () => [] },
  ),
  nextBattleId: Schema.optional(
    Schema.NullOr(Schema.String.pipe(Schema.pattern(/^[a-z0-9-]{1,100}$/))),
  ),
  fightReveal: Schema.optional(Schema.Literal("types", "team", "full")),
});
export const PreviousFightContext = Schema.Struct({
  nextBattleId: Schema.optional(Schema.NullOr(Schema.String)),
  fightReveal: Schema.optional(Schema.Literal("types", "team", "full")),
});
export const QueueMessage = Schema.Struct({ id: Schema.String });
