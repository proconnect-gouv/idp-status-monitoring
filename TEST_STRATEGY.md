# Test Strategy - IDP Monitoring System

## Summary

**Before:** 24 passing unit tests, 2 failing integration tests (26 tests total)
**After:** 45 passing unit tests, 44 passing integration tests (89 tests total)
**Status:** ✅ All tests passing

### Test Breakdown

- **Application Unit Tests:** 25 tests (consumer RPC, producer RPC, router)
- **Mock Infrastructure Tests:** 20 tests (InMemoryConnection, InMemoryChannel)
- **Integration Tests:** 4 examples with 44 total integration tests
  - `idp_health_check_rpc`: 7 tests
  - `idp_error_handling`: 7 tests
  - `idp_proxy_middleware`: 15 tests
  - `idp_cascading_failures`: 15 tests

## What Changed

### 1. Fixed Docker Build (Dockerfile:5)

- **Problem:** `bunfig.toml` was deleted but Dockerfile still referenced it
- **Solution:** Removed `bunfig.toml` from COPY command (Bun 1.3+ has `linker = "isolated"` by default)
- **Impact:** Integration tests can now build successfully

### 2. Enhanced Integration Tests

- **Before:** Tests only checked if services started
- **After:** Tests verify:
  - Docker builds work correctly
  - Services start and stay healthy
  - RabbitMQ connections are established
  - Queue setup completes successfully
  - HTTP endpoints respond correctly
  - Configuration is loaded properly

### 3. Removed Low-Value Tests (3 tests removed)

- Removed tests that check framework behavior instead of business logic:
  - Empty parameter validation (Zod handles this)
  - Duplicate invalid parameter tests
  - Trailing space URL tests (router framework behavior)

### 4. Enhanced Mock Infrastructure

- **Added TypeScript interfaces** for type safety (`InMemoryMessage`, `ConsumerCallback`, `ChannelConfig`)
- **Added state management** to track connection/channel open/closed states
- **Added error handling** for operations on closed connections/channels
- **Added 20 comprehensive tests** for the mock implementation itself
- **Improved documentation** with JSDoc comments explaining behavior

## Test Categories & What They Validate

### 🟢 Application Unit Tests (25 tests) - Fast, Comprehensive Coverage

#### Consumer RPC Tests (`monitoring-idp-consumer/src/rpc/index.test.ts`)

**What matters:** Message processing logic, IDP lookup, HTTP requests, error handling, timeouts, concurrency

- ✅ Sets up channel and consumer correctly
- ✅ Processes messages for known IDPs and makes HTTP requests
- ✅ Returns 404 for unknown IDPs (not in `MAP_FI_NAMES_TO_URL`)
- ✅ Handles network errors gracefully (returns 500)
- ✅ Handles various HTTP status codes (200, 301, 404, 500)
- ✅ **NEW:** Handles HTTP timeout with AbortSignal (returns 500)
- ✅ **NEW:** Handles multiple concurrent messages with correct correlation IDs

#### Producer RPC Tests (`monitoring-idp-producer/src/rpc/index.test.ts`)

**What matters:** Correlation ID handling, response routing, concurrency

- ✅ Consumes messages and emits correlation events
- ✅ Handles multiple concurrent correlation IDs correctly
- ✅ Parses JSON response messages
- ✅ Sets max listeners to 0 (prevents memory leak warnings)
- ✅ **NEW:** Handles concurrent requests with responses arriving out of order
- ✅ **NEW:** Handles high concurrency with 50 simultaneous requests

#### Producer Router Tests (`monitoring-idp-producer/src/server/router.test.ts`)

**What matters:** HTTP API logic, health aggregation, RPC flow

- ✅ Root endpoint returns 200 "ok"
- ✅ `/idp/internet` returns 200 when majority of IDPs succeed
- ✅ `/idp/internet` returns 503 when majority fail or equal split
- ✅ `/idp/internet` handles empty IDP list (returns 503)
- ✅ Correctly categorizes HTTP status codes (200-399 = success, others = fail)
- ✅ `/idp/:name` calls RPC channel wrapper methods
- ✅ `/idp/:name` returns correct status from RPC response
- ✅ `/idp/:name` returns 503 on RPC timeout
- ✅ `/idp/:name` handles malformed JSON responses (returns 500)

### 🟡 Mock Infrastructure Tests (20 tests) - Verify Test Tooling

#### InMemoryConnection Tests (`mocks/amqp/in-memory.test.ts`)

**What matters:** Mock behaves like real amqplib Connection

- ✅ Creates connection in connected state
- ✅ Creates channels correctly
- ✅ Executes channel setup functions
- ✅ Closes connection and all channels together
- ✅ Emits close event when closed
- ✅ Throws error when creating channel after close

#### InMemoryChannel Tests (`mocks/amqp/in-memory.test.ts`)

**What matters:** Mock behaves like real amqplib Channel

