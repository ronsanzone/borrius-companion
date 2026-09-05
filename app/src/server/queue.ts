import { Data, Effect, Schema } from "effect";
import { QueueMessage } from "./schemas.js";

class QueueProcessingFailure extends Data.TaggedError("QueueProcessingFailure")<{
  cause: unknown;
}> {}

/** Cloudflare owns retry scheduling; invalid envelopes cannot become poison messages. */
export async function consumeMessage(
  message: Message<unknown>,
  process: (id: string) => Promise<void>,
): Promise<void> {
  const decoded = Schema.decodeUnknownEither(QueueMessage)(message.body);
  if (decoded._tag === "Left") {
    message.ack();
    return;
  }
  await Effect.tryPromise({
    try: () => process(decoded.right.id),
    catch: (cause) => new QueueProcessingFailure({ cause }),
  }).pipe(
    Effect.match({
      onFailure: () => message.retry({ delaySeconds: 60 }),
      onSuccess: () => message.ack(),
    }),
    Effect.runPromise,
  );
}
