# Testing & Documentation Tasks

## High Priority

## Medium Priority

- [ ] Enhance main README: Add architecture overview, examples index, development guide

## Low Priority

- [ ] Add performance tests: Load testing, concurrent request handling

## Completed ✅

- [x] Resolve duplicate example: Removed `idp-health-check-rpc/`
- [x] Standardize service naming: All use `test_runner` (underscore)
- [x] Standardize test structure: All use `test.serial()`
- [x] Update all test imports: All use `#testing/docker` alias
- [x] Ensure all examples have README: All 4 examples complete
- [x] Fix idp_health_check_rpc tests: Added missing consumer config mappings
- [x] W40K theming: All IdPs renamed with faction/location pattern
- [x] Create cascading failures test: Integration test complete with 15 tests
- [x] Add stopService/startService helpers: Implemented in testing/docker/index.ts
- [x] Fix cascading failures: Added fetch error handling with AbortSignal.timeout
- [x] Optimize test timeouts: HTTP_TIMEOUT=100ms in cascading_failures example
- [x] Remove waitForLogMessage: All examples rely on Docker healthchecks
- [x] Change default port to 80: Producer and consumer now default to port 80 instead of 3000
- [x] Remove :3000 from examples: All compose files and tests use default port 80
- [x] Fix mermaid diagrams: Internet on root graph (no subgraph), intranet as subgraph only where network isolation exists
- [x] Fix proxy.conf: Updated upstream server from producer:3000 to producer:80
- [x] Add resilience tests: Created idp_resilience example testing RabbitMQ failure graceful degradation