- ✅ Asserts queues correctly
- ✅ Rejects operations when channel is closed
- ✅ Registers consumers on asserted queues
- ✅ Throws error when consuming from non-asserted queue
- ✅ Sends messages to queue consumers
- ✅ Emits message-sent event for testing
- ✅ Handles both string and Buffer content
- ✅ Supports ack/nack operations
- ✅ Delivers messages via emit('deliver-message') for testing
- ✅ Closes channel and emits close event
- ✅ Clears consumers when channel closes

### 🔵 Integration Tests (3 tests) - Verify Docker/Deployment

#### IDP Health Check RPC (`examples/idp_health_check_rpc/`)

**What matters:** Docker build works, services start, RabbitMQ connects, RPC flow works end-to-end

- ✅ Docker builds complete successfully
- ✅ RabbitMQ and Dark Angels IdPs are healthy
- ✅ Producer and consumer services are running
- ✅ Consumer connects to RabbitMQ and loads config (rock, caliban, inner-circle, fallen-angels)
- ✅ Producer connects to RabbitMQ and asserts queues
- ✅ RPC calls to specific IdPs return correct HTTP status
- ✅ Unknown IdP names return 404
- ✅ Aggregated `/idp/internet` endpoint works

#### IDP Error Handling (`examples/idp_error_handling/`)

**What matters:** Services start with error-handling configuration, various HTTP codes propagate correctly

- ✅ All services start with error scenarios configured
- ✅ Consumer loads multiple IDP configurations (fenris=200, prospero=500, sorcerers=404)
- ✅ Producer connects to RabbitMQ successfully
- ✅ Each IdP returns expected HTTP status code
- ✅ Aggregated health check handles mixed success/failure

#### IDP Proxy Middleware (`examples/idp_proxy_middleware/`)

**What matters:** Network isolation works, RPC proxies private network access

- ✅ Docker builds with split networks (default + fortress-network)
- ✅ All services start and connect correctly
- ✅ Producer can access Iron Warriors IdPs directly (public network)
- ✅ Producer can access Imperial Fists IdPs via RPC through consumer (private network)
- ✅ Network isolation prevents direct producer→fortress access

#### IDP Cascading Failures (`examples/idp_cascading_failures/`)

**What matters:** Majority voting logic works correctly when services fail

- ✅ Docker builds with 3 Tyranid Hive Fleet IdPs (Kraken, Leviathan, Behemoth)
- ✅ All services start and connect to RabbitMQ
- ✅ Consumer loads all 3 IDP configurations
- ✅ Individual RPC calls to each IdP work correctly
- ✅ Aggregated `/idp/internet` returns 200 when all 3 operational (3/3)
- ✅ Stop Behemoth → `/idp/internet` returns 200 (2/3 majority healthy)
- ✅ Stop Leviathan → `/idp/internet` returns 503 (1/3 minority healthy)
- ✅ Stop Kraken → `/idp/internet` returns 503 (0/3 all failed)
- ✅ Unknown IdP names return 404
- ✅ Fetch timeout mechanism works (HTTP_TIMEOUT=100ms)
- ✅ Fetch errors return `status: 0` for unreachable services

## Why This Test Strategy Matters

### Unit Tests Provide Deep Coverage

- **Fast:** Run in seconds, use in-memory mocks
- **Comprehensive:** Cover all business logic paths
- **Isolated:** Test one component at a time
- **RPC logic is fully tested:** Correlation IDs, timeouts, error handling, JSON parsing

### Integration Tests Validate Deployment

- **Docker builds:** Ensure production deployment works
- **Service startup:** Verify all services can start and connect
- **Configuration:** Ensure environment variables are parsed correctly
- **Infrastructure:** RabbitMQ connections, health checks

### What We Don't Need to Test in Integration

- ❌ RPC message flow end-to-end (already tested in unit tests with mocks)
- ❌ HTTP status code propagation (unit tests cover this)
- ❌ Error scenarios (unit tests cover all error paths)
- ❌ Edge cases (unit tests are better suited for this)

## Test Execution

```bash
# Run all tests (takes ~60 seconds due to Docker builds)
bun test

# Run only unit tests (fast, ~1 second)
bun test monitoring-idp-consumer/ monitoring-idp-producer/

# Run only integration tests (slow, ~58 seconds)
bun test examples/
```

## Critical Paths Tested

### 1. IDP Health Aggregation (`/idp/internet`)

- ✅ Fetches all configured IDPs with timeout (`AbortSignal.timeout(HTTP_TIMEOUT)`)
- ✅ Catches fetch errors and returns `status: 0` for unreachable services
- ✅ Categorizes responses (200-399 = success, others = fail)
- ✅ Returns 503 when majority fail (unsucessfuls.length < successfuls.length ? 200 : 503)
- ✅ Handles empty IDP lists
- ✅ Tested with real service failures in integration tests

### 2. RPC Message Flow (`/idp/:name`)

