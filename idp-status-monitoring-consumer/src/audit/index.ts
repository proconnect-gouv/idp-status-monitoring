//

import { lookup } from "node:dns/promises";
import https from "node:https";
import { probe_tls } from "#src/lib";

function check_http(
  hostname: string,
  port: number,
): Promise<{ status: number; latency: number }> {
  const { promise, resolve, reject } = Promise.withResolvers<{
    status: number;
    latency: number;
  }>();
  const start = Date.now();
  const req = https.request(
    { hostname, port, path: "/", method: "GET", rejectUnauthorized: false },
    (res) => {
      res.resume();
      resolve({ status: res.statusCode!, latency: Date.now() - start });
    },
  );
  req.on("error", reject);
  req.setTimeout(5_000, () => req.destroy(new Error("timeout")));
  req.end();
  return promise;
}

type Dn = Record<string, string | string[] | undefined>;

function cn(dn: Dn): string {
  const val = dn["CN"];
  return Array.isArray(val) ? (val[0] ?? "") : (val ?? "");
}

function print_tls_guidance(
  error: string | null,
  chain: Array<{ subject: Dn; issuer: Dn }>,
) {
  const leaf = chain[0];
  const root = chain[chain.length - 1];

  switch (error) {
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
      console.log(`  The certificate is self-signed (not issued by a CA).`);
      console.log(`  Subject: CN=${cn(leaf!.subject)}`);
      console.log(`  → Ask the IdP operator to obtain a certificate from a trusted CA.`);
      if (root) {
        console.log();
        console.log(
          `  Workaround: add CN=${cn(root.subject)} to NODE_EXTRA_CA_CERTS to trust this cert.`,
        );
      }
      break;

    case "CERT_HAS_EXPIRED":
      console.log(`  The certificate has expired.`);
      console.log(`  Subject: CN=${cn(leaf!.subject)}`);
      console.log(`  Issuer:  CN=${cn(leaf!.issuer)}`);
      console.log(
        `  → Contact the issuer (${leaf!.issuer["O"] ?? cn(leaf!.issuer)}) to renew the certificate.`,
      );
      if (root && chain.length > 1) {
        console.log();
        console.log(`  Root CA: CN=${cn(root.subject)}`);
        console.log(
          `  Note: adding the root CA to NODE_EXTRA_CA_CERTS will not fix an expired certificate.`,
        );
      }
      break;

    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      console.log(`  Incomplete chain — the server did not send the intermediate CA.`);
      console.log(`  Leaf cert issuer: CN=${cn(leaf!.issuer)}`);
      console.log(
        `  → The IdP server must include the full chain (leaf + intermediate) in its TLS configuration.`,
      );
      break;

    default:
      console.log(`  Error: ${error}`);
  }

  if (chain.length > 0) {
    console.log();
    console.log(`  Chain:`);
    chain.forEach(({ subject, issuer }, i) => {
      console.log(`    [${i}] CN=${cn(subject)} (issued by CN=${cn(issuer)})`);
    });
  }
}

export async function runAudit(hostname: string, port = 443) {
  console.log(`\nAuditing ${hostname}:${port}\n`);

  process.stdout.write(`[DNS]  ${hostname} `);
  try {
    const { address } = await lookup(hostname);
    console.log(`✓  ${address}`);
  } catch (err) {
    console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    console.log(`\n  Cannot proceed: hostname does not resolve.\n`);
    return;
  }

  process.stdout.write(`[HTTP] https://${hostname}:${port}/ `);
  try {
    const { status, latency } = await check_http(hostname, port);
    console.log(`✓  ${status} (${latency}ms)`);
  } catch (err) {
    console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
    console.log(`\n  Cannot proceed: endpoint is not reachable on port ${port}.\n`);
    return;
  }

  process.stdout.write(`[TLS]  ${hostname}:${port} `);
  try {
    const { authorized, authorization_error, chain } = await probe_tls(hostname, port);
    if (authorized) {
      console.log(`✓  chain is valid\n`);
    } else {
      console.log(`✗  ${authorization_error}\n`);
      print_tls_guidance(authorization_error, chain);
      console.log();
    }
  } catch (err) {
    console.log(`✗  ${err instanceof Error ? err.message : String(err)}\n`);
  }
}
