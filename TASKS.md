# Testing & Documentation Tasks

## High Priority

- [ ] Fix mermaid diagrams: Internet on root graph, intranet as subgraph
- [ ] Review RabbitMQ documentation: Verify proxy_middleware README diagram shows RabbitMQ on both networks

## Medium Priority

- [ ] Enhance main README: Add architecture overview, examples index, development guide
- [ ] Add resilience tests: RabbitMQ failures, consumer restarts, network issues

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
