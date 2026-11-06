---
name: wrd-migrations
description: "Write WRD schema migrations: <migration> elements in *.wrdschema.xml definition files that run a HareScript update function once per schema when the definition is applied. Use when renaming or moving WRD types/attributes, converting existing entity data after a schema change, seeding data on schema creation, or re-running a migration by bumping its revision (tag, revision, at, stage, updatefunction)."
---

# WRD schema migrations

A `<migration>` element in a WRD schema definition file (`*.wrdschema.xml`)
runs an update function against each schema built from that definition, once
per migration tag, while WebHare applies the definition. Use it for data or
metadata changes that the declarative definition cannot express: renaming a
type or attribute before the definition is applied, moving values from an old
attribute to a new one, or seeding data when a schema is first created.

For schema naming, `autocreate`, and moving a whole schema to another module,
see the [WRD skill](../wrd/SKILL.md). For module-level one-off scripts that are
not tied to a WRD schema definition, use a `<runonce>` script instead (see the
[modules skill](../modules/SKILL.md)).

## Declaring a migration

Place `<migration>` elements at the top of the definition file, before the
type definitions:

```xml
<schemadefinition xmlns="http://www.webhare.net/xmlns/wrd/schemadefinition">
  <migration tag="mymodule:accountstatus"
             at="update"
             revision="1"
             stage="beforeEntities"
             updatefunction="mod::mymodule/lib/internal/migrations.whlib#MigrateAccountStatus" />
  ...
</schemadefinition>
```

Attributes (source of truth: `mod::wrd/data/schemadefinition.xsd`):

| Attribute | Meaning |
| --- | --- |
| `tag` (required) | Identifies the migration in the schema's completed-migrations list. |
| `updatefunction` (required) | `<library>#<function>`; resolved relative to the definition file, so `mod::` paths and relative paths both work. |
| `revision` | Non-negative integer, default `0`. Bump it to run the migration again. |
| `at` | `create` (only when the schema is first created), `update` (only when the schema already existed), or omitted (both). |
| `stage` | `beforeTypes` (default), `beforeEntities`, or `afterEntities`. See below. |
| `comment` | Free text. |
| `ifenvironset`, `unlessenvironset`, `webhareversion`, ... | Standard WebHare applicability attributes. A migration that does not apply to this WebHare is ignored entirely and not recorded. |

Migrations in files pulled in with `<import definitionfile="...">` are
collected too. A migration in a shared definition (eg. the base schema)
therefore runs for every schema that imports it. Prefix tags with your module
name (`mymodule:...`) so they cannot collide with migrations from other
imported definitions.

## When migrations run

Migrations run inside `UpdateSchema`
(`mod::wrd/lib/internal/metadata/updateschema.whlib`), which is called when:

- a schema is created (`CreateWRDSchema`, `createSchema` from `@webhare/wrd`,
  or autocreate during `wh apply wrd`), with `at=create` semantics;
- an existing schema's definition is applied (`wh apply wrd`, `wh apply all`,
  module install, WebHare restart), with `at=update` semantics.

During `wh apply wrd`, an existing schema is only updated when its definition
resources changed. Editing the definition file to add a migration counts as a
change. To re-apply an unchanged definition, use `wh apply --force wrd`.

Migrations are never run for WRD sync from an external server (`fromexternal`)
or when `ApplySchemaDefinition` is called with `skipmigrations := TRUE`.

### Run-once bookkeeping

A migration is selected when the schema has no completed entry with the same
`tag` and a `revision` greater than or equal to the declared revision. After
its stage, the entry is recorded with the revision, finish time and the
function's return value. The list is stored in the schema's `wrdSettings`
entity (`migrations` field).

- Bumping `revision` makes the migration run once more on every schema that
  completed a lower revision. Keep the same `tag` and update function; make
  the function safe to run against data that already went through earlier
  revisions.
- A migration whose `at` does not match the current operation is **recorded
  as completed without running**. An `at="update"` migration on a newly
  created schema is marked done, so it will not run later either. Likewise,
  adding an `at="create"` migration to a definition marks it done on existing
  schemas without running it.
