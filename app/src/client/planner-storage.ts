import { Effect, Schema } from "effect";
import { PlannerDraftSchema, type PlannerDraft } from "./contracts";

import { migrateDraft } from "./draft-migration";
const KEY = "borrius-strategy-v2";
type DraftStorage = Pick<Storage, "getItem" | "setItem">;

/** Browser storage is optional: corruption or privacy settings cannot prevent the app loading. */
export function readPlannerDraft(storage?: DraftStorage): PlannerDraft | null {
  return Effect.try(() => {
    const target = storage ?? localStorage;
    const current = target.getItem(KEY);
    if (current !== null) return current;
    const old = target.getItem("borrius-planner");
    if (old === null) return null;
    const migrated = migrateDraft(old);
    writePlannerDraft(migrated, target);
    return JSON.stringify(migrated);
  }).pipe(
    Effect.flatMap((value) =>
      value === null
        ? Effect.succeed(null)
        : Schema.decodeUnknown(Schema.parseJson(PlannerDraftSchema))(value),
    ),
    Effect.catchAll(() => Effect.succeed(null)),
    Effect.runSync,
  );
}

/** Returns false when storage is unavailable so callers can retain the working in-memory plan. */
export function writePlannerDraft(draft: PlannerDraft, storage?: DraftStorage): boolean {
  return Effect.try(() => (storage ?? localStorage).setItem(KEY, JSON.stringify(draft))).pipe(
    Effect.as(true),
    Effect.catchAll(() => Effect.succeed(false)),
    Effect.runSync,
  );
}
