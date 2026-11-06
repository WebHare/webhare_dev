# Migrating legacy TypeScript WRD code to the wrd() API

Most existing module code still uses the legacy API: generated schema objects from `wh:wrd/<module>` or
`new WRDSchema(...)`. These look similar to modern code but return `Date` values and legacy field names. Convert
them when you touch the code; never copy them into new code.

## Imports and schema objects

Use named imports from `@webhare/wrd`:

```typescript
import { wrd, type WRDSchemaLike, type WRDInsertable } from "@webhare/wrd";

const configSchema = wrd("system:config");
type ApiSecretInput = WRDInsertable<WRDSchemaLike["system:config"]["apiSecret"]>;
```

| Legacy reference | Modern reference |
| --- | --- |
| `import { crmSchema } from "wh:wrd/mymodule"` (tag `crm`) | `wrd("mymodule:crm")` |
| `systemConfigSchema` | `wrd("system:config")` |
| `systemUsermgmtSchema` | `wrd("system:usermgmt")` |
| `System_ConfigSchemaType` | `WRDSchemaLike["system:config"]` |
| `System_UsermgmtSchemaType` | `WRDSchemaLike["system:usermgmt"]` |
| `WRD_IdpSchemaType` | `WRDSchemaLike["wrd:idp"]` |
| `Platform_BasewrdschemaSchemaType` | `WRDSchemaLike["platform:basewrdschema"]` |
| `WRD_Idp_WRDPerson` | `WRDSchemaLike["wrd:idp"]["wrdPerson"]` |
| `CrmSchemaType` from `wh:wrd/mymodule` | `WRDSchemaLike["mymodule:crm"]` |
| `schema.selectFrom(type)` | `schema.query(type)` |
| `enrich(..., { rightOuterJoin: true })` | `enrich(..., { allowMissing: true })` |

- The legacy export name is the schema tag verbatim + `Schema` (tag `crm` -> `crmSchema`, tag `contactsschema` -> `contactsschemaSchema`). Derive
  the modern key from the schema declaration (`module:tag`), not from the export's capitalization.
- For a runtime schema name with a known structure use `wrd<WRDSchemaLike["module:tag"]>(runtimeName)` and keep
  the original runtime name: the type parameter may describe a different schema with the same structure. For an
  unknown schema use `wrd<"*">(runtimeName)`.
- `WRDSchema` exported by `@webhare/wrd` is the legacy constructor. Changing `new WRDSchema<Legacy>(name)` to
  `new WRDSchema<WRDSchemaLike["module:tag"]>(name)` does NOT modernize its runtime behavior. Use `wrd<...>(name)`,
  and `WRDSchemaType<WRDSchemaLike["module:tag"]>` for annotations. A type cast doesn't convert returned values.
- The primary auth schema is configurable. `WRDSchemaLike["system:usermgmt"]` doesn't declare `wrdContactEmail` or
  `whuserPassword`; check the actual configured schema before treating a missing field as a rename. Use the right
  structural type, or `wrd<"*">` for an unknown runtime schema, not a cast to an unrelated schema.

## Fields and values

Update selected fields, insert/update payloads, output-map keys, result accesses and test expectations together:

| Legacy | Modern |
| --- | --- |
| `wrdCreationDate` | `wrdCreated` |
| `wrdModificationDate` | `wrdModified` |
| `wrdLimitDate` | `wrdClosed` |
| `wrdOrdering` | `wrdOrder` |
| `wrdInfix` | `wrdLastNamePrefix` |
| `wrdTitle` on `wrdPerson`/`wrdOrganization` | `wrdFullName` / `wrdOrgName` |
| `wrdRelation` type | not available; use `wrdPerson` or `wrdOrganization` |

- DateTime results are `Temporal.Instant`, Date results `Temporal.PlainDate`, Time results `Temporal.PlainTime`
  (legacy: `Date` and milliseconds). Replace `.getTime()` with `.epochMilliseconds`, use
  `Temporal.Instant.compare()` for ordering, and create values with `Temporal.Now.instant()`.
- Legacy code often used `defaultDateTime` / `maxDateTime` from `@webhare/hscompat` for "empty"; modern values use
  `null`.
- The modern API throws when you use a legacy field name, and vice versa.
- Don't rename unrelated database columns such as `creationdate` merely because a WRD attribute changed.

## Authentication and settings

- `AuthenticationSettings.fromPasswordHash(hash)` from `@webhare/wrd` constructs authentication settings without a
  HareScript bridge. `"PLAIN:secret"` is a known-password test fixture, not a production credential.
- Use `getSchemaSettings(schema, fields)` / `updateSchemaSettings(schema, values)` instead of reading the
  `wrdSettings` entity (tag `WRD_SETTINGS`) yourself, eg.
  `await updateSchemaSettings(usermgmtSchema, { dynamicRegistration: { enabled: true } })` inside work.
- Settings updates replace each supplied field; read and merge JSON yourself to keep existing properties.

## Copying or importing entity data

- Filter read-only attributes before reusing exported data for inserts or updates. For updates also remove
  `wrdId`; the update API rejects it.
- `wrdGuid` is writable and must be unique. Don't copy another entity's GUID into an update unless you mean to
  change the GUID.

## Checklist

1. Search all requested workspace roots for `wh:wrd/`, including type-only imports and entity types, and for
   `new WRDSchema(`. Searching only for a few known schema names misses other modules.
1. Make direct, scoped edits rather than an automated rewrite. Never edit generated files; regenerate them with
   `wh apply config`.
1. Merge `wrd` and `WRDSchemaLike` into existing `@webhare/wrd` imports and remove aliases that only preserved old
   generated names. Name schema variables after the schema (`configSchema`, `crmSchema`), not `schema`.
1. Before removing a `WRDSchema` import, check EVERY constructor use in the file. Don't rewrite declarations or
   generator metadata as though they were executable schema references.
1. Check TypeScript diagnostics and run the affected tests ([running-tests skill](../../running-tests/SKILL.md)).
   Editor diagnostics can lag; recheck after dependent types refresh. For module-wide validation use
   `wh checkmodule <module>`; it complements, not replaces, behavioral tests.
