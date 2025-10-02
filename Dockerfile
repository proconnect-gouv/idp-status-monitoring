FROM oven/bun:1-alpine AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY monitoring-idp-consumer/package.json ./monitoring-idp-consumer/
COPY monitoring-idp-producer/package.json ./monitoring-idp-producer/

RUN bun install --frozen-lockfile --production

FROM deps AS build-consumer
COPY monitoring-idp-consumer/src/ ./monitoring-idp-consumer/src/
RUN bun build --compile --minify --sourcemap \
  monitoring-idp-consumer/src/bin/index.ts --outfile=consumer

FROM deps AS build-producer
COPY monitoring-idp-producer/src/ ./monitoring-idp-producer/src/
RUN bun build --compile --minify --sourcemap \
  monitoring-idp-producer/src/bin/index.ts --outfile=producer

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
