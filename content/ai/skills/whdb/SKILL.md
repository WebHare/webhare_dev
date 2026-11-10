---
name: whdb
description: "Use WebHare's database from TypeScript with @webhare/whdb: transactions (work) with runInWork, beginWork/commitWork, await using, rollback and dry runs, runInSeparateWork, mutexes and autoRetry on serialization conflicts, onFinishWork/broadcastOnCommit, declaring a module's own PostgreSQL tables with <databaseschema> in moduledefinition.xml, the generated wh:db/<module> Kysely types, querying with db() and raw query(), nextVal and blobs. Use for any database transaction or own-table work, and when converting HareScript GetPrimary()->BeginWork()/CommitWork() code."
---

# WebHare database (`@webhare/whdb`)

`@webhare/whdb` gives TypeScript code access to WebHare's PostgreSQL database: transactions ("work") for every
database write, and Kysely queries on tables a module declares itself. WRD, WHFS and other platform APIs run on the
same connection and inside the same work, so one transaction can cover all of them.

For entity data (people, organizations, user-managed records) use WRD instead of an own table; see the
[wrd skill](../wrd/SKILL.md), which also explains when an own table is the better choice.

## Work (transactions)

Every database write must run inside work. A write outside work throws, with the misleading message
"Work has already been closed". Reads don't need work.

### `runInWork`: the default

```typescript
import { runInWork } from "@webhare/whdb";

const id = await runInWork(async () => {
  // ... writes ...
  return newId; // the return value is passed on
});
```

- Commits when the function returns, rolls back and rethrows when it throws.
- Opens work itself, so it throws if work is already open ("Work has already been opened"). Don't nest it; pass
  the open work down instead, or use `runInSeparateWork` (below) when you really need an independent transaction.
- Options (all optional):
  - `mutex: "mymodule:import"` (or an array): locks the named mutexes before the work starts and releases them when
    it finishes. Use it when concurrent processes may create the same records or allocate the same value. To
    serialize against other writers, use the mutex name they already take; otherwise use a name owned by your
    module. Mutex names must be module-qualified (`<module>:<name>`).
  - `autoRetry: true`: retries the whole function on a serialization failure or deadlock (up to `maxRetries`,
    default 10, with a short backoff). Only use it for short functions without side effects outside the database,
    since they run again on every retry.
  - `isolationLevel`: `"read committed"` (default), `"repeatable read"` or `"serializable"`; `readOnly: true`.

### `beginWork` with `await using`

When the work doesn't fit a single callback (eg. long scripts, converted HareScript), use the work object:

```typescript
import { beginWork } from "@webhare/whdb";

await using work = await beginWork({ mutex: "mymodule:import" });
// ... writes ...
if (!dryRun)
  await work.commit();
// leaving the scope without commit() rolls back, including on exceptions
```

- The method is `commit()` (or `rollback()`), not `finish()`.
- For a dry run, do the writes and skip `commit()`; the work is rolled back on disposal.
- Don't wrap the work in a `try`/`catch` that only rolls back and rethrows; disposal already does that.
- `beginWork()`/`commitWork()`/`rollbackWork()` without `await using` also work, but an exception between them
  leaves the work open. Some APIs and examples (eg. task runners, which commit for you) still use this form.
- `isWorkOpen()` tells whether work is open, `workHasMutex(name)` whether the current work holds a mutex.

### Separate work

`runInSeparateWork(fn, options?)` runs `fn` in its own transaction on a separate connection, while the current work
stays open. Its writes are committed independently (eg. logging an attempt that must survive a rollback of the
outer work), and it doesn't see the outer work's uncommitted changes.

### Acting on commit

- `broadcastOnCommit(event, data?)` sends a backend event only when the work commits. Use it instead of broadcasting
  directly, so listeners never see data that was rolled back. Events without data are sent once per commit.
- `onFinishWork({ onCommit, onRollback, onBeforeCommit, ... })` registers callbacks on the current work, eg. to
  delete a file only once the commit succeeded. Pass `{ uniqueTag }` to register a handler once per work and get
  the existing one back on later calls.

## Own tables

### Declare the tables

Declare tables in `<databaseschema>` in `moduledefinition.xml`; there is no YAML equivalent. The schema is named
after the module, and the definition is validated against `mod::system/data/validation/databaseschema.xsd`.

