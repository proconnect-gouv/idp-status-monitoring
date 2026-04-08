//

import type { MaybePromise } from "bun";
import consola from "consola";
import type { ServerContext } from "./context";

type BunCallback = (req: Bun.BunRequest) => MaybePromise<Response>;

const elapsed = (start: number) => {
  const delta = Date.now() - start;
  return delta < 1000 ? `${delta}ms` : `${Math.round(delta / 1000)}s`;
};

const colorStatus = (status: number) => {
  if (!process.stdout.isTTY) return `${status}`;
  switch ((status / 100) | 0) {
    case 5:
      return `\x1b[31m${status}\x1b[0m`;
    case 4:
      return `\x1b[33m${status}\x1b[0m`;
    case 3:
      return `\x1b[36m${status}\x1b[0m`;
    case 2:
      return `\x1b[32m${status}\x1b[0m`;
    default:
      return `${status}`;
  }
};

const handler = (cb: BunCallback): BunCallback => {
  return async (req: Bun.BunRequest) => {
    const { pathname } = new URL(req.url);
    const start = Date.now();
    consola.log(`--> ${req.method} ${pathname}`);
    const res = await cb(req);
    consola.log(
      `<-- ${req.method} ${pathname} ${colorStatus(res.status)} ${elapsed(start)}`,
    );
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
          consola.warn(`xxx GET ${url}`, e);
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
