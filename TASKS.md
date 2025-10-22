# Testing & Documentation Tasks

## High Priority

- [ ] Fix mermaid diagrams: Internet on root graph, intranet as subgraph
- [ ] Review RabbitMQ documentation: Verify proxy_middleware README diagram shows RabbitMQ on both networks

## Medium Priority

- [ ] Enhance main README: Add architecture overview, examples index, development guide
- [ ] Add resilience tests: RabbitMQ failures, consumer restarts, network issues

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
- [x] Create cascading failures test: Integration test complete with 10 tests
- [x] Add stopService helper: Implemented in testing/docker/index.ts
