import { TrainerContextSchema as ContextSchema, PlanSchema } from "../shared/types";
export { TrainerContextSchema as ContextSchema, PlanSchema } from "../shared/types";
import { Schema } from "effect";
import { SnapshotSchema, SnapshotSummarySchema, TeamMemberSchema } from "../shared/types";
export const NoteSchema = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  createdAt: Schema.String,
});
export const StateSchema = Schema.Struct({
  snapshot: Schema.NullOr(SnapshotSchema),
  snapshots: Schema.Array(SnapshotSummarySchema),
  devices: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      revokedAt: Schema.NullOr(Schema.String),
      lastSeenAt: Schema.NullOr(Schema.String),
    }),
  ),
  plans: Schema.Array(PlanSchema),
  context: ContextSchema,
  events: Schema.Array(NoteSchema),
  notes: Schema.Array(NoteSchema),
});
export type AppState = typeof StateSchema.Type;
export const PairingSchema = Schema.Struct({
  code: Schema.String,
  expiresAt: Schema.String,
  uploadUrl: Schema.String,
});
export type Pairing = typeof PairingSchema.Type;
export const ReceiptSchema = Schema.Struct({
  status: Schema.String,
  error: Schema.optional(Schema.NullOr(Schema.String)),
});
export const OkSchema = Schema.Struct({ ok: Schema.Boolean });
export const PlannerDraftSchema = Schema.Struct({
  shortlist: Schema.Array(Schema.String),
  version: Schema.Literal(2),
  members: Schema.Array(TeamMemberSchema).pipe(Schema.maxItems(6)),
  hard: Schema.Boolean,
  inverse: Schema.Boolean,
  limit: Schema.Number,
  name: Schema.String,
  activePlan: Schema.NullOr(Schema.String),
});
export type PlannerDraft = typeof PlannerDraftSchema.Type;
export const emptyState: AppState = {
  snapshot: null,
  snapshots: [],
  devices: [],
  plans: [],
  context: {
    difficulty: "unknown",
    levelCap: null,
    checkpoint: "",
    spoilerMode: "hints",
    favorites: [],
    nextBattleId: null,
    fightReveal: "types",
  },
  events: [],
  notes: [],
};
