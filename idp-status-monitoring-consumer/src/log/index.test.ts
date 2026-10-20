import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { log, set_log_level } from "./index";

describe("log", () => {
  const debug = spyOn(console, "debug").mockImplementation(() => {});
  const error = spyOn(console, "error").mockImplementation(() => {});
  const info = spyOn(console, "info").mockImplementation(() => {});

  afterEach(() => {
    set_log_level("info");
    debug.mockClear();
    error.mockClear();
    info.mockClear();
  });

  afterAll(() => {
    debug.mockRestore();
    error.mockRestore();
    info.mockRestore();
  });

  it("drops debug lines at the default info level", () => {
    log("debug", { event: "rpc.received" });
    log("info", { event: "http.request" });
    expect(debug).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      '{"level":"info","event":"http.request"}',
    );
  });

  it("emits debug lines once LOG_LEVEL is debug", () => {
    set_log_level("debug");
    log("debug", { event: "rpc.received", idp: "fenris" });
    expect(debug).toHaveBeenCalledWith(
      '{"level":"debug","event":"rpc.received","idp":"fenris"}',
    );
  });

  it("keeps an Error message on its single line", () => {
    const failure = new TypeError("fetch failed");
    failure.stack = "TypeError: fetch failed\n    at fetch";
    log("error", { error: failure, event: "idp.unreachable" });
    expect(error).toHaveBeenCalledWith(
      '{"level":"error","error":{"message":"fetch failed","name":"TypeError","stack":"TypeError: fetch failed\\n    at fetch"},"event":"idp.unreachable"}',
    );
  });
});
