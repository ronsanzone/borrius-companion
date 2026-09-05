import { browserRoutes } from "./server/browser-routes.js";
import { deviceRoutes } from "./server/device-routes.js";
import { HttpError, respond } from "./server/http.js";
import { processSnapshot, reconcile } from "./server/processing.js";
import { consumeMessage } from "./server/queue.js";
import { localRequest, requireOwner } from "./server/security.js";

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const local = localRequest(request, env);
  if (!local && url.protocol !== "https:")
    return Response.redirect(`https://${url.host}${url.pathname}${url.search}`, 308);
  if (
    (!local && url.hostname === env.UPLOAD_HOSTNAME) ||
    (local && url.pathname.startsWith("/api/device/"))
  ) {
    if (!url.pathname.startsWith("/api/device/"))
      throw new HttpError({ status: 404, message: "Not found" });
    return deviceRoutes(request, env, url);
  }
  if (!local && url.hostname !== env.DASHBOARD_HOSTNAME)
    throw new HttpError({ status: 404, message: "Not found" });
  await requireOwner(request, env);
  if (url.pathname.startsWith("/api/")) return browserRoutes(request, env, url);
  if (!["GET", "HEAD"].includes(request.method))
    throw new HttpError({ status: 405, message: "Method not allowed" });
  return env.ASSETS.fetch(request);
}

export default {
  fetch(request, env) {
    return respond(() => route(request, env));
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      await consumeMessage(message, (id) => processSnapshot(env, id));
    }
  },
  async scheduled(_controller, env) {
    await reconcile(env);
  },
} satisfies ExportedHandler<Env, unknown>;
