import { Schema } from "effect";
import { HttpError, json, now, readJson } from "./http.js";
import { first, JsonDataRow } from "./storage.js";
import { cleanText, ContextRequest, PlanRequest, PreviousFightContext } from "./schemas.js";

export async function saveContext(request: Request, env: Env): Promise<Response> {
  const body = await readJson(
    request,
    ContextRequest,
    "Choose valid difficulty, level cap and spoiler settings",
  );
  const oldSetting = await first(
    env.DB.prepare("SELECT data FROM settings WHERE id='context'"),
    JsonDataRow,
  );
  const oldContext = oldSetting
    ? Schema.decodeUnknownSync(Schema.parseJson(PreviousFightContext))(oldSetting.data)
    : {};
  const context = {
    ...body,
    nextBattleId:
      body.nextBattleId === undefined ? (oldContext.nextBattleId ?? null) : body.nextBattleId,
    fightReveal: body.fightReveal ?? oldContext.fightReveal ?? "types",
    checkpoint: cleanText(body.checkpoint, 300),
  };
  await env.DB.prepare(
    "INSERT INTO settings(id,data) VALUES ('context',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  )
    .bind(JSON.stringify(context))
    .run();
  return json(context);
}

export async function savePlan(request: Request, env: Env): Promise<Response> {
  const body = await readJson(
    request,
    PlanRequest,
    "Choose a name, valid weakness limit, and up to six distinct Pokémon",
  );
  const ids = body.memberIds;
  const shortlistIds = body.shortlistIds ?? ids;
  if (
    new Set(ids).size !== ids.length ||
    new Set(shortlistIds).size !== shortlistIds.length ||
    ids.some((id) => !shortlistIds.includes(id))
  ) {
    throw new HttpError({
      status: 400,
      message: "Shortlist must contain the active team and up to 24 distinct Pokémon",
    });
  }
  const plan = {
    ...body,
    id: body.id ?? crypto.randomUUID(),
    name: cleanText(body.name, 80),
    shortlistIds,
    updatedAt: now(),
  };
  await env.DB.prepare(
    "INSERT INTO plans(id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
  )
    .bind(plan.id, JSON.stringify(plan), plan.updatedAt)
    .run();
  return json(plan);
}
