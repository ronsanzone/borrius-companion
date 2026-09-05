import { Schema } from "effect";
const EvolutionSchema = Schema.Struct({
  method: Schema.String,
  parameter: Schema.String,
  target: Schema.Number,
  extra: Schema.String,
});
export type Evolution = typeof EvolutionSchema.Type;
const DexSpeciesSchema = Schema.Struct({
  speciesId: Schema.Number,
  dexId: Schema.Number,
  name: Schema.String,
  types: Schema.Array(Schema.String),
  abilities: Schema.Array(Schema.String),
  hiddenAbility: Schema.NullOr(Schema.String),
  baseStats: Schema.Array(Schema.Number),
  symbol: Schema.String,
  learnset: Schema.Array(Schema.Struct({ level: Schema.Number, moveId: Schema.Number })),
  eggMoves: Schema.Array(Schema.Number),
  machineMoves: Schema.Array(Schema.Number),
  tutorMoves: Schema.Array(Schema.Number),
  evolutions: Schema.Array(EvolutionSchema),
});
const DexMoveSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.NullOr(Schema.String),
  category: Schema.String,
  power: Schema.NullOr(Schema.Number),
  accuracy: Schema.NullOr(Schema.Number),
});
export const DexSchema = Schema.Struct({
  species: Schema.Array(DexSpeciesSchema),
  moves: Schema.Record({ key: Schema.String, value: DexMoveSchema }),
  source: Schema.Struct({ notice: Schema.String, url: Schema.String }),
});
export type Dex = typeof DexSchema.Type;
export type DexSpecies = typeof DexSpeciesSchema.Type;
export interface DexFilters {
  query?: string;
  type?: string;
  ownedOnly?: boolean;
  ownedIds?: readonly number[];
}
export const moveSections: readonly [
  keyof Pick<DexSpecies, "machineMoves" | "tutorMoves" | "eggMoves">,
  string,
][] = [
  ["machineMoves", "TM / HM"],
  ["tutorMoves", "Tutor"],
  ["eggMoves", "Egg"],
];
