import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { checkIdpStatus } from "./index";

describe("checkIdpStatus", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  const baseConfig = {
    MAP_FI_NAMES_TO_URL: {
      "idp-test": "https://idp-test.example.com",
    },
    HTTP_TIMEOUT: 5000,
    HTTP_ACCEPT: "text/html",
    HTTP_USER_AGENT: "test-agent",
  };

  beforeEach(() => {
    fetchSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should return 200 when IDP responds with 200", async () => {
    fetchSpy.mockResolvedValue({ status: 200 });

    const status = await checkIdpStatus("idp-test", baseConfig);

    expect(status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp-test.example.com",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("should return actual status code from IDP response", async () => {
    fetchSpy.mockResolvedValue({ status: 301 });

    const status = await checkIdpStatus("idp-test", baseConfig);

    expect(status).toBe(301);
  });

  it("should return 404 when IDP is not in the map", async () => {
    const status = await checkIdpStatus("unknown-idp", baseConfig);

    expect(status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should return 500 when fetch throws an error", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));

    const status = await checkIdpStatus("idp-test", baseConfig);

    expect(status).toBe(500);
  });

  it("should pass signal timeout to fetch", async () => {
    fetchSpy.mockResolvedValue({ status: 200 });

    await checkIdpStatus("idp-test", baseConfig);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp-test.example.com",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        headers: expect.any(Headers),
      }),
    );
  });
});
