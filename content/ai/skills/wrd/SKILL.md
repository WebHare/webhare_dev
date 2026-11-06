---
name: wrd
description: "Model and use WRD (WebHare's entity/relation data store) from TypeScript with the modern wrd() API from @webhare/wrd: designing types (object, attachment, link, domain), attributes, arrays and domains in *.wrdschema.xml, registering schemas in moduledefinition.yml/xml, querying with query().select().where(), joining via links with enrich(), history modes (now/all/active), insert/update/upsert/sync, close vs delete, transactions (runInWork), choosing WRD vs an own <databaseschema> table with Kysely db(), and migrating legacy wh:wrd/... imports. Use for any WRD schema or WRD data work in TypeScript."
---

# WRD

WRD stores *entities* of *types* inside a *schema*. Every entity is a row in one shared set of tables with an id
(`wrdId`), a GUID (`wrdGuid`), an optional `wrdTag`, a lifetime (`wrdCreated`..`wrdClosed`) and attribute values.
The schema's types and attributes are declared in a schema definition file (`*.wrdschema.xml`), registered in the
module definition, and accessed from TypeScript with `wrd("module:tag")`.

This skill covers modern TypeScript code. Related material:

- [references/schema-definitions.md](references/schema-definitions.md) - the `*.wrdschema.xml` format, every
  attribute type, seeding values, and registering schemas in `moduledefinition.yml`/`.xml`.
- [references/querying.md](references/querying.md) - full query builder, filter conditions per attribute type,
  `enrich()` options, history modes in detail, `sync()`.
- [references/migrating-legacy.md](references/migrating-legacy.md) - converting `wh:wrd/...` imports,
  `new WRDSchema(...)`, legacy field names and `Date` values to the modern API.
- [wrd-in-harescript skill](../wrd-in-harescript/SKILL.md) - the HareScript WRD API, Tollium entity editors and
  lists, and TypeScript equivalents of common HareScript patterns.
- [wrd-migrations skill](../wrd-migrations/SKILL.md) - `<migration>` elements for converting existing data when a
  definition changes.

## Recognize modern vs legacy code

Only write modern code. Existing code in modules is often legacy; don't copy patterns from it without converting.

