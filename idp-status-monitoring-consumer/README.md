# idp-status-monitoring-consumer

RPC worker executing IDP health checks.

## Behavior

Listens for RPC requests from producer, queries configured IDPs, returns health status.

## Configuration

```bash
AMQP_URL=amqp://guest:guest@localhost:5672
QUEUE_PRODUCER_NAME=monitoring-producer
QUEUE_CONSUMER_NAME=monitoring-consumer
MAP_FI_NAMES_TO_URL={"idp1":"http://internal/idp1","idp2":"http://internal/idp2"}
```

## Usage

```bash
bun run src/bin/index.ts
```
