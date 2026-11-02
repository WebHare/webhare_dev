---
name: webhare-registry
description: Working with WebHare module registry keys in moduledefinition.xml and TypeScript, including readRegistryKey/writeRegistryKey, applying registry changes, and getRegistryKeyEventMasks for cache invalidation and update listeners.
---

# WebHare registry keys

Registry keys are declared in a module's `moduledefinition.xml` under `<moduleregistry>`. Nested `<node>` names form dotted key paths, prefixed by the module name. For example, `<node name="credentials"><node name="github"><string name="webharetoken" /></node></node>` in `webhare_portal` declares `webhare_portal:credentials.github.webharetoken`.

In TypeScript, use `readRegistryKey` and `writeRegistryKey` from `@webhare/services`. When useful, constrain key strings with `RegistryKeyOfType<string>` from the module's generated types.

After adding or changing registry declarations, run `wh apply registry` to apply the registry definition to the current WebHare installation, then rerun the code that reads or writes the key. If a registry operation fails because the declaration has not been applied, fix that installation state rather than adding catch/fallback logic that treats the unapplied key as an ordinary missing value. Add runtime recovery only when the failure is an expected part of the feature's behavior.

## Cache invalidation and update listeners

Use `getRegistryKeyEventMasks(keys)` from `@webhare/services` to obtain event masks for an array of registry key names. Do not construct `system:registry.*` event names yourself. The helper returns sorted, deduplicated masks for the keys' containing nodes: changes to sibling keys in the same node also match. Treat a notification as a reason to invalidate or reread the value, not as proof that a particular key's value changed. Registry writes broadcast their events on transaction commit.

For `LocalCache`, return the masks alongside the loaded value so registry updates invalidate the entry. Keep the cache instance outside the lookup function. This example assumes a declared string key `mymodule:settings.endpoint`:

```typescript
import { getRegistryKeyEventMasks, LocalCache, readRegistryKey } from "@webhare/services";

const endpointKey = "mymodule:settings.endpoint";
const endpointCache = new LocalCache<string>();

async function getEndpoint(): Promise<string> {
  return await endpointCache.get(endpointKey, async () => ({
    value: await readRegistryKey(endpointKey),
    masks: getRegistryKeyEventMasks([endpointKey]),
  }));
}
```

Use the loader result's `masks` to invalidate an individual entry; use `new LocalCache({ masks: getRegistryKeyEventMasks([...]) })` only when those updates should clear the entire cache.

For an ongoing listener, pass the masks to `subscribe` from `@webhare/services`:

```typescript
import { getRegistryKeyEventMasks, subscribe } from "@webhare/services";

async function listenForEndpointChanges(onChange: () => void, signal: AbortSignal) {
  return await subscribe(
    getRegistryKeyEventMasks(["mymodule:settings.endpoint"]),
    () => onChange(),
    { signal },
  );
}
```

Await listener setup before relying on notifications, and subscribe before the initial read to avoid a read-then-subscribe gap. The callback receives notifications, not the updated registry value; reread with `readRegistryKey` when needed. Abort the supplied signal when the owner stops listening, or dispose the returned subscription with `subscription[Symbol.dispose]()`. Notifications are asynchronous; do not use them as a substitute for transactional consistency.
