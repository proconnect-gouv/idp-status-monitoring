import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP TLS Diagnostic: consumer audit", () => {
  const env = createDockerEnv(import.meta.dir);

  test.serial(
    "🚀 Setup: Start Docker services",
    async () => {
      await env.start({ build: true, quiet: true });
    },
    180_000,
  );

  test.serial("❌ audit auth.unknown.darkangels - unreachable host fails at DNS", async () => {
    const result = await env.execInService(
      "test_runner",
      "consumer audit auth.unknown.darkangels",
    );
    expect(result.output).toContain("[DNS]  auth.unknown.darkangels ✗");
    expect(result.output).toContain("Cannot proceed: hostname does not resolve.");
    expect(result.output).not.toContain("[HTTP]");
    expect(result.output).not.toContain("[TLS]");
  });

  test.serial(
    "🔒 audit auth.self-signed.darkangels - self-signed cert is not authorized",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "consumer audit auth.self-signed.darkangels",
      );
      expect(result.output).toContain("[DNS]  auth.self-signed.darkangels ✓");
      expect(result.output).toContain("[HTTP] https://auth.self-signed.darkangels:443/ ✓");
      expect(result.output).toContain("[TLS]  auth.self-signed.darkangels:443 ✗  DEPTH_ZERO_SELF_SIGNED_CERT");
      expect(result.output).toContain("The certificate is self-signed (not issued by a CA).");
      expect(result.output).toContain("Subject: CN=auth.self-signed.darkangels");
      expect(result.output).toContain("NODE_EXTRA_CA_CERTS");
    },
  );

  test.serial(
    "⏰ audit auth.expired.darkangels - expired cert is not authorized",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "consumer audit auth.expired.darkangels",
      );
      expect(result.output).toContain("[DNS]  auth.expired.darkangels ✓");
      expect(result.output).toContain("[HTTP] https://auth.expired.darkangels:443/ ✓");
      expect(result.output).toContain("[TLS]  auth.expired.darkangels:443 ✗  CERT_HAS_EXPIRED");
      expect(result.output).toContain("The certificate has expired.");
      expect(result.output).toContain("Subject: CN=auth.expired.darkangels");
      expect(result.output).toContain("Issuer:  CN=Dark Angels Test CA");
    },
  );

  test.serial(
    "🔗 audit auth.incomplete-chain.darkangels - intermediate CA missing from chain",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "consumer audit auth.incomplete-chain.darkangels",
      );
      expect(result.output).toContain("[DNS]  auth.incomplete-chain.darkangels ✓");
      expect(result.output).toContain("[HTTP] https://auth.incomplete-chain.darkangels:443/ ✓");
      expect(result.output).toContain(
        "[TLS]  auth.incomplete-chain.darkangels:443 ✗  UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      );
      expect(result.output).toContain(
        "Incomplete chain — the server did not send the intermediate CA.",
      );
      expect(result.output).toContain("Leaf cert issuer: CN=Dark Angels Intermediate CA");
    },
  );

  test.serial(
    "✅ audit auth.valid.darkangels - CA-signed cert is authorized",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "consumer audit auth.valid.darkangels",
      );
      expect(result.output).toContain("[DNS]  auth.valid.darkangels ✓");
      expect(result.output).toContain("[HTTP] https://auth.valid.darkangels:443/ ✓");
      expect(result.output).toContain("[TLS]  auth.valid.darkangels:443 ✓  chain is valid");
    },
  );

  test.serial(
    "🧹 Cleanup: Stop all services",
    async () => {
      await env[Symbol.asyncDispose]();
    },
    30_000,
  );
});
