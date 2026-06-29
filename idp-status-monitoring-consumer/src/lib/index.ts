//

import tls from "tls";

interface CertInfo {
  subject: Record<string, string | string[] | undefined>;
  issuer: Record<string, string | string[] | undefined>;
}

function walk_cert_chain(cert: tls.DetailedPeerCertificate): CertInfo[] {
  const chain: CertInfo[] = [];
  let current: tls.DetailedPeerCertificate | null = cert;
  const seen = new Set<string>();

  while (current && !seen.has(current.fingerprint256)) {
    seen.add(current.fingerprint256);
    chain.push({ subject: current.subject, issuer: current.issuer });
    current =
      (current.issuerCertificate as tls.DetailedPeerCertificate) ?? null;
  }

  return chain;
}

export function probe_tls(hostname: string, port: number) {
  const { promise, reject, resolve } = Promise.withResolvers<{
    authorized: boolean;
    authorization_error: string | null;
    chain: CertInfo[];
  }>();

  const socket = tls.connect(
    { host: hostname, port, rejectUnauthorized: false, servername: hostname },
    () => {
      const cert = socket.getPeerCertificate(true);
      const authorized = socket.authorized;
      const authorizationError = socket.authorizationError;
      socket.destroy();
      resolve({
        authorized,
        authorization_error: authorizationError
          ? authorizationError instanceof Error
            ? authorizationError.message
            : String(authorizationError)
          : null,
        chain: walk_cert_chain(cert),
      });
    },
  );
  socket.on("error", reject);

  return promise;
}
