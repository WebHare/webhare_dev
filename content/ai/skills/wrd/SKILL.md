---
name: wrd
description: "Working with WRD schemas (WebHare's entity/data framework) - opening schemas, the module:tag naming scheme, renaming/moving schemas, autocreate behavior, and TypeScript bindings. Use when creating, renaming, moving, or querying WRD schemas, or migrating legacy wh:wrd imports and WRDSchema constructors to the WebHare 6.0 wrd() API."
---

# WRD schema naming

A WRD schema's full name is `<modulename>:<tag>`, built from the `<schema tag="...">` declared inside a module's `<wrdschemas>` section in moduledefinition.xml, eg:

```xml
<wrdschemas>
  <schema tag="leadsschema" autocreate="true" definitionfile="data/leads.wrdschema.xml" />
</wrdschemas>
```

- Open it in HareScript with `OpenWRDSchema("modulename:tag")` (`mod::wrd/lib/api.whlib`).
- In WebHare 6.0+, open it in TypeScript with `import { wrd } from "@webhare/wrd"` and `wrd("modulename:tag")`. This uses the modern API and infers the schema type for registered literal names.
- Legacy TypeScript code uses `import { <tag>Schema } from "wh:wrd/<modulename>"` (export name is the tag verbatim + `Schema`, eg tag `leadsschema` -> `leadsschemaSchema`). Replace these imports with the modern API when migrating to WebHare 6.0.

# Migrating TypeScript to the WebHare 6.0 WRD API

Use named imports from `@webhare/wrd`, not a default import. Replace legacy schema objects, constructors, and generated types together:

```typescript
import { wrd, type WRDSchemaLike, type WRDInsertable } from "@webhare/wrd";

const configSchema = wrd("system:config");
type ApiSecretInput = WRDInsertable<WRDSchemaLike["system:config"]["apiSecret"]>;
```

Common replacements:

| Legacy reference | Modern reference |
| --- | --- |
| `systemConfigSchema` | `wrd("system:config")` |
| `systemUsermgmtSchema` | `wrd("system:usermgmt")` |
| `System_ConfigSchemaType` | `WRDSchemaLike["system:config"]` |
| `System_UsermgmtSchemaType` | `WRDSchemaLike["system:usermgmt"]` |
| `WRD_IdpSchemaType` | `WRDSchemaLike["wrd:idp"]` |
| `Platform_BasewrdschemaSchemaType` | `WRDSchemaLike["platform:basewrdschema"]` |
| `WRD_Idp_WRDPerson` | `WRDSchemaLike["wrd:idp"]["wrdPerson"]` |

The same pattern applies to other modules: derive the key from their schema declaration, not from guesses about the generated export's capitalization. For example, `LeadsschemaSchemaType` from `wh:wrd/example` becomes `WRDSchemaLike["example:leadsschema"]`.

For a runtime schema name with a known structural type, use `wrd<WRDSchemaLike["module:tag"]>(runtimeSchemaName)`. Preserve the original runtime name: the type parameter may intentionally describe a different schema with the same structure. For an arbitrary string with no known schema type, use `wrd<"*">(runtimeSchemaName)`.

The primary auth schema is configurable. Do not assume its credential fields are declared by `WRDSchemaLike["system:usermgmt"]`: that base type does not declare `wrdContactEmail` or `whuserPassword`. Check the actual configured schema and generated types before treating a missing field as a rename. Use the appropriate structural type when known, or `wrd<"*">` for an unknown runtime schema, not a cast to an unrelated schema.

`WRDSchema` exported by `@webhare/wrd` is the legacy constructor. Merely changing `new WRDSchema<LegacyType>(name)` to `new WRDSchema<WRDSchemaLike["module:tag"]>(name)` does NOT modernize its runtime behavior. Use `wrd<WRDSchemaLike["module:tag"]>(name)` and, for schema-object annotations, `WRDSchemaType<WRDSchemaLike["module:tag"]>`. A type cast alone does not convert a legacy object's returned values.

## Authentication and schema settings

- Use `AuthenticationSettings.fromPasswordHash(hash)` from `@webhare/wrd` to construct password/authentication-settings values without a HareScript bridge. `"PLAIN:secret"` is a known-password test fixture, not a safe production credential.
- Use `getSchemaSettings(schema, fields)` and `updateSchemaSettings(schema, values)` from `@webhare/wrd` instead of manually looking up the settings entity. Run updates inside a transaction.
- The settings entity is type `wrdSettings` (HareScript `wrd_settings`) with tag `WRD_SETTINGS`, plural. To enable dynamic registration, use `await updateSchemaSettings(usermgmtSchema, { dynamicRegistration: { enabled: true } })`.
- Settings updates replace the supplied field's value; they do not deep-merge JSON. Read and merge explicitly when existing JSON properties must be retained.

## Importing entity data

- Filter read-only attributes before reusing exported data for inserts or updates. For updates, explicitly remove `wrdId` as well: the read-only metadata filter alone does not remove it, and the update API rejects it.
- `wrdGuid` is writable and subject to uniqueness checks. Do not copy another entity's GUID into an update unless changing the GUID is intended.

## Fields and dates

Update selected fields, insert/update payloads, output-map values, result accesses, and test expectations together:

