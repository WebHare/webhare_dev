---
name: backend-services
description: "Set up internal WebHare backend services in moduledefinition.yml and connect from server-side TypeScript with openBackendService from @webhare/services. Use for backendServices, onCreateClient, onCreateController, typed IPC clients, service events, or connecting to existing HareScript WebHare services. Not for HTTP/OpenAPI endpoints or browser JSON-RPC services."
---

# WebHare backend services

Backend services provide internal IPC between WebHare processes. HareScript calls
these **WebHare services**. They are not HTTP endpoints and are not directly
accessible from browser code. Prefer TypeScript for new services.

## 1. Locate the module and choose the service name

- Read the module's existing `moduledefinition.yml` and nearby service code.
  Merge into an existing `backendServices` mapping rather than adding a second
  YAML key.
- A service key is module-local and must match `^[a-z_][-a-z0-9_]*$`.
  Clients use the qualified name `module:service`, not a file path or URL.
- In the examples below, `example` is the module name and `ping` is the service
  key. Replace both consistently.
- Check for an existing service and shared client types before introducing new
  declarations. If a caller lives in another module, check the module dependency
  and existing cross-module import conventions.

## 2. Register a TypeScript service

Add this top-level entry to `moduledefinition.yml`:

```yaml
backendServices:
  ping:
    onCreateClient: js/services/ping.ts#openPingService
```

The value is a module-relative resource path followed by `#` and the exported
factory function name. It is not a TypeScript import specifier.

Use the current `onCreateClient` spelling, not the deprecated `clientFactory`
alias. Omit `serviceClass` for an ordinary service; specialized `core` and `web`
classes are not needed for this setup.

### Minimal implementation

Create `js/services/ping.ts` in the module:

```typescript
import { BackendServiceConnection } from "@webhare/services";

export interface PingService {
  ping(value: string): string;
}

class PingConnection extends BackendServiceConnection implements PingService {
  ping(value: string) {
    return value;
  }
}

export function openPingService() {
  return new PingConnection();
}
```

Each connection gets its own factory invocation and connection object.
`openBackendService`'s argument array is passed to this factory in order; an
empty array means no arguments. A factory can also be asynchronous.

For example, `openBackendService<SomeService>("example:some_service", [tenant])`
passes `tenant` to `openSomeService(tenant: string)`. These are per-client
initialization arguments, not arguments to the service's RPC methods.

Do not call `runBackendService` from ordinary clients or add a separate startup
script just to run a declaratively registered service. The service manager can
start the service on demand.

## 3. Connect from server-side TypeScript

For a caller in `js/use-ping.ts`:

```typescript
import { openBackendService } from "@webhare/services";
import type { PingService } from "./services/ping";

export async function pingExample() {
  using service = await openBackendService<PingService>("example:ping", []);
  return await service.ping("hello");
}
```

- Share the public interface; use a type-only import so callers do not load the
  service implementation at runtime.
- All remote methods return promises on the client, even if the interface and
  implementation describe synchronous methods. Always await remote calls.
- Keep the connection alive until its calls finish. In particular, keep the
  `await` in `return await` when returning from a `using` scope.
- `using` closes the connection at the end of the scope. For a connection that
  must outlive that scope, explicitly own its lifetime and call `service.close()`
  during cleanup, for example in `finally`.
- Optional third-argument settings include `{ timeout: 15_000 }` for the
  connection wait (default: 30 seconds) and `{ linger: true }` to keep the process
  alive until the connection is explicitly closed. The connection timeout is
  not a timeout for individual method calls.
- A connection failure can trigger on-demand startup and retries during opening.
  Do not assume a previously opened connection transparently reconnects after
  the service restarts. Handle errors explicitly; reopen deliberately if needed,
  and do not blindly retry operations that may already have taken effect.

Use IPC-marshallable data, not arbitrary local class instances or callbacks.
For compatibility with HareScript consumers, do not rely on `undefined` as a
return value; use an explicit value such as `null` where appropriate. Inspect
existing service contracts when choosing types.

### Send events to a connected client

A `BackendServiceConnection` can emit events to the client connected to that
specific connection. This is separate from methods the client calls:

```typescript
import { BackendServiceConnection } from "@webhare/services";

export interface PingService {
  refresh(): void;
}

export interface StatusChanged {
  ready: boolean;
}

class PingConnection extends BackendServiceConnection implements PingService {
  refresh() {
    const status: StatusChanged = { ready: true };
    this.emit("status", status);
  }
}
```

The client proxy returned by `openBackendService` is an `EventTarget`. Listen
with `addEventListener`; the payload is the `CustomEvent.detail` value:

