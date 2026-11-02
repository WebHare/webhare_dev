---
name: openapi
description: "Working with WebHare OpenAPI YAML specifications and TypeScript implementations. Use when adding or changing endpoints, schemas, request parameters, generated wh:openapi types, TypedRestRequest handlers, or createOpenAPIClient calls."
---

# WebHare OpenAPI development

WebHare modules can define an OpenAPI specification in YAML and connect
operations to TypeScript handlers with `x-webhare-implementation`.

## Registering an OpenAPI service

Place the specification and TypeScript implementation in the module, then
register the service in `moduledefinition.yml`:

```yaml
openApiServices:
  example:
    spec: openapi/example/example.yml
```

Mount the service at a backend path in `moduledefinition.xml`:

```xml
<backend>
  <openapi path="allroots:/.example/api/" service="example" />
</backend>
```

The YAML `openApiServices` entry registers the service; the XML `<openapi>`
element mounts it. These are separate configuration steps.
The `path` is the public API base URL; operation paths in YAML are relative to it. A service can be mounted at the previous REST API path to migrate implementations without changing client URLs. The OpenAPI service also provides its document at `openapi.json` and Swagger UI at `openapi/swagger-ui` below the mount path.

An operation can delegate to existing HareScript object methods while the service is migrated:

```typescript
import { makeObject } from "@webhare/harescript";

const api = await makeObject("mod::example/lib/api.whlib#Api");
const result = await api.GetItems();
```

Import `makeObject` from `@webhare/harescript`. Its result is a dynamic HareScript object proxy; invoke the existing public methods with their native arguments and return their results through the typed request's `createJSONResponse`.

## Generated TypeScript definitions

TypeScript handlers and clients import generated definitions through paths such as:

```typescript
import type { TypedRestRequest, components } from "wh:openapi/example/api";
```

After changing an OpenAPI YAML type, operation, or parameter, always run:

```sh
wh apply config
```

Do this before validating TypeScript or running tests. It regenerates the `wh:openapi/*` definitions used by `TypedRestRequest` and `createOpenAPIClient`. Editor diagnostics can remain stale briefly after regeneration; `wh validate` and the relevant test use the current generated definitions.

## Typed handlers

Type handlers with their exact operation key:

```typescript
export async function getItems(req: TypedRestRequest<AuthInfo, "get /items">): Promise<WebResponse> {
  const filter = req.params.filter;
  return req.createJSONResponse(HTTPSuccessCode.Ok, []);
}
```

Use `req.params` for OpenAPI path and query parameters instead of reparsing `req.webRequest.url`. Use `req.body` for a typed request body.

## Comma-separated query lists

The WebHare OpenAPI framework does not support `explode: false` for array query parameters. To accept a URL such as `?type=first,second`, define a string with a validation pattern, following this shape:

```yaml
parameters:
  itemType:
    description: "Types to filter, comma separated. Eg ?itemType=first,second"
    in: query
    required: false
    name: itemType
    schema:
      type: string
      pattern: "^(first|second)(,(first|second))*$"
```

Split the validated value in the handler and provide the unfiltered default explicitly:

```typescript
const requestedTypes = new Set((req.params.itemType ?? "first,second").split(","));
```

Typed client calls pass the comma-separated value as a string:

```typescript
await client.get("/items", { params: { itemType: "first,second" } });
```

## Validation workflow

1. Edit the YAML specification and implementation.
2. Run `wh apply config`.
3. Run `wh validate` on the implementation and affected tests.
4. Run the narrow OpenAPI test covering the changed operation.

Test the omitted optional parameter, each individual filter value, and accepted combinations when behavior differs.