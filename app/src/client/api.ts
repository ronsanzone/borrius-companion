import { Data, Effect, Schema } from "effect";

class ApiFailure extends Data.TaggedError("ApiFailure")<{ message: string }> {}
const ErrorResponse = Schema.Struct({ error: Schema.String });

const fetchJson = Effect.fn("api.fetchJson")(function* (url: string, init: RequestInit) {
  const response = yield* Effect.tryPromise({
    try: () => fetch(url, init),
    catch: () =>
      new ApiFailure({ message: "Could not connect. Check your connection and try again." }),
  });
  const value: unknown = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () =>
      new ApiFailure({
        message: `Request failed (${response.status}). Check your connection and sign-in.`,
      }),
  });
  if (!response.ok) {
    const decoded = Schema.decodeUnknownEither(ErrorResponse)(value);
    return yield* Effect.fail(
      new ApiFailure({
        message:
          decoded._tag === "Right" ? decoded.right.error : `Request failed (${response.status}).`,
      }),
    );
  }
  return value;
});

/** Decode every response at the HTTP boundary; components only see validated data. */
export function request<A, I, Body = never>(
  schema: Schema.Schema<A, I>,
  path: string,
  method = "GET",
  body?: Body,
  filename?: string,
): Promise<A> {
  const raw = body instanceof ArrayBuffer;
  const headers: Record<string, string> = {};
  if (body !== undefined)
    headers["Content-Type"] = raw ? "application/octet-stream" : "application/json";
  if (raw) {
    headers["X-Game-Version"] = "2.1.1.1";
    headers["X-Save-Name"] = encodeURIComponent(filename ?? "Unbound.srm");
    headers["X-Capture-Id"] = crypto.randomUUID();
    headers["X-Captured-At"] = new Date().toISOString();
  }
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = raw ? body : JSON.stringify(body);
  return fetchJson("/api" + path, init).pipe(
    Effect.flatMap((value) => Schema.decodeUnknown(schema)(value)),
    Effect.catchTag("ParseError", () =>
      Effect.fail(
        new ApiFailure({
          message: "The server returned an invalid response. Refresh and try again.",
        }),
      ),
    ),
    Effect.runPromise,
  );
}