```typescript
using service = await openBackendService<PingService>("example:ping", [], { linger: true });
const statusChanged = new Promise<StatusChanged>(resolve => {
  service.addEventListener("status", event => {
    resolve((event as CustomEvent<StatusChanged>).detail);
  }, { once: true });
});

await service.refresh();
const status = await statusChanged;
```

- Register the listener before calling a method that may emit the event, so a
  synchronous response cannot be missed.
- Events are sent only to that service connection's client. `emit` is provided
  by the base class and is not exposed as a callable remote method. Keep event
  payloads compatible with the service IPC serialization format.
- Use `{ linger: true }` when the client must stay alive waiting for events while
  no remote call is pending. Close the connection explicitly; `using` or a
  `finally` block can own that lifetime.
- This is not the global backend event bus. For an event broadcast across
  WebHare processes and received with `subscribe`, use `broadcast`/`subscribe`
  from `@webhare/services` instead.

### Optional service-name-based typing

An explicit generic, as above, is sufficient. For a shared service used widely,
the public `BackendServices` interface can instead be augmented:

```typescript
import type { PingService } from "./services/ping";

declare module "@webhare/services" {
  interface BackendServices {
    "example:ping": PingService;
  }
}
```

Place this in the module's established shared declaration location, and ensure
it is included in consumers' TypeScript compilation. Then callers can omit the
generic:

```typescript
using service = await openBackendService("example:ping", []);
const result = await service.ping("hello");
```

The YAML registration does not itself describe the methods or replace this
interface. Do not duplicate an existing augmentation.

## 4. Use a controller only when needed

For shared state, coordination between connections, or controller-level cleanup,
register a controller factory instead of a client factory:

```yaml
backendServices:
  ping:
    onCreateController: js/services/ping.ts#createPingController
```

The exported factory returns a `BackendServiceController` from
`@webhare/services`, or a promise of one. Its `createClient(...)` method receives
the client's argument array and returns a `BackendServiceConnection` (or a
promise of one). Its optional `close()` handles controller-wide cleanup.

Choose one registration style for a service. A controller still creates a
separate connection object per client; it is not the remote API object itself.
Keep connection-specific state on those objects and shared state on the
controller. Do not assume module-level variables are per-client.

## 5. Connect to an existing HareScript WebHare service

Use the same TypeScript `openBackendService` API and the existing qualified
service name. Do not re-register or rewrite the service merely to call it.

1. Find its registration and implementation. Establish its opening arguments,
   callable method names and casing, parameter order, result shapes and error
   behavior. Do not infer the contract from one call site.
1. Reuse an existing interface or `BackendServices` augmentation. Otherwise
   define an accurate interface and pass it as the generic, just as above.
1. Pass the service's existing opening arguments as the second argument and
   await every remote call.
1. Preserve HareScript-compatible data shapes and close the connection.

HareScript's `OpenWebHareService` / `RunWebHareService` terminology describes the
same service mechanism; those are not the APIs to import in TypeScript.
Prefer TypeScript when creating a service. HareScript service runners remain
available for existing implementations; verify the target platform version and
specific requirements before proposing or extending one.

## 6. Apply and verify

1. After changing `moduledefinition.yml`, run `wh apply config`.
1. Validate the implementation and callers with the repository's TypeScript
   diagnostics and focused validation commands.
1. Add or run a narrow backend test that opens the **registered** `module:service`
   and calls a method. Directly constructing the connection class, or testing
   only `runBackendService`, does not verify the YAML wiring.
1. Check opening arguments when used, the exact returned value/shape, error
   propagation and connection cleanup. Run WebHare tests serially; use the
   running-tests skill for the local runner workflow.
1. If testing code changes against an already-running service, ensure that
   process has reloaded/restarted before trusting the result. Applying
   configuration is not proof that an existing process uses the new code.
   Use `wh service restart <module>:<service>` to restart only the relevant
   registered backend service, not the shared Node services host or the entire
   installation. Check `wh service restart --help` for usage. If restart reports
   an error, do not assume success; verify that the registered service exposes
   the changed methods and behavior before trusting test results.

For general WebHare CLI commands and script invocation, see the
[WebHare CLI skill](../webhare-cli/SKILL.md). For test-runner commands, see
[running tests](../running-tests/SKILL.md).

When checking current platform behavior, useful examples are
`mod::webhare_testsuite/tests/system/nodejs/test_nodeservices.ts` (declarative
registration), `mod::webhare_testsuite/js/demoservice.ts` (factories and
controllers), and `mod::platform/js/services/platformservices.ts` (shared
interfaces for existing services). The YAML contract is in
`mod::platform/data/schemas/moduledefinition.schema.yml`.
