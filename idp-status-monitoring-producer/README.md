# idp-status-monitoring-producer

HTTP server exposing IDP health endpoints.

## API

- `GET /` - Health check
- `GET /idp/:name` - Query specific IDP via RPC
- `GET /idp/:name/readyz` - Diagnose one IDP via RPC, one `[+]`/`[-]` line per check in Kubernetes `readyz` style; 200 when all pass, 503 on failure, 404 for an unknown IDP:

  ```
  [+]rpc ok
  [+]dns ok
  [+]connect ok
  [-]tls failed: CERT_HAS_EXPIRED
  readyz check failed
  ```

- `GET /idp/internet` - Aggregated health of all configured IDPs

## Configuration

```bash
AMQP_URL=amqp://guest:guest@localhost:5672
IDP_URLS=["http://idp1/health","http://idp2/health"]
QUEUE_PRODUCER_NAME=monitoring-producer
QUEUE_CONSUMER_NAME=monitoring-consumer
PORT=3000
```

`LOG_LEVEL`: `debug`, `info` (default), `warn` or `error`. Logs are one JSON line per event, with a `level` field Grafana Loki reads as `detected_level`.

## Usage

```bash
bun run src/bin/index.ts
```
