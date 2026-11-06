---
name: rpc-json-to-service
description: "Convert legacy rpc.json imports to typed TypeScript RPC services using @webhare/jsonrpc-client. Use when replacing import * as xxxRPC from a .rpc.json file, migrating JSON RPC descriptors, or adding interfaces for HareScript webservices."
---

# Convert rpc.json imports to typed services

Replace legacy RPC descriptor imports with typed clients without changing the
server implementation or its wire protocol.

## Resolve the service

1. Resolve the imported `.rpc.json` relative to its caller and read its
   `services` array, for example `{ "services": ["example:events"] }`.
1. Resolve each `module:service` pair to the corresponding module's
   `moduledefinition.xml`. Find the `<webservice name="service">` and read its
   `library` and `prefix` attributes. Do not infer these from the caller's alias.
1. Resolve the library relative to that module, or follow its `mod::` path.
   Inspect the public HareScript functions with the configured prefix (usually
   `RPC_`), including relevant imported libraries. Follow delegated calls far
   enough to establish parameter and response shapes.

## Define the typed client

1. Create a sibling TypeScript file by replacing `.rpc.json` with `.ts`:
   `services.rpc.json` becomes `services.ts`. Check for an existing file before
   creating or overwriting it.
1. Export an interface named in UpperCamelCase and ending in `Service`, derived
   from the descriptor's service name, not the import alias. Normalize separators
   and avoid duplicating an existing `Service` suffix.
1. Include every public prefixed method, not just methods currently called.
   Remove the prefix and use the existing client-facing lowerCamelCase spelling,
   preserving acronyms (for example `RPC_AddSessionFAQ` becomes `addSessionFAQ`).
1. Describe the JSON wire types, not HareScript runtime objects. Preserve
   parameter order, optional/defaulted parameters, arrays, nullable records and
   all response branches. Use discriminated unions for success/error or
   valid/invalid responses where appropriate. Every method returns `Promise<T>`,
   including `Promise<void>` for methods without a result.
1. Reuse accurate shared types where available. Do not hide unknown shapes with
   `any`, assertions or broad index signatures; inspect the implementation.
1. Import and instantiate the client:

   ```typescript
   import { createClient } from "@webhare/jsonrpc-client";

   export interface EventsService {
     getTitle(eventguid: string): Promise<string>;
   }

   const eventsService = createClient<EventsService>("example:events");
   export default eventsService;
   ```

   The object name is the interface name with its first character lowercased.
   Keep the exact `module:service` identifier from the descriptor. If the
   descriptor combines services, resolve each one and preserve all used methods
   and their routing with separate typed clients; do not silently drop services.

## Update every caller

1. Find all references to the same resolved descriptor across the workspace,
   including different relative paths and module aliases.
1. Replace namespace/default descriptor imports with a default import from the
   new TypeScript file, using the repository's extension convention. Existing
   local aliases can be retained to avoid unrelated call-site churn.
1. Remove obsolete `@ts-expect-error` or `@ts-ignore` comments above these
   imports. Preserve unrelated suppressions.
1. Use TypeScript diagnostics on the client and every caller to refine the
   interface. Check the server before changing a type to satisfy a caller;
   correct tightly coupled caller types or handling when the server proves them
   wrong. Do not change runtime values or silence errors with casts.
1. Run focused repository-standard type/lint checks and relevant existing tests
   where practical. Report pre-existing diagnostics separately.
1. Verify that no callers still reference the old descriptor and that every
   public prefixed function is represented. Leave the descriptor in place unless
   its removal is requested or established as safe for all remaining consumers.
