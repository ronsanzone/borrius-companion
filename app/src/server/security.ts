import { createRemoteJWKSet, jwtVerify } from "jose";
import { Schema } from "effect";
import { HttpError } from "./http.js";
import { first, IdRow } from "./storage.js";

// Public signing-key resolver cache only; never stores user JWTs or claims.
const ownerKeyResolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function ownerKeys(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = ownerKeyResolvers.get(teamDomain);
  if (existing) return existing;
  const keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  ownerKeyResolvers.set(teamDomain, keys);
  return keys;
}

export const hash = async (value: Uint8Array<ArrayBuffer>): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", value)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
export const hashText = (value: string): Promise<string> => hash(new TextEncoder().encode(value));
export const randomToken = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export function localRequest(request: Request, env: Pick<Env, "DEPLOYMENT_MODE">): boolean {
  return (
    env.DEPLOYMENT_MODE === "local" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  );
}

export async function requireOwner(
  request: Request,
  env: Pick<Env, "DEPLOYMENT_MODE" | "ACCESS_AUD" | "ACCESS_TEAM_DOMAIN" | "ACCESS_ALLOWED_EMAIL">,
): Promise<void> {
  if (localRequest(request, env)) return;
  if (
    env.DEPLOYMENT_MODE !== "production" ||
    !env.ACCESS_AUD ||
    !env.ACCESS_TEAM_DOMAIN ||
    !env.ACCESS_ALLOWED_EMAIL
  ) {
    throw new HttpError({ status: 503, message: "Private access is not configured" });
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new HttpError({ status: 403, message: "Sign in to your private companion" });
  try {
    const { payload } = await jwtVerify(token, ownerKeys(env.ACCESS_TEAM_DOMAIN), {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    });
    if (payload.email !== env.ACCESS_ALLOWED_EMAIL) throw new Error("Owner mismatch");
  } catch {
    throw new HttpError({ status: 403, message: "Access denied" });
  }
}

export function requireOrigin(request: Request): void {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    throw new HttpError({ status: 403, message: "Request origin is not allowed" });
  }
}

export async function rateLimit(env: Env, key: string, limit: number, seconds = 60): Promise<void> {
  const window = Math.floor(Date.now() / 1000 / seconds);
  const row = await first(
    env.DB.prepare(
      "INSERT INTO request_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    ).bind(`${key}:${window}`, (window + 2) * seconds),
    Schema.Struct({ count: Schema.Number }),
  );
  if (!row) throw new Error("Rate limit write returned no row");
  if (row.count > limit)
    throw new HttpError({ status: 429, message: "Too many requests. Try again later." });
}

export async function requireDevice(request: Request, env: Env): Promise<{ readonly id: string }> {
  const bearer = request.headers.get("authorization") || "";
  if (!/^Bearer [a-f0-9]{64}$/.test(bearer))
    throw new HttpError({ status: 401, message: "Device pairing required" });
  const device = await first(
    env.DB.prepare("SELECT id FROM devices WHERE token_hash=? AND revoked_at IS NULL").bind(
      await hashText(bearer.slice(7)),
    ),
    IdRow,
  );
  if (!device) throw new HttpError({ status: 401, message: "Device pairing expired or revoked" });
  return device;
}
