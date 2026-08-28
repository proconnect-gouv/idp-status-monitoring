//
// Regenerate the pre-committed TLS test certificates.
// Run with: bun run examples/idp_tls_diagnostic/build.ts

import { join } from "node:path";

const dir = join(import.meta.dir, "certs");

async function openssl(...args: string[]) {
  await using proc = Bun.spawn(["openssl", ...args], {
    cwd: dir,
    stdout: "ignore",
    stderr: "pipe",
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`openssl ${args[0]} failed:\n${err}`);
  }
}

await Bun.write(
  join(dir, "ca_ext.cnf"),
  "[v3_ca]\nbasicConstraints=CA:true\nkeyUsage=keyCertSign,cRLSign\n",
);

// Root CA
await openssl(
  "req", "-x509", "-newkey", "rsa:2048", "-nodes",
  "-keyout", "ca.key", "-out", "ca.crt",
  "-days", "3650", "-subj", "/CN=Dark Angels Test CA",
);
console.log("✓ root CA");

// Intermediate CA
await openssl(
  "req", "-newkey", "rsa:2048", "-nodes",
  "-keyout", "intermediate.key", "-out", "intermediate.csr",
  "-subj", "/CN=Dark Angels Intermediate CA",
);
await openssl(
  "x509", "-req",
  "-in", "intermediate.csr",
  "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial",
  "-out", "intermediate.crt",
  "-days", "3650",
  "-extfile", "ca_ext.cnf", "-extensions", "v3_ca",
);
console.log("✓ intermediate CA");

// Self-signed
await openssl(
  "req", "-x509", "-newkey", "rsa:2048", "-nodes",
  "-keyout", "self_signed.key", "-out", "self_signed.crt",
  "-days", "3650", "-subj", "/CN=auth.self-signed.darkangels",
);
console.log("✓ self-signed");

// Expired (past validity window)
await openssl(
  "req", "-newkey", "rsa:2048", "-nodes",
  "-keyout", "expired.key", "-out", "expired.csr",
  "-subj", "/CN=auth.expired.darkangels",
);
await openssl(
  "x509", "-req",
  "-in", "expired.csr",
  "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial",
  "-out", "expired.crt",
  "-not_before", "20200101000000Z", "-not_after", "20200102000000Z",
);
console.log("✓ expired");

// Incomplete chain (signed by intermediate, intermediate omitted from server chain)
await openssl(
  "req", "-newkey", "rsa:2048", "-nodes",
  "-keyout", "incomplete_chain.key", "-out", "incomplete_chain.csr",
  "-subj", "/CN=auth.incomplete-chain.darkangels",
);
await openssl(
  "x509", "-req",
  "-in", "incomplete_chain.csr",
  "-CA", "intermediate.crt", "-CAkey", "intermediate.key", "-CAcreateserial",
  "-out", "incomplete_chain.crt",
  "-days", "3650",
);
console.log("✓ incomplete chain");

// Valid (signed directly by root CA)
await openssl(
  "req", "-newkey", "rsa:2048", "-nodes",
  "-keyout", "valid.key", "-out", "valid.csr",
  "-subj", "/CN=auth.valid.darkangels",
);
await openssl(
  "x509", "-req",
  "-in", "valid.csr",
  "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial",
  "-out", "valid.crt",
  "-days", "3650",
);
console.log("✓ valid");

// Clean up scratch files
await Promise.allSettled(
  ["ca_ext.cnf", "ca.srl", "intermediate.srl",
   "expired.csr", "incomplete_chain.csr", "valid.csr",
   "intermediate.csr"].map((f) => Bun.file(join(dir, f)).delete()),
);
