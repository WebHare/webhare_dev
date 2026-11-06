# Querying and bulk updates with the WRD TypeScript API

All examples use a modern schema object (`const crmSchema = wrd("mymodule:crm")`). Source of truth:
`@webhare/wrd` (`schema.ts`, `types.ts`, `accessors*.ts`) and the platform tests in
`webhare_testsuite/tests/wrd/nodejs/` (the `nodejs-legacy/` folder tests the legacy API).

## Query builder

```typescript
const rows = await crmSchema
  .query("wrdPerson")                       // type to query (includes entities of child types)
  .select(["wrdId", "wrdFullName"])          // required
  .select({ contact: { email: "contactEmail", phone: "phone" } }) // select() calls are merged; nest with objects
  .where("country", "in", [nlId, beId])
  .match({ isActive: true })                 // shorthand for several "=" conditions
  .historyMode("now")                        // default
  .limit(100)
  .execute();
```

- `select()` shapes: a string (`"wrdId"` -> array of values), an array (`["a","b"]` -> objects with those
  keys), or an object (`{ out: "attr", group: { ... } }` -> renamed/nested keys). A query without `select()` throws.
- Results have no guaranteed order. Sort in TypeScript.
- `execute({ export: true })` returns export-format values: domain references as `wrdGuid` strings, resources and
  rich text in exportable form. Use it for data that leaves the installation (APIs, exports).
- `executeRequireExactlyOne()` / `executeRequireAtMostOne()` (returns `null` if none) check the result count.
- `getEventMasks()` on a query returns the event masks to invalidate a cache of its result.
- `$call(qb => ...)` applies a function to the builder, useful for conditional filters:

  ```typescript
  .$call(qb => onlyCustomers ? qb.where("isCustomer", "=", true) : qb)
  ```

## Conditions per attribute type

TypeScript only allows valid field/condition/value combinations; type errors on `where()` usually mean the
condition isn't supported for that attribute type.

| Attribute type | Conditions | Value |
| --- | --- | --- |
| string-like (`free`, `email`, `url`, `telephone`, `wrdTag`, names) | `=`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `like` | string(s); option `{ matchCase: false }` (default is case-sensitive, `email` is always insensitive). `like` uses `*` and `?` |
| `integer`, `integer64`, `money` | `=`, `!=`, `<`, `<=`, `>`, `>=`, `in` | number / bigint / `Money` |
| `boolean` | `=`, `!=` (and comparisons) | boolean |
| `date`, `time` | `=`, `!=`, comparisons, `in` | `Temporal.PlainDate` / `Temporal.PlainTime`, `null` for empty |
| `datetime`, `wrdCreated`, `wrdClosed`, `wrdModified` | `=`, `!=`, comparisons, `in` | `Date` or `Temporal.Instant`, `null` for empty |
| `enum` | `=`, `!=`, `in`, `like` | allowed value(s); option `{ ignoreAllowedValues: true }` to allow unknown values |
| `domain`, `wrdLeftEntity`, `wrdRightEntity` | `=`, `!=`, `in` | `wrdId`, `wrdGuid` string or `null` (never `0`) |
| `domainarray` | `contains` (one id), `intersects` (any of ids), `=`/`!=` (exact set) | ids |
| `enumarray` | `contains`, `intersects`, `=`, `!=` | values |
| `array` members (`"addresses.kind"`) | `mentions` (one value), `mentionsany` (any of values) | member value(s) |
| `json`, `richdocument`, `file`, `image`, `address`, `whfs*`, ... | none - not filterable | |

- `"in"` with an empty list matches nothing; you don't need to special-case it.
- `where("someDomain", "=", null)` finds entities where the reference is empty; `"!=", null` finds set ones.
- There is no OR and no NOT across fields. Use `in`, `!=`, or multiple queries.
- Filtering on attributes of *another* type isn't possible in one query. Query the other type for ids first, then
  filter with `in`:

  ```typescript
  const dutchOrgs = await crmSchema.query("wrdOrganization").select("wrdId").where("country", "=", nlId).execute();
  const dutchStaff = await crmSchema.query("employment").select(["wrdLeftEntity", "role"])
    .where("wrdRightEntity", "in", dutchOrgs).execute();
  ```

## enrich()

`enrich()` adds fields of entities of type T to existing rows, matching a row field (the id) with T's `wrdId`.
It's available on a query (`.enrich(...)` before `execute()`) and on the schema for plain arrays
(`schema.enrich(type, rows, idField, mapping, options)`).