```xml
<databaseschema xmlns:d="http://www.webhare.net/xmlns/whdb/databaseschema">
  <d:table name="imports" primarykey="id">
    <d:integer name="id" autonumberstart="1" />
    <d:varchar name="source" maxlength="256" />
    <d:datetime name="started" />
    <d:boolean name="finished" />
    <d:blob name="logfile" />
  </d:table>
  <d:table name="importrows" primarykey="id" parentlinkcolumn="import">
    <d:integer name="id" autonumberstart="1" />
    <d:integer name="import" nullable="0" ondelete="cascade" references=".imports" />
    <d:integer name="person" ondelete="set default" references="wrd.entities" />
    <d:varchar name="status" maxlength="32" />
    <d:index name="byperson" columns="person" />
  </d:table>
</databaseschema>
```

- Column types: `integer`, `integer64`, `number`, `float`, `money`, `boolean`, `datetime`, `varchar` (requires
  `maxlength`), `blob`, `bytea`.
- `references` points to another table: `.imports` for a table in the same schema, `<schema>.<table>` otherwise
  (eg. `wrd.entities` for WRD entities). `ondelete` is `cascade` or `set default`.
- `nullable` only matters for references and blobs. Other columns are never `null`; an unset integer is `0`, an
  unset varchar `""`. A reference is `null` when unset unless you declare it `nullable="0"`.
- `<d:index name="..." columns="col1 col2" unique="1" />` adds an index.
- To remove a table, column or index, replace it with `<d:obsoletetable>`, `<d:obsoletecolumn>` or
  `<d:obsoleteindex>` with the same `name`, so existing installations drop it.
- Run `wh apply config` after changing `<databaseschema>`. That updates the database and regenerates the Kysely
  types in `wh:db/<module>`. Don't edit the generated file.

### Query with Kysely

```typescript
import { db, runInWork } from "@webhare/whdb";
import type { MymoduleDB } from "wh:db/mymodule";

const importId = await runInWork(async () => {
  const row = await db<MymoduleDB>()
    .insertInto("mymodule.imports")
    .values({ source: "crm", started: new Date, finished: false })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
});

const failed = await db<MymoduleDB>()
  .selectFrom("mymodule.importrows")
  .select(["id", "person"])
  .where("import", "=", importId)
  .where("status", "=", "failed")
  .execute();
```

- The database interface is named after the module in UpperCamelCase plus `DB` (`my_module` becomes `MyModuleDB`)
  and tables are addressed as `"<module>.<table>"`.
- The primary key (and `noupdate` columns) are generated: leave them out on insert. Use `nextVal("mymodule.imports.id")`
  (or `nextVals(column, count)`) when you need the id before inserting, eg. to refer to it from other rows.
- Use `sql` (re-exported from Kysely) for expressions Kysely can't build, and `query(sqltext, params)` for raw SQL.
- Blob columns take and return a `WebHareBlob` (from `@webhare/services`).

## HareScript equivalents

| HareScript | TypeScript |
| --- | --- |
| `GetPrimary()->BeginWork()` ... `GetPrimary()->CommitWork()` | `await runInWork(async () => { ... })`, or `await using work = await beginWork()` ... `await work.commit()` |
| `GetPrimary()->BeginWork([ mutex := "mod:x" ])` | `beginWork({ mutex: "mod:x" })` / `runInWork(fn, { mutex: "mod:x" })` |
| `GetPrimary()->RollbackWork()` | `rollbackWork()`, or let `await using` roll back |
| `GetPrimary()->IsWorkOpen()` | `isWorkOpen()` |
| `GetPrimary()->BroadcastOnCommit(...)` | `broadcastOnCommit(...)` |
| `SELECT ... FROM mymodule.table` | `db<MymoduleDB>().selectFrom("mymodule.table")...` |

Tollium screens use `this->BeginWork()` ... `work->Finish()`; that's HareScript-only.

## Verify

- Run `wh checkmodule <module>` to type-check queries against the generated `wh:db/<module>` types.
- After `wh apply config`, check that `wh:db/<module>` contains your tables; `wh db showusage` lists the tables in
  the database.

## Related skills

- [wrd](../wrd/SKILL.md): WRD entities, and choosing WRD or an own table.
- [tasks](../tasks/SKILL.md): scheduling tasks requires open work; task runners commit for you.
- [localcache](../localcache/SKILL.md): invalidating caches when data changes.
