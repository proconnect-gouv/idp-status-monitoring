//

import type { MaybePromise } from "bun";
import consola from "consola";

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

export function createRoutes(
  getConnectionStatus: () => boolean,
  config: {
    MAP_FI_NAMES_TO_URL: Record<string, string>;
    HTTP_TIMEOUT: number;
    HTTP_ACCEPT: string;
    HTTP_USER_AGENT: string;
  } = {
    MAP_FI_NAMES_TO_URL: {},
    HTTP_TIMEOUT: 5000,
    HTTP_ACCEPT: "*/*",
    HTTP_USER_AGENT: "",
  },
) {
  return {
    "/health/live": handler(() => Response.json({ status: "alive" })),

    "/health/startup": handler(() => Response.json({ status: "started" })),

    "/health": handler(() =>
      Response.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),
    ),

    "/health/ready": handler(() => {
      const isConnected = getConnectionStatus();
      return Response.json(
        {
          status: isConnected ? "ready" : "not ready",
          amqp: isConnected ? "connected" : "disconnected",
        },
        { status: isConnected ? 200 : 503 },
      );
    }),

    "/health/idps": handler(async () => {
      const requests = Object.entries(config.MAP_FI_NAMES_TO_URL).map(
        async ([name, url]) => {
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
        },
      );
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