| Legacy field | Modern field |
| --- | --- |
| `wrdCreationDate` | `wrdCreated` |
| `wrdModificationDate` | `wrdModified` |
| `wrdLimitDate` | `wrdClosed` |
| `wrdInfix` | `wrdLastNamePrefix` |

Modern WRD DateTime results are `Temporal.Instant`, and Date results are `Temporal.PlainDate`. Replace DateTime `.getTime()` reads with `.epochMilliseconds`, use `Temporal.Instant.compare()` for ordering, and update helper types and expected values. For example, signing-key `availableSince` values become `Temporal.Instant`; create them with `Temporal.Now.instant()`. Modern base person/organization types no longer expose the legacy `wrdTitle` attribute. Consult the generated modern types for other differences.

Do not rename unrelated database columns such as `creationdate` merely because a WRD attribute changed.

## Migration checklist

1. Search all requested workspace roots for `wh:wrd/...` , including type-only imports and individual entity types. Searching only a few known schema identifiers misses other modules and exports.
2. Make direct, scoped patches rather than an automated rewrite script. Do not edit generated files manually; regenerate them with `wh apply config` when needed.
3. Merge `wrd` and `WRDSchemaLike` into existing `@webhare/wrd` imports. Remove redundant aliases that only preserve an old generated type name. If one function accesses the same schema repeatedly, use a function-local descriptive constant such as `configSchema`, `usermgmtSchema`, or `leadsSchema`, not the generic `schema`.
4. Before removing a `WRDSchema` import, check EVERY constructor use in that file and migrate the remaining uses. Do not mechanically rewrite declarations or generator metadata as though they were executable schema references.
5. Check TypeScript diagnostics, then run the narrow affected tests using the `running-tests` skill. Editor diagnostics can lag or miss a runtime path; a clean Problems panel is not proof that a removed import has no callers. Recheck diagnostics after dependent types refresh. For module-wide validation, use `wh checkmodule <modulename>` (or the `webhare_checkmodule` tool); it takes longer but checks the whole module, not just the files open in the editor. It complements rather than replaces behavioral tests.

# Renaming or moving a schema to another module

The full name (`module:tag`) is stored as `wrd.schemas.name` in the database. To rename/move a schema, open it and call `UpdateMetadata` with the new full name as `tag`:

```harescript
LOADLIB "mod::wrd/lib/api.whlib";

OBJECT wrdschema := OpenWRDSchema("oldmodule:oldtag");
IF(ObjectExists(wrdschema))
  wrdschema->UpdateMetadata([ tag := "newmodule:newtag" ]);
```

Only put this in a `<runonce>` script (see the `modules` skill) - never at ordinary load/request time.

`UpdateMetadata` (defined in `mod::wrd/lib/internal/wrdschema.whlib`) only accepts a fixed set of cells: `languages` (rejected, no longer supported), `description`, `name`/`tag`, `protected`, `usermgmt`, `accounttype`, `accountlogin(tag)`, `accountpassword(tag)`, `accountemail(tag)`, `title`, `creationdate`. Anything else throws.

Don't name a HareScript variable `schema` - `SCHEMA` is a reserved word. Use `wrdschema` (the codebase convention) instead.

# autocreate and apply ordering (important when moving a schema between modules)

`<schema autocreate="...">` **defaults to `true`**. When autocreate is enabled and no schema matching that `module:tag` exists yet, WebHare creates an empty one from `definitionfile`.

This autocreate/schema-apply step always runs **before** any `poststart` runonce script, both:
- at `wh apply wrd` / `wh apply all` / a WebHare restart (`modules/system/scripts/internal/post-start.whscr`: `UpdateAllModuleSchemas()` runs, then `RunPostStartRunOnceScripts()`), and
- during module install (`modules/system/lib/internal/moduleimexport.whlib`: `UpdateAllModuleSchemas()` runs, then the poststart module task).

Consequence: if you move a `<schema>` declaration to a new module/tag and leave `autocreate="true"` (or omit it), WebHare will create a brand-new **empty** schema under the new name before your rename runonce ever runs, before you can rename the old schema into that name - causing a name clash / orphaned empty schema.

Safe migration order for moving a schema to another module:
1. Remove the `<schema>` node from the old module's moduledefinition.xml.
2. Add the `<schema>` node to the new module's moduledefinition.xml with `autocreate="false"` (leave a comment explaining why), and move the `definitionfile` (the `*.wrdschema.xml`) there too.
3. Add a `poststart` `<runonce>` script in the new module that renames the still-existing old-named schema to the new `module:tag` (see above).
4. After the rename has run everywhere (all environments upgraded), flip `autocreate` back to `true` in a follow-up change, so brand-new installs still get the schema auto-created.

# Applying changes

- After editing a moduledefinition.xml `<wrdschemas>` section or a `*.wrdschema.xml` definition file, run `wh apply config` to regenerate the TypeScript bindings, including the legacy `wh:wrd/<module>` exports and modern `WRDSchemaLike` registrations.
- To actually apply the schema definition to the database (create/alter tables, run the autocreate check), run `wh apply wrd` (or `wh apply all`). This also happens automatically on module install and WebHare restart.

See also: the `directory-structure` skill for general `<modulename>:<tag>` / `mod::` resolution, and the `modules` skill for moduledefinition.xml conventions (runonce scripts, dependencies, module merges).
