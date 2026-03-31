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

export function createRoutes(getConnectionStatus: () => boolean) {
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
  };
}
