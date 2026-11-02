---
name: localcache
description: Use WebHare's LocalCache in TypeScript for process-local memoization, including async loaders, TTLs, event-mask invalidation, and cache sizing.
---

# WebHare LocalCache

Use `LocalCache<T>` from `@webhare/services` to memoize values within a process. It is an in-memory cache, not persistent storage or a cross-process consistency mechanism. Keep and reuse a cache instance at the scope whose lifetime and data ownership match the values being cached; do not construct one for each lookup.

## Basic use

```typescript
import { LocalCache } from "@webhare/services";

type Lookup = { label: string };
const lookupCache = new LocalCache<Lookup>();

async function getLookup(id: string): Promise<Lookup> {
  return await lookupCache.get(id, async () => ({
    value: await fetchLookup(id),
    masks: [],
    ttl: 60_000,
  }));
}
```

The loader returns a record containing `value` and `masks`, and may also set an expiry. `get(key, loader)` returns a promise for the cached or newly created value. A cache hit skips the loader. Concurrent misses for the same key share the in-progress creation; keep loaders safe to await and avoid depending on a particular caller being the one that runs it.

Keys can be strings or records. Record keys are serialized stably, so equivalent records can address the same entry. Prefer normalized, compact keys containing all inputs that affect the value. Normalize values such as case or whitespace before using them if the underlying lookup treats them as equivalent.

## Expiry and invalidation

Set one of these on the loader result when a value should expire:

```typescript
return { value, masks: [], ttl: 5 * 60_000 }; // milliseconds from creation
```

```typescript
return { value, masks: [], expires: Temporal.Now.instant().add({ minutes: 5 }) };
```

Use `ttl` for a duration and `expires` for an absolute `Temporal.Instant`; do not set both. Omitting both leaves the entry cached until it is invalidated, evicted, or the cache is reset. A zero TTL means the value is returned but not retained. Keep TTLs appropriate to the source's change rate and the cost of recomputing the value.

`masks` lists event names or wildcard patterns that invalidate this entry when matching WebHare events arrive. Pick masks for the source data that determines the cached value. If no source event can describe staleness, use a TTL. The `masks` constructor option is for events that should clear the entire cache, not merely an individual entry:

```typescript
const mimeTypeCache = new LocalCache<string>({ masks: ["system:mimetypes"] });

async function getMimeType(extension: string): Promise<string> {
  return await mimeTypeCache.get(extension, () => readMimeType(extension));
}
```

Every cache also clears on `system:clearcaches`. Call `reset()` when the owning code needs to clear its entries directly. `LocalCache` implements `Symbol.dispose` and can be used with an explicit resource scope when that matches the cache lifetime.

## Miss checks and cache sizing

Calling `get(key)` without a loader is synchronous and returns the cached value or `null` on a miss. Its type is `T | null`; distinguish a miss from valid falsy values. This overload is useful for opportunistic reads, not as a substitute for awaiting a loader when the value is required.

Set `maxSize` when the key space can grow without bound:

```typescript
const responseCache = new LocalCache<ResponseData>({ maxSize: 1_000 });
```

The cache evicts an older inserted entry when it exceeds this limit. Do not treat it as a least-recently-used cache or rely on which entry is evicted.

## Patterns and pitfalls

- Cache only values that are safe to share within the cache's process and lifetime. Values are returned directly; avoid mutating shared cached objects, or make an intentional copy at the boundary.
- Include every input affecting the result in the key. An incomplete key can return another request's result.
- Use event masks for prompt invalidation when the underlying system emits reliable events; use TTLs as a bounded-staleness fallback or for external data without local events.
- Loader exceptions propagate and are not cached. If failures should be briefly cached to avoid repeated failing requests, represent the failure in the cached value and give it a short TTL, then rethrow or translate it after reading the cache.
- Do not use this cache for authorization decisions or other data that must be immediately consistent across processes. Local invalidation events and TTLs do not make it a distributed cache.
- When adding behavior, follow the existing test conventions and cover cache hits, misses, expiry or invalidation, and the behavior specific to the caller. The `jssdk/services` `test_localcache.ts` test is a useful reference for the API's basic behaviors.