| Modern (use this) | Legacy (don't copy) |
| --- | --- |
| `import { wrd } from "@webhare/wrd"` + `wrd("mymodule:crm")` | `import { crmSchema } from "wh:wrd/mymodule"` |
| `wrd<WRDSchemaLike["mymodule:crm"]>(name)` | `new WRDSchema<...>(name)` |
| `schema.query("wrdPerson")` | `schema.selectFrom("wrdPerson")` |
| `wrdCreated`, `wrdClosed`, `wrdModified`, `wrdOrder`, `wrdLastNamePrefix` | `wrdCreationDate`, `wrdLimitDate`, `wrdModificationDate`, `wrdOrdering`, `wrdInfix` |
| `Temporal.Instant` / `Temporal.PlainDate` / `Temporal.PlainTime` results | `Date` results |
| `enrich(..., { allowMissing: true })` | `enrich(..., { rightOuterJoin: true })` |

Legacy schema objects have the same method names (`query`, `insert`, `getFields`, ...) but different field names
and value types, so a legacy snippet can look modern. Check the import. See
[references/migrating-legacy.md](references/migrating-legacy.md) to convert.

## Workflow

1. Decide whether the data belongs in WRD at all (see [WRD or an own table](#wrd-or-an-own-table)).
1. Model the types (see [Modeling](#modeling)) and write or extend the `*.wrdschema.xml` file
   ([references/schema-definitions.md](references/schema-definitions.md)).
1. Register the schema in the module definition, preferably `moduledefinition.yml`:

   ```yaml
   wrdSchemas:
     crm:
       schema: data/crm.wrdschema.xml
       title: CRM
   ```

1. Run `wh apply config` to regenerate the TypeScript types (`WRDSchemaLike["mymodule:crm"]`), then
   `wh apply wrd` to create/update the schema in the database. Both also happen on module install and restart.
1. Write code against `wrd("mymodule:crm")`. Let TypeScript infer result types; don't declare your own row types or
   cast query results.
1. Run `wh checkmodule <module>` (or check TypeScript diagnostics) and the relevant tests
   ([running-tests skill](../running-tests/SKILL.md)).

## Modeling

Pick the metatype by the relationship, not by the UI you have in mind:

| Metatype | XML element | Has | Use for |
| --- | --- | --- | --- |
| object | `<object>` | own attributes, optional `parent` type to inherit from | independent things: people (`wrd_person`), organizations, products, events |
| attachment | `<attachment linkfrom="x">` | required `wrdLeftEntity` (the owner, of type x) | 1-to-many children that belong to one owner and need their own identity, history or queries: a person's notes, an order's lines |
| link | `<link linkfrom="x" linkto="y">` | required `wrdLeftEntity` and `wrdRightEntity` | many-to-many relations, especially with data on the relation: employment (person to organization, with role and start date) |
| domain | `<domain>` | optional `wrdLeftEntity` (parent value, for trees), `wrdTitle`, `wrdOrder` | lists of choices that users manage or that carry data: countries, categories, product groups |

Then pick how an entity refers to others:

- **`domain` attribute** (`<domain tag="country" domain="country"/>`): a single reference to an entity of the
  named type. Despite the name, the target may be any type, eg. `domain="wrd_person"`. TypeScript value:
  `number | null` (the `wrdId`; `null` means empty, never `0`).
- **`domainarray` attribute**: a set of references. Value: `number[]`.
- **`enum` / `enumarray` attribute**: a fixed list of string values known at development time (status, kind).
  Prefer `enum` over a domain type when users never edit the list and the values have no data of their own.
- **`array` attribute**: rows embedded in the entity (eg. phone numbers, price tiers). Array rows have no identity,
  no history of their own, can't be referenced, and can only be filtered with `mentions`/`mentionsany`. You always
  write the whole array. If you need to query, reference or edit rows individually, use an attachment type instead.

Rules for new definitions:

- Don't use `wrd_relation` as `parent`, `linkfrom` or `linkto`. Link to `wrd_person` or `wrd_organization`
  directly. The modern TypeScript types don't expose `wrdRelation`.
- Use `json` with a `typedeclaration` for structured data, not `record` (HSON).
- Use `domain`/`domainarray` and `attachment`, not the legacy `domainsingle`/`domainmultiple`/`classification`.
- Don't add `statusrecord` attributes (TypeScript calls them `deprecatedStatusRecord`).
- Mark attributes `required="true"` and `unique="true"` where that's a real invariant; WRD enforces both.
- Mark secrets and installation-specific values `unsafetocopy="true"`, and types with personal data
  `haspersonaldata="true"`.
- Tags in the XML are lowercase snake_case (`contact_email`). TypeScript uses camelCase (`contactEmail`); type
  `wrd_person` becomes `"wrdPerson"`.

## Opening a schema

```typescript
import { wrd } from "@webhare/wrd";

const crmSchema = wrd("mymodule:crm"); // typed, because mymodule:crm is registered
```

- `wrd()` is synchronous and cached; calling it repeatedly is cheap. It doesn't check that the schema exists
  (`await crmSchema.exists()` does).
- For a schema name only known at runtime but with a known structure: `wrd<WRDSchemaLike["mymodule:crm"]>(name)`.
  For a completely unknown schema: `wrd<"*">(name)` (untyped).
- Name the variable after the schema (`crmSchema`, `usermgmtSchema`), not `schema`.

## Reading

```typescript
// One entity by id. Throws if missing unless allowMissing: true (then returns null)
const person = await crmSchema.getFields("wrdPerson", personId, ["wrdFirstName", "wrdLastName", "contactEmail"]);

// Rename fields with an object, nest them with nested objects
const info = await crmSchema.getFields("wrdPerson", personId, { name: "wrdFullName", email: "contactEmail" });

// Find a single id by one field or by several fields (null if none, throws if several match)
const byEmail = await crmSchema.search("wrdPerson", "contactEmail", "pat@example.net");
const byKey = await crmSchema.find("wrdPerson", { externalId: "A-1001" });

// Queries
const customers = await crmSchema.query("wrdOrganization")
  .select(["wrdId", "wrdOrgName", "country"])
  .where("isCustomer", "=", true)
  .where("wrdOrgName", "like", "A*")
  .execute();
```

- `select("wrdId")` (a single string) returns an array of values (`number[]`); `select([...])` or
  `select({...})` returns objects.
- `where()` calls are ANDed. There is no OR: use `"in"` with a list of values, or run several queries and merge.
- String comparisons are case-sensitive unless you pass `{ matchCase: false }` as fourth argument. `email`
  attributes always compare case-insensitively. `like` uses `*` and `?` wildcards.
- Use `executeRequireExactlyOne()` / `executeRequireAtMostOne()` instead of `execute()` + `[0]` when you expect
  one result; they throw on unexpected duplicates.
- Never read in a loop (`for (id of ids) await getFields(...)`). Query with `.where("wrdId", "in", ids)` or use
  `enrich()`.
- Dates come back as `Temporal.Instant` (`datetime`), `Temporal.PlainDate` (`date`) and `Temporal.PlainTime`
  (`time`). Empty values are `null`, empty strings `""`, empty domains `null`, empty arrays `[]`.

### Joins: follow links with enrich()

The query builder reads one type at a time. To combine types, select the id fields and `enrich()` them with fields
from the other type, keyed on that id. This replaces SQL-style joins; don't invent pseudo-SQL.

```typescript
// Employments of an organization, with the employee's name
const staff = await crmSchema.query("employment")          // link: wrdLeftEntity = person, wrdRightEntity = organization
  .select(["wrdLeftEntity", "role", "startDate"])
  .where("wrdRightEntity", "=", organizationId)
  .enrich("wrdPerson", "wrdLeftEntity", { name: "wrdFullName", email: "contactEmail" })
  .execute();
// -> [{ wrdLeftEntity: 123, role: "...", startDate: Temporal.PlainDate, name: "...", email: "..." }, ...]

// Enrich rows that came from elsewhere (eg. your own table)
const withNames = await crmSchema.enrich("wrdPerson", logRows, "personId", ["wrdFullName"], { allowMissing: true });
```

- **`enrich()` is an inner join by default**: rows whose id is `null` or doesn't match an entity (eg. a closed
  one) are *removed*. Pass `{ allowMissing: true }` to keep them with default values.
- `enrich()` uses history mode `now` unless you pass `historyMode`.
- Chain several `enrich()` calls to go further (link -> person -> organization).
- For the reverse direction (all employments of a person), query the link type with
  `.where("wrdLeftEntity", "=", personId)` or `"in"` for many persons at once.

More examples and the exact conditions per attribute type are in [references/querying.md](references/querying.md).

## History modes

Every entity is visible from `wrdCreated` until `wrdClosed`. Closing keeps the entity (and its history) but hides it
from normal queries. The history mode selects which entities a read considers:

| Mode | Includes |
| --- | --- |
| `now` | entities that are live right now |
| `active` | live entities plus *temporary* entities (created with `{ temp: true }`, not yet made permanent) |
| `all` | everything except temporaries: past, closed and future entities |
| `unfiltered` | everything, including temporaries |
| `at` / `range` | entities live at a moment / anywhere in a period (pass a `Date`) |

Defaults differ per function. Pass `historyMode` explicitly when it matters:

| Function | Default |
| --- | --- |
| `query()` / `modify()` | `now` |
| `search()`, `find()`, `upsert()`, `enrich()` | `now` |
| `getFields()` | `active` |

Consequences:

- `getFields(id)` throws for a closed entity; pass `{ historyMode: "all" }` to read it.
- A query won't find what you just closed. To reopen an entity, `update(type, id, { wrdClosed: null })`; with
  `upsert()` you must pass `historyMode: "all"` to match (and reopen) the closed one.
- Set it on a query with `.historyMode("all")`, on other functions with `{ historyMode: "all" }`.

## Writing

All writes must run inside work. Outside work they throw (with the misleading message "Work has already been
closed").

```typescript
import { runInWork } from "@webhare/whdb";

const personId = await runInWork(async () => {
  const id = await crmSchema.insert("wrdPerson", { wrdFirstName: "Pat", wrdLastName: "Doe", contactEmail: "pat@example.net" });
  await crmSchema.insert("employment", { wrdLeftEntity: id, wrdRightEntity: organizationId, role: "owner" });
  return id;
});

await runInWork(async () => {
  await crmSchema.update("wrdPerson", personId, { phone: "+31 50 1234567" });
  await crmSchema.update("wrdPerson", { externalId: "A-1001" }, { isActive: false }); // must match exactly one
});
```

- `insert()` returns the new `wrdId`. Required attributes must be present (TypeScript enforces this).
- `update()` only changes the fields you pass. An `array` value replaces the whole array; read, modify and write
  it back. A `json` value replaces the whole JSON value (no deep merge).
- Don't pass `wrdId` to `update()`; it throws.
- Use `upsert()` for insert-or-update by a key; it returns `[wrdId, isNew]`:

  ```typescript
  const [orgId, isNew] = await crmSchema.upsert("wrdOrganization",
    { externalId: "K-42" },                                  // match keys (at most one match allowed)
    { wrdOrgName: "Example Ltd" },                           // always written
    { ifNew: { isCustomer: true } });                        // only for new entities
  ```

- Use `modify(type).sync(keyField, rows, { unmatched: "close" })` to make a set of entities match an imported
  list (insert new, update changed, close/delete the rest). See [references/querying.md](references/querying.md).
- Use `runInWork(fn, { mutex: "mymodule:import" })` when concurrent processes may create the same entities, and
  `{ autoRetry: true }` for short transactions that may hit serialization conflicts.
- Use `getEventMasks(types)` to invalidate caches when WRD data changes; see the
  [localcache skill](../localcache/SKILL.md).

### Close vs delete

| Call | Effect |
| --- | --- |
| `close(type, ids)` | sets `wrdClosed` to now. The entity stays readable with `historyMode: "all"`, references stay valid, it can be reopened |
| `delete(type, ids)` | removes the entity permanently |
| `close(type, ids, { mode })` | `delete-closereferred` (delete, but close if referenced), `delete-denyreferred` / `close-denyreferred` (throw if referenced) |

- Close business data you may need to look back at or that other entities refer to. Delete data that is
  meaningless once gone (temporary records, duplicates), and personal data that must be erased.
- Closed entities are kept forever unless the type sets `deleteclosedafter="<days>"`; `keephistorydays` limits how
  long change history is kept.
- Closing doesn't cascade: attachments and links of a closed person stay live. Close them too when needed.
  Deleting an entity also deletes attachments and links that refer to it.
- `unique` attributes are only checked against live entities, so a closed entity doesn't block a new one with the
  same value. Reopening that closed entity later then creates a duplicate; when an entity may come back (eg. a
  returning customer), find it with `historyMode: "all"` and reopen it instead of inserting a new one.

## WRD or an own table

WRD is not the only storage. A module can declare its own PostgreSQL tables with `<databaseschema>` in
`moduledefinition.xml` (there is no YAML equivalent) and access them with Kysely through `db()` from
`@webhare/whdb`. The platform does this itself: audit events and changesets are own tables that refer to WRD
entities.

Use **WRD** for:

- business entities that users manage, especially in Tollium with entity editors and lists;
- data that needs history (closing, reopening, looking back with `at`/`all`);
- people, organizations, accounts and anything used by authentication or user management;
- personal data (types marked `haspersonaldata`), choice lists (domains), files, images and rich text that come
  with WRD's handling.

Use an **own table** for:

- append-only logs and events (clicks, deliveries, API calls, audit-like trails);
- high-volume data written frequently, where per-entity overhead and history don't add value;
- data you need to aggregate, join or sort in SQL with real indexes;
- queue- or state-tracking rows owned by code, not edited by users.

Combine them by giving the own table an integer column that references WRD entities:

```xml
<databaseschema xmlns:d="http://www.webhare.net/xmlns/whdb/databaseschema">
  <d:table name="deliveries" primarykey="id">
    <d:integer name="id" autonumberstart="1" />
    <d:integer name="person" nullable="false" ondelete="cascade" references="wrd.entities" />
    <d:datetime name="sent" nullable="false" />
    <d:varchar name="status" maxlength="32" />
  </d:table>
</databaseschema>
```

```typescript
import { db, runInWork } from "@webhare/whdb";
import type { MymoduleDB } from "wh:db/mymodule";

await runInWork(async () => { // one transaction covers both WRD and the own table
  const personId = await crmSchema.insert("wrdPerson", { wrdFirstName: "Pat", contactEmail: "pat@example.net" });
  await db<MymoduleDB>().insertInto("mymodule.deliveries").values({ person: personId, sent: new Date, status: "queued" }).execute();
});

const rows = await db<MymoduleDB>().selectFrom("mymodule.deliveries").select(["id", "person", "sent"]).where("status", "=", "failed").execute();
const report = await crmSchema.enrich("wrdPerson", rows, "person", { name: "wrdFullName" }, { allowMissing: true });
```

- `ondelete="cascade"` removes your rows when the entity is *deleted*; closing doesn't touch them. Use
  `ondelete="set default"` to keep the rows but clear the reference.
- Run `wh apply config` after changing `<databaseschema>` to regenerate `wh:db/<module>`; the interface is named
  after the module (`my_module` becomes `MyModuleDB`).
- Don't store WRD data in your own table "for speed" when it is really entity data; you lose history, Tollium
  editing and WRD's validation.

## Common mistakes

- Copying a `wh:wrd/...` or `new WRDSchema(...)` snippet and assuming it's modern code.
- Expecting `enrich()` to keep unmatched rows (add `allowMissing: true`).
- Forgetting that `getFields()` sees temporaries but not closed entities, while queries see neither.
- Filtering a field inside an `array` attribute with `=` (only `mentions`/`mentionsany` work, eg.
  `.where("phones.number", "mentions", "...")`).
- Using `0` for an empty domain value (use `null`), or a `Date` for a `date` attribute (use `Temporal.PlainDate`).
- Writing outside `runInWork()`/`beginWork()`.
- Reading or writing entities one by one in a loop.
- Re-implementing a join by hand instead of `.where("wrdId", "in", ids)` or `enrich()`.

## Schema naming, moving and settings

A schema's full name is `<module>:<tag>`, from the key under `wrdSchemas:` in `moduledefinition.yml` or the
`<schema tag="...">` under `<wrdschemas>` in `moduledefinition.xml`. Schemas are created automatically when
declared (unless `autoCreate: false`, `abstract: true` or the name contains a wildcard).

To rename or move a schema to another module, see
[references/schema-definitions.md](references/schema-definitions.md#renaming-or-moving-a-schema). Moving a schema
requires `autoCreate: false` during the transition, or WebHare creates an empty schema under the new name first.

Schema-wide settings live in the `wrdSettings` entity. Use `getSchemaSettings(schema, fields)` and
`updateSchemaSettings(schema, values)` from `@webhare/wrd` instead of querying it. Settings updates replace each
supplied field (no deep merge of JSON).

See also: the [modules skill](../modules/SKILL.md) for moduledefinition conventions and moving functionality
between modules, and the [directory-structure skill](../directory-structure/SKILL.md) for `module:tag` resolution.