- ✅ Producer sends message with correlation ID
- ✅ Consumer receives message and performs HTTP request
- ✅ Consumer sends response back with same correlation ID
- ✅ Producer receives response and returns HTTP status

### 3. Error Handling

- ✅ Unknown IDP names → 404
- ✅ Network errors → 500
- ✅ RPC timeout → 503
- ✅ Malformed JSON → 500

### 4. Docker & Deployment

- ✅ Multi-stage Docker build compiles successfully
- ✅ Services start and connect to RabbitMQ
- ✅ Configuration parsing works
- ✅ Health checks pass

## What Tests Don't Cover (And That's OK)

- **Real RabbitMQ message flow under load:** Unit tests with mocks are sufficient
- **Network latency scenarios:** Hard to test reliably in CI
- **Actual IDP endpoints:** Mock servers are used instead
- **Long-running stability:** Beyond scope of test suite

## Maintenance Guidelines

### When Adding New Features

1. **Always write unit tests first** - Fast, reliable, comprehensive
2. **Use mocks for external dependencies** - RabbitMQ, HTTP requests
3. **Integration tests only for Docker/deployment changes** - Keep them simple

### When Tests Fail

1. **Unit test failures:** Business logic issue - fix the code or test
2. **Integration test failures:** Usually Docker, configuration, or timing issues
3. **Flaky tests:** Usually integration tests - simplify or add more explicit waits

### Red Flags (Tests to Avoid)

- ❌ Tests that depend on external services
- ❌ Tests with arbitrary `sleep()` calls
- ❌ Tests that test framework behavior (routing, validation)
- ❌ Duplicate tests that verify the same thing
- ❌ Tests that take too long (>5s for unit, >60s for integration)

## New: Timeout & Concurrency Tests

### Why These Tests Matter

#### HTTP Timeout Test (Consumer)

**Validates:** AbortSignal timeout mechanism works correctly

- Simulates slow/hanging IDP endpoints
- Ensures requests don't hang indefinitely
- Critical for production reliability under network issues

#### Concurrent Messages Test (Consumer)

**Validates:** Multiple messages can be processed simultaneously without correlation ID mix-ups

- Tests real-world scenario of multiple IDP checks happening at once
- Ensures each message gets the correct response
- Prevents response routing bugs

#### Out-of-Order Response Test (Producer)

**Validates:** Correlation ID system works even when responses arrive in unexpected order

- Simulates realistic async behavior where faster requests complete first
- Tests EventEmitter correlation logic
- Critical for RPC pattern correctness

#### High Concurrency Test (Producer)

**Validates:** System can handle many simultaneous requests (50+)

- Tests scalability of correlation ID mechanism
- Ensures no memory leaks or event listener issues
- Validates production-scale behavior

## Why Test the Mocks?

Testing the mock implementation itself provides several benefits:

1. **Mock Correctness:** Ensures mocks behave like real amqplib
2. **Test Reliability:** Prevents false positives from broken mocks
3. **Documentation:** Tests serve as documentation of mock capabilities
4. **Refactor Safety:** Can improve mocks without breaking tests
5. **Type Safety:** Validates TypeScript interfaces work correctly

## Conclusion

This test suite provides:

- **Fast feedback** via comprehensive unit tests
- **Deployment confidence** via Docker integration tests
- **Maintainability** by removing low-value tests
- **Clear separation** between unit and integration concerns
- **Timeout & concurrency coverage** for production reliability
- **Reliable test infrastructure** with tested mocks

The 58 tests cover all critical business logic, edge cases for timeouts and high-concurrency scenarios, AND the test infrastructure itself, ensuring comprehensive and reliable test coverage.

## Integration Test Consistency

All integration tests follow consistent patterns:

- **Consistent env creation**: `const env = createDockerEnv(import.meta.dir);`
- **Serial execution**: All tests use `test.serial()` to avoid race conditions
- **No waitForLogMessage**: All examples rely on Docker healthchecks via `--wait` flag
- **Structured test flow**: Setup → Consumer checks → Producer checks → Endpoint tests → Cleanup
- **Fast healthchecks**: All compose files use 1s intervals for rapid startup
- **Producer healthchecks**: All use `wget http://127.0.0.1:3000/`
- **Consumer healthchecks**: All use `wget http://127.0.0.1:3000/health/ready`
- **Clean shutdown**: All tests use `env[Symbol.asyncDispose]()` with 30s timeout
- **Inline snapshots**: Complex JSON responses validated with `toMatchInlineSnapshot()`

### Cascading Failures Pattern

The `idp_cascading_failures` example demonstrates a unique pattern:

- **Sequential service stops**: Each test stops one service, next test verifies behavior
- **No restart needed**: Tests run in sequence (3/3 → 2/3 → 1/3 → 0/3)
- **Fast timeouts**: `HTTP_TIMEOUT=100ms` for rapid failure detection
- **Fetch error handling**: Router catches network errors and returns `status: 0`
- **AbortSignal timeout**: Uses `fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT) })`
