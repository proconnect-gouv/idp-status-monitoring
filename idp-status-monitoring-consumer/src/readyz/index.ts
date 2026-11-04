//

import { type Config } from "#src/config";
import { log } from "#src/log";

//

const passed = (name: string, detail?: string) =>
  ({ detail, name, ok: true }) as const;
const failed = (name: string, detail: string) =>
  ({ detail, name, ok: false }) as const;

type Check = ReturnType<typeof failed> | ReturnType<typeof passed>;

type Observation =
  | { readonly error: unknown; readonly kind: "fetch_failed" }
  | {
      readonly error: unknown;
      readonly http_status: number;
      readonly kind: "body_failed";
    }
  | {
      readonly body: Uint8Array;
      readonly content_type: string | null;
      readonly duration_ms: number;
      readonly http_status: number;
      readonly kind: "received";
    };

//

const error_property = (error: unknown, key: "code" | "message" | "name") => {
  if (typeof error !== "object" || error === null) return "";
  const value: unknown = Reflect.get(error, key);
  return typeof value === "string" ? value : "";
};

const failed_stage = (code: string) => {
  if (["EAI_AGAIN", "ENOTFOUND"].includes(code)) return "dns";
  if (["ConnectionRefused", "ECONNREFUSED", "ECONNRESET"].includes(code))
    return "connect";
  if (/CERT|SSL|TLS/.test(code)) return "tls";
  return undefined;
};

const fetch_failure_checks = ({
  error,
  timeout_ms,
  transport,
}: {
  error: unknown;
  timeout_ms: number;
  transport: readonly string[];
}): Check[] => {
  if (error_property(error, "name") === "TimeoutError") {
    return [failed("response-time", `timeout after ${timeout_ms}ms`)];
  }
  const code = error_property(error, "code");
  const stage = failed_stage(code);
  if (!stage || !transport.includes(stage)) {
    const message = error_property(error, "message") || String(error);
    return [failed("fetch", [code, message].filter(Boolean).join(": "))];
  }
  return [
    ...transport.slice(0, transport.indexOf(stage)).map((name) => passed(name)),
    failed(stage, code),
  ];
};

const body_checks = ({
  body,
  content_type,
  duration_ms,
}: Extract<Observation, { kind: "received" }>): Check[] => {
  if (body.byteLength === 0) return [failed("response", "empty body")];
  const [media_type = ""] = (content_type ?? "").split(";");
  const normalized = media_type.trim().toLowerCase();
  if (normalized !== "application/json" && !normalized.endsWith("+json")) {
    return [failed("response", `content-type ${content_type ?? "none"}`)];
  }
  const response = passed("response", `${content_type}, ${body.byteLength}B`);
  try {
    JSON.parse(new TextDecoder().decode(body));
  } catch {
    return [response, failed("json", "invalid JSON")];
  }
  return [
    response,
    passed("json"),
    passed("response-time", `${duration_ms}ms`),
  ];
};

export const readyz_checks = ({
  observation,
  timeout_ms,
  url,
}: {
  observation: Observation;
  timeout_ms: number;
  url: string;
}): Check[] => {
  const transport =
    new URL(url).protocol === "https:"
      ? ["dns", "connect", "tls"]
      : ["dns", "connect"];

  if (observation.kind === "fetch_failed") {
    return fetch_failure_checks({
      error: observation.error,
      timeout_ms,
      transport,
    });
  }

  const { http_status } = observation;
  const http =
    http_status >= 200 && http_status < 400
      ? passed("http", String(http_status))
      : failed("http", String(http_status));
  const reached = [...transport.map((name) => passed(name)), http];
  if (!http.ok) return reached;

  switch (observation.kind) {
    case "body_failed": {
      const { error } = observation;
      if (error_property(error, "name") === "TimeoutError") {
        return [
          ...reached,
          failed("response-time", `timeout after ${timeout_ms}ms`),
        ];
      }
      const message = error_property(error, "message") || String(error);
      return [...reached, failed("response", `read error: ${message}`)];
    }
    case "received":
      return [...reached, ...body_checks(observation)];
  }
};

//

const observe = async ({
  config,
  url,
}: {
  config: Pick<Config, "HTTP_ACCEPT" | "HTTP_TIMEOUT" | "HTTP_USER_AGENT">;
  url: string;
}): Promise<Observation> => {
  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: new Headers({
        Accept: config.HTTP_ACCEPT,
        "User-Agent": config.HTTP_USER_AGENT,
      }),
      signal: AbortSignal.timeout(config.HTTP_TIMEOUT),
    });
  } catch (error) {
    return { error, kind: "fetch_failed" };
  }
  try {
    const body = await response.bytes();
    return {
      body,
      content_type: response.headers.get("content-type"),
      duration_ms: Math.round(performance.now() - start),
      http_status: response.status,
      kind: "received",
    };
  } catch (error) {
    return { error, http_status: response.status, kind: "body_failed" };
  }
};

export const diagnose_idp = async (
  idp_name: string,
  config: Pick<Config, "HTTP_ACCEPT" | "HTTP_TIMEOUT" | "HTTP_USER_AGENT"> & {
    MAP_FI_NAMES_TO_URL: Record<string, string>;
  },
) => {
  const url = Object.hasOwn(config.MAP_FI_NAMES_TO_URL, idp_name)
    ? config.MAP_FI_NAMES_TO_URL[idp_name]
    : undefined;
  if (!url) {
    return { checks: [failed("idp", "unknown")], status: 404 } as const;
  }
  const checks = readyz_checks({
    observation: await observe({ config, url }),
    timeout_ms: config.HTTP_TIMEOUT,
    url,
  });
  const status = checks.every(({ ok }) => ok) ? 200 : 503;
  log(status === 200 ? "info" : "warn", {
    checks,
    event: "idp.diagnosed",
    idp: idp_name,
    status,
    url,
  });
  return { checks, status } as const;
};