- `wh apply wrd` updates each schema in its own transaction (holding the
  schema's update mutex). If a migration throws, the whole update of that
  schema rolls back, including the completed-migrations list, and the error is
  reported. The migration is attempted again on the next apply.

### Stages

| Stage | Runs |
| --- | --- |
| `beforeTypes` (default) | Before any type or attribute changes from the definition are applied. Use it to rename existing types or attributes so the definition picks them up instead of creating new ones. |
| `beforeEntities` | After types, attributes and schema metadata are updated, but before the definition's declared entities (eg. domain values) are created or updated. Use it to copy data from an old attribute into a newly defined attribute. |
| `afterEntities` | After the definition's entities are created or updated. Use it when the migration needs those entities. |

Within a stage, migrations run in the order they appear in the parsed
definition. Order the `<migration>` elements in a definition file by stage so
the file reads in execution order: first `beforeTypes`, then `beforeEntities`,
then `afterEntities`.

An attribute that is simply removed from the definition is left in place by
the apply. An attribute declared as `<obsolete tag="..."/>` is deleted while
types are updated, which is **before** `beforeEntities`. To move values from
an old attribute to a new one, do not mark the old attribute obsolete in the
same apply: remove it from the definition, copy the values in a
`beforeEntities` migration, and delete the old attribute at the end of that
migration (`DeleteAttribute`).

## Writing the update function

The update function must be a **public HareScript function**. It is invoked
with `MakeFunctionPtr(updatefunction)(wrdschema)`, so it receives the
HareScript WRD schema object and must return a `RECORD`; the result is stored
in the migration status.

```harescript
<?wh
LOADLIB "mod::wrd/lib/api.whlib";

PUBLIC RECORD FUNCTION MigrateAccountStatus(OBJECT wrdschema)
{
  // Guard against schemas that never had the old attribute
  IF(NOT RecordExists(wrdschema->^wrd_person->GetAttribute("old_disabled")))
    RETURN DEFAULT RECORD;

  INTEGER numupdated;
  FOREVERY(RECORD user FROM wrdschema->^wrd_person->RunQuery(
              [ outputcolumns := CELL[ "wrd_id", "old_disabled" ], historymode := "all" ]))
  {
    wrdschema->^wrd_person->UpdateEntity(user.wrd_id,
        CELL[ new_status := user.old_disabled ? "blocked" : "active" ]);
    numupdated := numupdated + 1;
  }

  wrdschema->^wrd_person->DeleteAttribute("old_disabled");
  RETURN CELL[ numupdated ];
}
```

Rules:

- Do not begin, commit or roll back work. The caller already has a
  transaction open and commits it together with the schema update.
- Be defensive. Check that the types and attributes being migrated actually
  exist: a shared definition can be applied to schemas that never had them,
  and an `at="update"` migration also runs when a definition is first applied
  to a pre-existing schema.
- Use `historymode := "all"` when converting attribute values so closed
  entities are migrated as well.
- Make the function idempotent where practical, especially if you may bump its
  revision later.
- Return a small record of counts or other diagnostics; it is the only lasting
  record of what the migration did. Return `DEFAULT RECORD` when there is
  nothing to report.
- Avoid `CallJS`/`ImportJS` for database changes inside a migration. Module
  installation tasks (which apply WRD schemas) still run under native
  HareScript, where code in the JavaScript runtime does not share the
  HareScript transaction. This restriction is expected to disappear once
  those tasks no longer run under native HareScript.

## Checking migration status

In HareScript, the schema object exposes:

- `wrdschema->ListMigrations()` - all completed migrations (`tag`, `revision`,
  `finished`, `result`);
- `wrdschema->GetMigrationStatus("mymodule:accountstatus")` - one entry, or a
  `DEFAULT RECORD` if it has not completed.

`wh apply wrd` also prints a `Running migration '...'` line for each migration
it actually runs.

## Testing a migration

1. Create a schema from a definition **without** the migration, and set up
   data in the old shape.
1. Apply a definition **with** the migration to that existing schema, eg.
   `wrdschema->ApplySchemaDefinition([ schemaresource := Resolve("data/after.wrdschema.xml") ])`,
   and verify the converted data and the `GetMigrationStatus` result.
1. Apply it again and verify the migration does not run a second time.
1. If you use `revision`, apply a definition with a higher revision and verify
   it runs exactly once more.

The platform's own coverage is in `webhare_testsuite`
(`tests/wrd/testmetadata.whscr` with `tests/wrd/data/testconversion-*.wrdschema.xml`).
Run tests with the [running-tests skill](../running-tests/SKILL.md).
