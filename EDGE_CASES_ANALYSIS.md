# Edge Cases & Implementation Analysis

## Consumer RPC Implementation (`monitoring-idp-consumer/src/rpc/index.ts`)

### 🔴 Critical Issues

#### 1. **Unused Channel Creation (Line 26)**
```typescript
connection.createChannel(); // Result not used!
return connection;
```
**Issue:** Creates a channel that's never used or stored
**Impact:** Memory leak - creates channel on every connection
**Test Status:** ❌ Not tested
**Fix:** Remove this line

#### 2. **Missing Message Validation (Line 59)**
```typescript
const idp = message.content.toString("utf8");
```
**Issue:** No validation that `message.content` exists or is a Buffer
**Impact:** Could crash with `TypeError` if message is malformed
**Test Status:** ❌ Not tested
**Fix:** Add validation: `if (!message?.content) { /* handle */ }`

#### 3. **Missing Property Validation (Lines 81, 89)**
```typescript
correlationId: message.properties.correlationId, // Could be undefined
// ...
channel_wrapper.sendToQueue(message.properties.replyTo, ...); // Could be undefined
```
**Issue:** No validation that required properties exist
**Impact:** Responses sent with undefined correlationId won't correlate; sendToQueue to undefined queue fails
**Test Status:** ❌ Not tested
**Fix:** Validate properties before using

#### 4. **Unhandled Async Errors (Line 58)**
```typescript
channel_wrapper.consume(QUEUE_PRODUCER_NAME, async (message) => {
  // ... async code that could throw
  channel_wrapper.ack(message); // Always acks, even on error
});
```
**Issue:** Errors in async callback are not caught; message always acked even if processing fails
**Impact:** Silent failures, lost error visibility, messages marked as processed when they failed
**Test Status:** ⚠️ Partially tested (network errors tested, but not all async errors)
**Fix:** Wrap in try/catch, use nack on error

### 🟡 Medium Issues

#### 5. **Unsafe hasOwnProperty (Line 64)**
```typescript
if (MAP_FI_NAMES_TO_URL.hasOwnProperty(idp))
```
**Issue:** Direct use of hasOwnProperty is not safe for prototype-less objects
**Impact:** Low risk in this case (config object has prototype), but not best practice
**Test Status:** ✅ Tested (unknown IDP test)
**Fix:** Use `Object.hasOwn(MAP_FI_NAMES_TO_URL, idp)` or `idp in MAP_FI_NAMES_TO_URL`

#### 6. **Error Status Code Assumption (Line 76)**
```typescript
status = (err as any).response?.status || 500;
```
**Issue:** Assumes errors might have `.response.status` (axios-style), but most errors don't
**Impact:** Always returns 500 for network errors (which is correct behavior, but misleading code)
**Test Status:** ✅ Tested (fetch error test)
**Fix:** Simplify to just `status = 500` since .response.status is never present

---

## Producer RPC Implementation (`monitoring-idp-producer/src/rpc/index.ts`)

### 🔴 Critical Issues

#### 1. **Missing Message Validation (Line 51)**
```typescript
message.content.toString("utf8")
```
**Issue:** No validation that `message.content` exists
**Impact:** Could crash with `TypeError` if message is malformed
**Test Status:** ❌ Not tested
**Fix:** Add validation before toString()

#### 2. **Missing Property Validation (Line 54)**
```typescript
channel_wrapper.emit(message.properties.correlationId, ...);
```
**Issue:** If correlationId is undefined, emits event with name `undefined`
**Impact:** Event won't be received by waiting requests; memory leak as listeners accumulate
**Test Status:** ❌ Not tested
**Fix:** Validate correlationId exists before emitting

### 🟡 Medium Issues

#### 3. **No Error Handling in Consumer (Line 49)**
```typescript
channel_wrapper.consume(QUEUE_CONSUMER_NAME, (message) => {
  // ... code that could throw
  channel_wrapper.ack(message);
});
```
**Issue:** Errors in callback are not caught
**Impact:** Could crash process on malformed message
**Test Status:** ❌ Not tested
**Fix:** Wrap in try/catch

---

## Summary of Untested Edge Cases

### High Priority (Could Cause Crashes)
1. ❌ **Malformed message (no content buffer)**
   - Consumer: Line 59
   - Producer: Line 51

2. ❌ **Missing correlationId property**
   - Consumer: Line 81
   - Producer: Line 54

