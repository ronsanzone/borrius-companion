import { Schema } from "effect";
const OptionalText = Schema.optional(Schema.NullOr(Schema.String));
export const BattleRulesSchema = Schema.Struct({
  inverse: Schema.optional(Schema.Boolean),
  notes: Schema.optional(Schema.Array(Schema.String)),
  format: Schema.optional(Schema.String),
});
export type BattleRules = typeof BattleRulesSchema.Type;
const FoeSchema = Schema.Struct({
  name: Schema.String,
  dexId: Schema.NullOr(Schema.Number),
  types: Schema.Array(Schema.String),
  moves: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      type: OptionalText,
      category: OptionalText,
    }),
  ),
  ability: OptionalText,
  item: OptionalText,
  level: Schema.optional(Schema.NullOr(Schema.Union(Schema.String, Schema.Number))),
  levelBasis: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.Array(Schema.String)),
});
export type Foe = typeof FoeSchema.Type;
const SourceSchema = Schema.Struct({ url: Schema.String, label: Schema.optional(Schema.String) });
const VariantSchema = Schema.Struct({
  team: Schema.Array(FoeSchema),
  source: Schema.optional(Schema.Union(Schema.String, SourceSchema)),
  version: Schema.optional(Schema.String),
  confidence: Schema.optional(Schema.String),
  rules: Schema.optional(BattleRulesSchema),
  trainerItems: OptionalText,
  notes: Schema.optional(Schema.Array(Schema.String)),
});
export type BattleVariant = typeof VariantSchema.Type;
const BattleSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: Schema.String,
  order: Schema.Number,
  gymNumber: Schema.optional(Schema.NullOr(Schema.Number)),
  location: Schema.optional(Schema.String),
  rules: Schema.optional(BattleRulesSchema),
  variants: Schema.Record({ key: Schema.String, value: Schema.NullOr(VariantSchema) }),
  sources: Schema.optional(Schema.Array(SourceSchema)),
});
export const BattlesSchema = Schema.Array(BattleSchema);
export type Battle = typeof BattleSchema.Type;
