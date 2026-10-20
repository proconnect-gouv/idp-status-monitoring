import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { log, set_log_level } from "./index";

describe("log", () => {
  const info = spyOn(console, "info").mockImplementation(() => {});
  const warn = spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    set_log_level("info");
    info.mockClear();
    warn.mockClear();
  });

  afterAll(() => {
    info.mockRestore();
    warn.mockRestore();
  });

  it("drops info lines at the warn level", () => {
    set_log_level("warn");
    log("info", { event: "http.request" });
    log("warn", { event: "amqp.disconnected" });
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '{"level":"warn","event":"amqp.disconnected"}',
    );
  });
});
