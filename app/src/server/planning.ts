import { HttpError, json, now, readJson } from "./http.js";
import { cleanText, ContextRequest, PlanRequest } from "./schemas.js";

export async function saveContext(request: Request, env: Env): Promise<Response> {
  const body = await readJson(
    request,
    ContextRequest,
    "Choose valid difficulty, level cap and spoiler settings",
  );
  const context = {
    ...body,
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
  for (const member of body.members) {
    if (member.kind === "build") {
      const ids = member.moveIds.filter((id) => id !== null);
      if (new Set(ids).size !== ids.length)
        throw new HttpError({
          status: 400,
          message: "Proposed moves must be distinct; unknown slots may be left blank.",
        });
    }
  }
  const ids = body.members.flatMap((member) => (member.kind === "owned" ? [member.pokemonId] : []));
  const shortlistIds = body.shortlistIds;
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
