FROM oven/bun:1.3.10-alpine AS deps

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY idp-status-monitoring-consumer/package.json ./idp-status-monitoring-consumer/
COPY idp-status-monitoring-producer/package.json ./idp-status-monitoring-producer/

RUN bun install --frozen-lockfile --production

FROM deps AS build-consumer
COPY idp-status-monitoring-consumer/src/ ./idp-status-monitoring-consumer/src/
RUN bun build --compile --minify --sourcemap \
  idp-status-monitoring-consumer/src/bin/index.ts --outfile=consumer

FROM deps AS build-producer
COPY idp-status-monitoring-producer/src/ ./idp-status-monitoring-producer/src/
RUN bun build --compile --minify --sourcemap \
  idp-status-monitoring-producer/src/bin/index.ts --outfile=producer

FROM alpine:latest AS base-runtime
RUN apk add --no-cache ca-certificates libstdc++ libgcc
RUN addgroup -g 1001 -S bun && adduser -S bun -u 1001
USER bun

FROM base-runtime AS consumer
COPY --from=build-consumer --chown=bun:bun /app/consumer /usr/local/bin/
CMD ["consumer"]

FROM base-runtime AS producer
COPY --from=build-producer --chown=bun:bun /app/producer /usr/local/bin/
CMD ["producer"]

FROM base-runtime AS monitoring
COPY --from=build-consumer --chown=bun:bun /app/consumer /usr/local/bin/
COPY --from=build-producer --chown=bun:bun /app/producer /usr/local/bin/