3. ❌ **Missing replyTo property**
   - Consumer: Line 89

4. ❌ **Async errors in consumer callback**
   - Consumer: Line 58-94

### Medium Priority (Bad Behavior)
5. ⚠️ **Message processing fails but still acks**
   - Both implementations

6. ⚠️ **Unused channel creation**
   - Consumer: Line 26 (memory leak)

### Low Priority (Code Quality)
7. ✅ **hasOwnProperty usage** (already works, but not best practice)

---

## Recommended Test Additions

### Consumer Tests
```typescript
it("should handle malformed message with no content", async () => {
  // Test message without content buffer
});

it("should handle message with missing correlationId", async () => {
  // Test message.properties.correlationId === undefined
});

it("should handle message with missing replyTo", async () => {
  // Test message.properties.replyTo === undefined
});

it("should nack message when processing throws error", async () => {
  // Test that errors in async callback don't ack message
});

it("should handle sendToQueue failure", async () => {
  // Test when replying fails
});
```

### Producer Tests
```typescript
it("should handle malformed message with no content", async () => {
  // Test message without content buffer
});

it("should handle message with missing correlationId", async () => {
  // Test message.properties.correlationId === undefined
});

it("should not crash when emit fails", async () => {
  // Test error handling in consumer callback
});
```

---

## Code Improvements Needed

### Consumer (monitoring-idp-consumer/src/rpc/index.ts)

```typescript
// BEFORE (Line 26)
connection.createChannel(); // Unused!
return connection;

// AFTER
return connection; // Remove unused channel creation
```

```typescript
// BEFORE (Line 58-94)
channel_wrapper.consume(QUEUE_PRODUCER_NAME, async (message) => {
  const idp = message.content.toString("utf8");
  // ... processing
  channel_wrapper.ack(message);
});

// AFTER
channel_wrapper.consume(QUEUE_PRODUCER_NAME, async (message) => {
  try {
    // Validate message structure
    if (!message?.content || !message?.properties) {
      console.error("Malformed message received:", message);
      channel_wrapper.nack(message, false, false);
      return;
    }

    const { correlationId, replyTo } = message.properties;
    if (!correlationId || !replyTo) {
      console.error("Message missing required properties:", message.properties);
      channel_wrapper.nack(message, false, false);
      return;
    }

    const idp = message.content.toString("utf8");
    // ... rest of processing

    channel_wrapper.sendToQueue(replyTo, JSON.stringify({ status }), options);
    channel_wrapper.ack(message);
  } catch (err) {
    console.error("Error processing message:", err);
    channel_wrapper.nack(message, false, false); // Don't requeue
  }
});
```

### Producer (monitoring-idp-producer/src/rpc/index.ts)

```typescript
// BEFORE (Line 49-59)
channel_wrapper.consume(QUEUE_CONSUMER_NAME, (message) => {
  console.log(`received message : ${message.properties.correlationId} - ${message.content.toString("utf8")}`);
  channel_wrapper.emit(message.properties.correlationId, message.content.toString("utf8"));
  channel_wrapper.ack(message);
});

// AFTER
channel_wrapper.consume(QUEUE_CONSUMER_NAME, (message) => {
  try {
    // Validate message structure
    if (!message?.content || !message?.properties?.correlationId) {
      console.error("Malformed message received:", message);
      channel_wrapper.nack(message, false, false);
      return;
    }

    const { correlationId } = message.properties;
    const content = message.content.toString("utf8");

    console.log(`received message : ${correlationId} - ${content}`);
    channel_wrapper.emit(correlationId, content);
    channel_wrapper.ack(message);
  } catch (err) {
    console.error("Error processing message:", err);
    channel_wrapper.nack(message, false, false);
  }
});
```

---

## Impact Assessment

### Current Risk Level: 🟡 MEDIUM
- **Crash Risk:** Medium (malformed messages could crash services)
- **Data Loss Risk:** Low (messages are acked even on failure, but errors are logged)
- **Production Impact:** Would manifest as:
  - Service crashes on malformed messages from RabbitMQ
  - Silent failures when correlation fails
  - Memory leaks from unused channels
  - Lost messages (acked but not processed)

### After Fixes: 🟢 LOW
- All edge cases handled gracefully
- Proper error logging
- Failed messages nacked (can be sent to dead letter queue)
- No memory leaks
