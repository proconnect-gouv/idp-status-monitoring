# idp-status-monitoring-producer

HTTP server exposing IDP health endpoints.

## API

- `GET /` - Health check
- `GET /idp/:name` - Query specific IDP via RPC
- `GET /idp/internet` - Aggregated health of all configured IDPs

## Configuration

```bash
AMQP_URL=amqp://guest:guest@localhost:5672
IDP_URLS=["http://idp1/health","http://idp2/health"]
QUEUE_PRODUCER_NAME=monitoring-producer
QUEUE_CONSUMER_NAME=monitoring-consumer
PORT=3000
```

## Usage

```bash
bun run src/bin/index.ts
```
