# Testing & Documentation Review Tasks

## High Priority

- [ ] Resolve duplicate example: Remove `idp-health-check-rpc/` (keep `idp_health_check_rpc/`)
- [ ] Fix RabbitMQ documentation: Update proxy_middleware README to show RabbitMQ on both networks in diagram
- [ ] Standardize service naming: Use `test_runner` (underscore) everywhere in compose.yaml files
- [ ] Standardize test structure: Use `test.serial()` for all integration tests
- [ ] Update all test imports: Change `../../tests/docker` to `#testing/docker`
- [ ] Fix all mermaid diagrams: Internet on root graph, intranet as subgraph
- [ ] Ensure all examples have README with mermaid diagram matching integration test
- [ ] Simplify mermaid diagrams to match integration test flow (remove unnecessary details)

## Medium Priority

- [ ] Create cascading failures test: Add `examples/idp_cascading_failures/integration.test.ts`
- [ ] Create cascading failures README with mermaid diagram
- [ ] Enhance main README: Add architecture overview, examples index, development guide
- [ ] Add resilience tests: RabbitMQ failures, consumer restarts, network issues

## Low Priority

- [ ] Add performance tests: Load testing, concurrent request handling
- [ ] Improve test descriptions: More descriptive test names explaining what's being validated

## Issues Found

### Duplicate Examples

- `idp_health_check_rpc/` and `idp-health-check-rpc/` are identical
  - Same compose.yaml structure
  - Same mock-idp.conf content
  - Same test structure

### Missing Documentation

- `idp_cascading_failures/` - No README, no integration test
- `idp-health-check-rpc/` - No README (duplicate)

### Architecture Documentation Issues

- RabbitMQ shown as "default network" but actually on both default and intranet
- Mermaid diagrams don't match network reality in compose.yaml

### Test Inconsistencies

- Service naming: `test-runner` vs `test_runner`
- Test structure: `test()` vs `test.serial()`
- Import paths: Using relative `../../tests/docker` instead of alias

### Missing Test Coverage

- RabbitMQ connection failures
- Consumer crash/restart scenarios
- Network timeout scenarios
- Cascading failures (compose exists but no test)
- Load testing scenarios
