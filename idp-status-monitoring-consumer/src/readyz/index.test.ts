import { afterAll, describe, expect, it } from "bun:test";
import { diagnose_idp, readyz_checks } from "./index";

const idp = Bun.serve({
  port: 0,
  routes: {
    "/empty": () => new Response(null, { status: 200 }),
    "/hanging-body": () =>
      new Response(
        new ReadableStream({
          pull: () => new Promise(() => {}),
          start: (controller) => controller.enqueue(new Uint8Array([123])),
        }),
        { headers: { "content-type": "application/json" } },
      ),
    "/html": () =>
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      }),
    "/invalid-json": () =>
      new Response("{", { headers: { "content-type": "application/json" } }),
    "/json": () => Response.json({ status: "ok" }),
    "/problem-json": () =>
      new Response("{}", {
        headers: { "content-type": "application/problem+json" },
      }),
    "/server-error": () => Response.json({}, { status: 500 }),
    "/slow": () => new Promise<Response>(() => {}),
  },
});

const closed = Bun.serve({ fetch: () => new Response(), port: 0 });
const closed_url = closed.url.href;
closed.stop(true);

afterAll(() => idp.stop(true));

const config = {
  HTTP_ACCEPT: "*/*",
  HTTP_TIMEOUT: 200,
  HTTP_USER_AGENT: "test-agent",
  MAP_FI_NAMES_TO_URL: {
    closed: closed_url,
    ...Object.fromEntries(
      [
        "empty",
        "hanging-body",
        "html",
        "invalid-json",
        "json",
        "problem-json",
        "server-error",
        "slow",
      ].map((name) => [name, new URL(`/${name}`, idp.url).href]),
    ),
  },
};

describe("diagnose_idp", () => {
  it("passes every check on a JSON response", async () => {
    expect(await diagnose_idp("json", config)).toEqual({
      checks: [
        { detail: undefined, name: "dns", ok: true },
        { detail: undefined, name: "connect", ok: true },
        { detail: "200", name: "http", ok: true },
        {
          detail: "application/json;charset=utf-8, 15B",
          name: "response",
          ok: true,
        },
        { detail: undefined, name: "json", ok: true },
        {
          detail: expect.stringMatching(/^\d+ms$/),
          name: "response-time",
          ok: true,
        },
      ],
      status: 200,
    });
  });

  it("accepts a +json media type", async () => {
    expect(await diagnose_idp("problem-json", config)).toMatchObject({
      status: 200,
    });
  });

  it("returns 404 for an unknown IdP without fetching", async () => {
    expect(await diagnose_idp("unknown", config)).toEqual({
      checks: [{ detail: "unknown", name: "idp", ok: false }],
      status: 404,
    });
  });

  it("fails connect on a closed port", async () => {
    expect(await diagnose_idp("closed", config)).toEqual({
      checks: [
        { detail: undefined, name: "dns", ok: true },
        {
          detail: expect.stringMatching(/^(ConnectionRefused|ECONNREFUSED)$/),
          name: "connect",
          ok: false,
        },
      ],
      status: 503,
    });
  });

  it("fails response-time alone when headers never come", async () => {
    expect(await diagnose_idp("slow", config)).toEqual({
      checks: [
        { detail: "timeout after 200ms", name: "response-time", ok: false },
      ],
      status: 503,
    });
  });

  it("keeps the reached checks when the body times out", async () => {
    expect(await diagnose_idp("hanging-body", config)).toEqual({
      checks: [
        { detail: undefined, name: "dns", ok: true },
        { detail: undefined, name: "connect", ok: true },
        { detail: "200", name: "http", ok: true },
        { detail: "timeout after 200ms", name: "response-time", ok: false },
      ],
      status: 503,
    });
  });

  it("stops at http on a 500", async () => {
    expect(await diagnose_idp("server-error", config)).toEqual({
      checks: [
        { detail: undefined, name: "dns", ok: true },
        { detail: undefined, name: "connect", ok: true },
        { detail: "500", name: "http", ok: false },
      ],
      status: 503,
    });
  });

  it("fails response on an empty body", async () => {
    expect((await diagnose_idp("empty", config)).checks.at(-1)).toEqual({
      detail: "empty body",
      name: "response",
      ok: false,
    });
  });

  it("fails response on a non-JSON content type, before parsing", async () => {
    expect((await diagnose_idp("html", config)).checks.at(-1)).toEqual({
      detail: "content-type text/html",
      name: "response",
      ok: false,
    });
  });

  it("fails json on an unparsable body", async () => {
    expect(
      (await diagnose_idp("invalid-json", config)).checks.slice(-2),
    ).toEqual([
      { detail: "application/json, 1B", name: "response", ok: true },
      { detail: "invalid JSON", name: "json", ok: false },
    ]);
  });
});

describe("readyz_checks on fetch errors", () => {
  const fetch_failed = (error: unknown) =>
    readyz_checks({
      observation: { error, kind: "fetch_failed" },
      timeout_ms: 5_000,
      url: "https://idp.example",
    });

  it("fails dns on ENOTFOUND", () => {
    expect(
      fetch_failed(Object.assign(new Error(), { code: "ENOTFOUND" })),
    ).toEqual([{ detail: "ENOTFOUND", name: "dns", ok: false }]);
  });

  it("fails tls after dns and connect on a certificate error", () => {
    expect(
      fetch_failed(Object.assign(new Error(), { code: "CERT_HAS_EXPIRED" })),
    ).toEqual([
      { detail: undefined, name: "dns", ok: true },
      { detail: undefined, name: "connect", ok: true },
      { detail: "CERT_HAS_EXPIRED", name: "tls", ok: false },
    ]);
  });

  it("reports an unknown code as a fetch failure", () => {
    expect(
      fetch_failed(Object.assign(new Error("boom"), { code: "EWHATEVER" })),
    ).toEqual([{ detail: "EWHATEVER: boom", name: "fetch", ok: false }]);
  });

  it("reports a TLS code on an http URL as a fetch failure", () => {
    expect(
      readyz_checks({
        observation: {
          error: Object.assign(new Error("bad"), { code: "CERT_HAS_EXPIRED" }),
          kind: "fetch_failed",
        },
        timeout_ms: 5_000,
        url: "http://idp.example",
      }),
    ).toEqual([{ detail: "CERT_HAS_EXPIRED: bad", name: "fetch", ok: false }]);
  });
});