```typescript
const orders = await shopSchema.query("order")
  .select(["wrdId", "orderNumber", "customer", "assignedTo"])
  .where("status", "=", "open")
  .enrich("wrdPerson", "customer", { customerName: "wrdFullName", customerEmail: "contactEmail" })
  .enrich("wrdPerson", "assignedTo", { assigneeName: "wrdFullName" }, { allowMissing: true }) // assignedTo may be null
  .execute();
```

Options:

| Option | Default | Effect |
| --- | --- | --- |
| `allowMissing` | `false` | keep rows whose id is `null` or has no match, filling the enriched fields with defaults (`""`, `null`, `[]`). Without it those rows are dropped |
| `historyMode` | `"now"` | which entities may match. Use `"all"` to show names of closed entities |

- The id field must hold a single `number | null`. To enrich a `domainarray`, flatten it first.
- Each `enrich()` is one extra query, regardless of the number of rows. Prefer it over per-row `getFields()`.
- Using `enrich()` to add data to rows from an own database table (see the main skill) is the standard way to
  combine Kysely results with WRD data.

## Walking relations

| Want | Do |
| --- | --- |
| attachments of an owner | `query("note").where("wrdLeftEntity", "=", personId)` |
| owner of attachments | select `wrdLeftEntity`, `enrich("wrdPerson", "wrdLeftEntity", ...)` |
| link targets from the left side | `query("employment").where("wrdLeftEntity", "=", personId)`, `enrich("wrdOrganization", "wrdRightEntity", ...)` |
| link sources from the right side | `query("employment").where("wrdRightEntity", "=", orgId)`, `enrich("wrdPerson", "wrdLeftEntity", ...)` |
| entities referring to X through a domain attribute | `query("order").where("customer", "=", personId)` |
| children in a domain tree | `query("category").where("wrdLeftEntity", "=", parentId)` (roots: `"=", null`) |
| is X referenced at all (as left/right entity or domain value) | `await schema.getType(type).isReferenced(id)` |

## History mode details

| Mode | Visible |
| --- | --- |
| `now` | `wrdCreated <= now < wrdClosed` |
| `active` | `now` + temporaries |
| `all` | all non-temporary entities |
| `unfiltered` | everything |
| `.historyMode("at", date)` | live at `date` |
| `.historyMode("range", start, limit)` | live at some moment between `start` and `limit` |

Defaults: `query()`, `modify()`, `search()`, `find()`, `upsert()`, `enrich()` use `now`; `getFields()` uses
`active`. Results never include history *values*: an entity read in `all` mode shows its current attribute values,
not the values it had at that time.

Temporary entities (`insert(type, data, { temp: true })`) are for data that is being collected (eg. a multi-step
form) and shouldn't be visible yet. They skip required-field checks, are invisible in `now`/`all`, and become
normal entities when you set `wrdCreated` on them.

## Lookups by key

| Call | Returns | When nothing / several match |
| --- | --- | --- |
| `search(type, field, value, options?)` | `wrdId \| null` | `null` / first match |
| `find(type, { field: value, ... }, options?)` | `wrdId \| null` | `null` / throws |
| `getFields(type, id \| { field: value }, mapping, options?)` | fields | throws (or `null` with `allowMissing: true`) / first match |
| `update(type, id \| { field: value }, values)` | - | throws / throws |

Prefer `find()` over `search()` when the key should be unique; `search()` and `getFields()` with a match object
silently pick one of several matches.

## sync(): make a type match a list

```typescript
const result = await runInWork(() => crmSchema.modify("country")
  .sync("isoCode", importedCountries, { unmatched: "close" }));
// result: { created: number[], updated: number[], matched: number[], unmatched: number[] }
```

- Matches existing entities on the join field, creates missing ones, updates changed fields, and handles existing
  entities not in the list according to `unmatched`: `"keep"` (default), `"close"`, `"delete"` or one of the
  `close()` modes.
- Restrict the set it considers with `.where()` before `.sync()`, eg. only entities of one source.
- With `.historyMode("all")`, closed entities that reappear in the list are reopened.
- Throws on duplicate keys in either the input or the existing data.

## Type metadata from code

Prefer schema definitions over runtime changes. For tools and tests that need it:
`schema.listTypes()`, `schema.describeType(tag)`, `schema.getType(tag).listAttributes()`,
`schema.getType(tag).describeAttribute(tag)`, `schema.hasType(tag)`, and (to change metadata)
`createType`, `getType(tag).createAttribute/updateAttribute/deleteAttribute`.
