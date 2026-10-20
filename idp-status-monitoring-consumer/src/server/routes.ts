//

import { log } from "#src/log";
import type { MaybePromise } from "bun";
import type { ServerContext } from "./context";

type BunCallback = (req: Bun.BunRequest) => MaybePromise<Response>;

const handler = (cb: BunCallback): BunCallback => {
  return async (req: Bun.BunRequest) => {
    const start = performance.now();
    const res = await cb(req);
    log("info", {
      duration_ms: Math.round(performance.now() - start),
      event: "http.request",
      method: req.method,
      path: new URL(req.url).pathname,
      status: res.status,
    });
    return res;
  };
};

export function createRoutes(context: ServerContext) {
  return {
    "/livez": handler(() => Response.json({ status: "alive" })),

    "/startupz": handler(() => Response.json({ status: "started" })),

    "/healthz": handler(() =>
      Response.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),
    ),

    "/readyz": handler(() => {
      const isConnected = context.connection?.isConnected() ?? false;
      return Response.json(
        {
          status: isConnected ? "ready" : "not ready",
          amqp: isConnected ? "connected" : "disconnected",
        },
        { status: isConnected ? 200 : 503 },
      );
    }),

    "/readyz/idps": handler(async () => {
      const { config } = context;
      const requests = Object.entries(
        config.MAP_FI_NAMES_TO_URL as Record<string, string>,
      ).map(async ([name, url]) => {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(config.HTTP_TIMEOUT),
            headers: new Headers({
              Accept: config.HTTP_ACCEPT,
              "User-Agent": config.HTTP_USER_AGENT,
            }),
          });
          return { name, url, status: response.status };
        } catch (e) {
          log("warn", { error: e, event: "idp.unreachable", idp: name, url });
          return {
            name,
            url,
            status: 0,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      });
      const responses = await Promise.all(requests);
      const successfuls = responses.filter(
        ({ status }) => status >= 200 && status < 400,
      );
      const unsucessfuls = responses.filter(
        ({ status }) => status < 200 || status >= 400,
      );
      return Response.json({ successfuls, unsucessfuls });
    }),
  };
}
