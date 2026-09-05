import { Data, Effect, Schema } from "effect";

/** Expected HTTP failures remain separate from unexpected infrastructure failures. */
export class HttpError extends Data.TaggedError("HttpError")<{
  status: number;
  message: string;
}> {}

export class RequestFailure extends Data.TaggedError("RequestFailure")<{
  cause: unknown;
}> {}

export const json = <A>(value: A, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const now = (): string => new Date().toISOString();

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- This is the schema validation boundary for untrusted HTTP input.
export function decode<A, I>(schema: Schema.Schema<A, I>, value: unknown, message: string): A {
  const decoded = Schema.decodeUnknownEither(schema)(value);
  if (decoded._tag === "Left") throw new HttpError({ status: 400, message });
  return decoded.right;
}

export async function readBody(request: Request, max: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length") || 0) > max) {
    throw new HttpError({ status: 413, message: "Request is too large" });
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        throw new HttpError({ status: 413, message: "Request is too large" });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export async function readJson<A, I>(
  request: Request,
  schema: Schema.Schema<A, I>,
  message = "Invalid request",
  max = 16384,
): Promise<A> {
  const bytes = await readBody(request, max);
  return decode(Schema.parseJson(schema), new TextDecoder().decode(bytes), message);
}

/** Run at the Worker fetch boundary; never expose internal exception messages. */
export function respond(operation: () => Promise<Response>): Promise<Response> {
  return Effect.tryPromise({
    try: operation,
    catch: (cause) => (cause instanceof HttpError ? cause : new RequestFailure({ cause })),
  }).pipe(
    Effect.catchTag("HttpError", (error) =>
      Effect.succeed(json({ error: error.message }, error.status)),
    ),
    Effect.catchTag("RequestFailure", () => {
      console.error(JSON.stringify({ event: "request.failed" }));
      return Effect.succeed(json({ error: "Request failed. Please retry." }, 500));
    }),
    Effect.map(secure),
    Effect.runPromise,
  );
}

export function secure(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("strict-transport-security", "max-age=31536000");
  headers.set("x-frame-options", "DENY");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://raw.githubusercontent.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  return new Response(response.body, { status: response.status, headers });
}
