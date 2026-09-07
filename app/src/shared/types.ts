import { Schema } from "effect";

export const StatBlockSchema = Schema.Struct({
  hp: Schema.Number,
  atk: Schema.Number,
  def: Schema.Number,
  spe: Schema.Number,
  spa: Schema.Number,
  spd: Schema.Number,
});
export type StatBlock = typeof StatBlockSchema.Type;
export const PokemonMoveSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  type: Schema.NullOr(Schema.String),
  power: Schema.NullOr(Schema.Number),
  accuracy: Schema.NullOr(Schema.Number),
  category: Schema.String,
  pp: Schema.NullOr(Schema.Number),
  maxPp: Schema.Number,
});
export type PokemonMove = typeof PokemonMoveSchema.Type;
export const PokemonLocationSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("party"), slot: Schema.Number }),
  Schema.Struct({ kind: Schema.Literal("box"), box: Schema.Number, slot: Schema.Number }),
);
export type PokemonLocation = typeof PokemonLocationSchema.Type;
export const PokemonSchema = Schema.Struct({
  id: Schema.String,
  identityConfidence: Schema.Literal("candidate", "ambiguous"),
  speciesId: Schema.Number,
  dexId: Schema.NullOr(Schema.Number),
  name: Schema.String,
  nickname: Schema.String,
  level: Schema.Number,
  types: Schema.Array(Schema.String),
  nature: Schema.String,
  ability: Schema.String,
  item: Schema.String,
  moves: Schema.Array(PokemonMoveSchema),
  ivs: StatBlockSchema,
  evs: StatBlockSchema,
  stats: Schema.NullOr(StatBlockSchema),
  hp: Schema.NullOr(Schema.Struct({ current: Schema.Number, max: Schema.Number })),
  location: PokemonLocationSchema,
  baseStats: Schema.Array(Schema.Number),
});
export type Pokemon = typeof PokemonSchema.Type;
export const ProgressSchema = Schema.Struct({
  badges: Schema.NullOr(Schema.Number),
  isChampion: Schema.Boolean,
  money: Schema.Number,
  heartScales: Schema.NullOr(Schema.Number),
  ownedTms: Schema.Array(Schema.String),
  provenance: Schema.String,
  difficulty: Schema.NullOr(Schema.String),
  levelCap: Schema.NullOr(Schema.Number),
});
export type Progress = typeof ProgressSchema.Type;
export const ParsedSaveSchema = Schema.Struct({
  party: Schema.Array(PokemonSchema),
  boxes: Schema.Array(Schema.Struct({ box: Schema.Number, pokemon: Schema.Array(PokemonSchema) })),
  progress: ProgressSchema,
  warnings: Schema.Array(Schema.String),
  parserVersion: Schema.String,
  gameVersion: Schema.String,
});
export type ParsedSave = typeof ParsedSaveSchema.Type;
export const SnapshotSchema = Schema.Struct({
  ...ParsedSaveSchema.fields,
  id: Schema.String,
  capturedAt: Schema.String,
  receivedAt: Schema.String,
  hash: Schema.String,
  filename: Schema.String,
});
export type Snapshot = typeof SnapshotSchema.Type;
export interface CatalogSpecies {
  speciesId: number;
  dexId: number | null;
  name: string;
  types: readonly string[];
  baseStats: readonly number[];
}
export interface Catalog {
  species: CatalogSpecies[];
}
export const TrainerContextSchema = Schema.Struct({
  difficulty: Schema.String,
  levelCap: Schema.NullOr(Schema.Number),
  checkpoint: Schema.String,
  spoilerMode: Schema.String,
  favorites: Schema.Array(Schema.String),
  nextBattleId: Schema.NullOr(Schema.String),
  fightReveal: Schema.Literal("types", "team", "full"),
});
export const TeamMemberSchema = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal("owned"),
    pokemonId: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  }),
  Schema.Struct({
    kind: Schema.Literal("build"),
    speciesId: Schema.Int.pipe(Schema.positive()),
    moveIds: Schema.Array(Schema.NullOr(Schema.Int.pipe(Schema.positive()))).pipe(
      Schema.maxItems(4),
    ),
    ability: Schema.String.pipe(Schema.maxLength(100)),
    item: Schema.String.pipe(Schema.maxLength(100)),
    notes: Schema.String.pipe(Schema.maxLength(1000)),
  }),
);
export type TeamMember = typeof TeamMemberSchema.Type;
export const PlanSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  members: Schema.Array(TeamMemberSchema).pipe(Schema.maxItems(6)),
  shortlistIds: Schema.Array(Schema.String),
  inverse: Schema.Boolean,
  weaknessLimit: Schema.Number,
  hardLimit: Schema.Boolean,
  updatedAt: Schema.String,
});
export type Plan = typeof PlanSchema.Type;
export type TrainerContext = typeof TrainerContextSchema.Type;
/** A reference move can omit runtime PP and ROM-specific numeric metadata. */
export interface Move {
  name?: string;
  type?: string | null;
  category?: string | null;
  power?: number | null;
  pp?: number | null;
}
export interface Combatant {
  types: readonly string[];
  moves?: readonly Move[];
}
export interface OwnedCombatant extends Combatant {
  id: string;
  level: number;
}

export const SnapshotSummarySchema = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.String,
  receivedAt: Schema.optional(Schema.String),
  status: Schema.String,
  error: Schema.optional(Schema.NullOr(Schema.String)),
  partyNames: Schema.optional(Schema.Array(Schema.String)),
  boxCount: Schema.optional(Schema.Number),
});
export type SnapshotSummary = typeof SnapshotSummarySchema.Type;
