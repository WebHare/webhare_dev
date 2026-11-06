---
name: wrd-in-harescript
description: "Use WRD from HareScript with mod::wrd/lib/api.whlib (OpenWRDSchema, wrdschema->^type, RunQuery, GetEntityFields, Search, Enrich, CreateEntity, UpdateEntity, EnsureEntity, ImportEntities, CloseEntity, WRDEntity2017 objects), build Tollium WRD screens (<wrd:entity>, <wrd:entitiesedit>, <wrd:entitylist>, <wrd:selectentity>, <wrd:runquery>, WRDEntityEditScreenBase), and translate HareScript WRD code to the TypeScript wrd() API including differing history mode and case-matching defaults. Use when reading, writing or converting HareScript code that touches WRD."
---

# WRD in HareScript

New code should use TypeScript and the `wrd()` API (see the [wrd skill](../wrd/SKILL.md), which also covers
modeling and schema definitions). This skill is for maintaining HareScript WRD code, building Tollium WRD screens
(which are HareScript), and converting HareScript WRD code to TypeScript.

For HareScript conventions and calling TypeScript from HareScript, see the
[harescript-development skill](../harescript-development/SKILL.md); for general screen building, the
[tollium-screens skill](../tollium-screens/SKILL.md).

## Use mod::wrd/lib/api.whlib only

The HareScript WRD API is `mod::wrd/lib/api.whlib`, with the objects `WRDSchema2017`, `WRDType2017` and
`WRDEntity2017`. Both the id-based type methods and the entity objects belong to it.

`mod::wrd/lib/objectapi.whlib` is the legacy API (`OpenWRDSchema(INTEGER id)`, `OpenWRDType`, `LookupEntity`,
`CreateEntity2`, `MakeQuery`, ...). Don't use it or copy from code that loads it; convert such code to `api.whlib`.

```harescript
LOADLIB "mod::wrd/lib/api.whlib";

OBJECT wrdschema := OpenWRDSchema("mymodule:crm");   // DEFAULT OBJECT if it doesn't exist
OBJECT persontype := wrdschema->^wrd_person;          // same as wrdschema->GetType("WRD_PERSON")
```

- Name the variable `wrdschema`, not `schema` (`SCHEMA` is a reserved word).
- Type and attribute tags are case-insensitive strings (`"WRD_ID"` and `"wrd_id"` are the same). Result records use
  lowercase cell names (`rec.wrd_id`, `rec.contact_email`).

## Reading

```harescript
// One entity. Returns DEFAULT RECORD if it doesn't exist
RECORD person := wrdschema->^wrd_person->GetEntityFields(personid, ["wrd_fullname", "contact_email"]);
STRING email := wrdschema->^wrd_person->GetEntityField(personid, "contact_email");

// Lookup by value: returns the id or 0
INTEGER personid := wrdschema->^wrd_person->Search("contact_email", "pat@example.net");

// Query
RECORD ARRAY customers := wrdschema->^wrd_organization->RunQuery(
    [ outputcolumns := [ id := "WRD_ID", name := "WRD_ORGNAME" ]
    , filters := [ [ field := "IS_CUSTOMER", value := TRUE ]
                 , [ field := "WRD_ORGNAME", matchtype := "LIKE", value := "A*" ]
                 ]
    ]);
INTEGER ARRAY ids := wrdschema->^wrd_organization->RunQuery([ outputcolumn := "WRD_ID", filters := ... ]);

// Join by id: adds fields to existing rows
RECORD ARRAY withnames := wrdschema->^wrd_person->Enrich(rows, "PERSONID", [ name := "WRD_FULLNAME" ]);
```

- Filter `matchtype`: `=`, `!=`, `<`, `<=`, `>`, `>=`, `IN`, `LIKE`, `CONTAINS`, `MENTIONS`, `MENTIONSANY`. It
  defaults to `=`, or `IN` for an array value.
- Filters may be nested with `[ type := "OR", filters := [...] ]`, `"AND"` and `[ type := "NOT", filter := ... ]`.
- `RunWRDQuery` (`MakeWRDQuery`) can query several types in one go with `sources` and `links`.
- `cachettl := <ms>` on `RunQuery`/`GetEntityFields`/`Enrich` caches the result until the type changes. Don't use it
  in a transaction that modifies the same type.
- Empty values: `0` for domains, `DEFAULT DATETIME` for dates, `""` for strings.

## Writing

Writes need open work: `GetPrimary()->BeginWork()` / `GetPrimary()->CommitWork()`, or in Tollium
`OBJECT work := this->BeginWork(); ... work->Finish()`.

```harescript
OBJECT newperson := wrdschema->^wrd_person->CreateEntity([ wrd_firstname := "Pat", contact_email := "pat@example.net" ]);
INTEGER newid := newperson->id;

wrdschema->^wrd_person->UpdateEntity(personid, [ phone := "+31 50 1234567" ]);

// Insert or update by key
OBJECT org := wrdschema->^wrd_organization->EnsureEntity([ external_id := "K-42", wrd_orgname := "Example Ltd" ],
                                                          [ entitykey := ["EXTERNAL_ID"], ifnew := [ is_customer := TRUE ] ]);

wrdschema->^wrd_person->CloseEntity(personid);    // sets wrd_limitdate to now
wrdschema->^wrd_person->DeleteEntity(personid);   // removes it

// Make a type match a list
RECORD res := wrdschema->^country->ImportEntities("ISO_CODE", rows, [ deletemode := "close" ]);
```

`CreateEntity`, `GetEntity(id)` and `EnsureEntity` return a `WRDEntity2017` object with `->id`, `->GetField`,
`->GetFields`, `->UpdateEntity`, `->CloseEntity`, `->DeleteEntity`, `->IsLive()`, `->UpdatePassword`, ...
`GetEntity(id)` returns `DEFAULT OBJECT` if the entity doesn't exist (in any history state).

## Defaults that differ from TypeScript

These are the usual source of bugs when converting. Check every call:

| HareScript | Default | TypeScript | Default |
| --- | --- | --- | --- |
| `RunQuery`, `Search`, `EnsureEntity` | historymode `now` | `query()`, `search()`, `find()`, `upsert()` | `now` |
| `GetEntityFields`, `GetEntityField`, `->GetFields` | every entity: closed, future *and* temporaries | `getFields()` | `active`: live + temporaries, **not closed** |
| `Enrich` | historymode **`all`** | `enrich()` | **`now`** |
| `Enrich` | drops unmatched rows unless `rightouterjoin := TRUE` | `enrich()` | drops unmatched rows unless `allowMissing: true` |
| `RunQuery` filters | **case-insensitive** unless `matchcase := TRUE` | `where()` | **case-sensitive** unless `{ matchCase: false }` |
| `Search` | case-sensitive (`matchcase := TRUE`) | `search()` | case-sensitive |
| missing entity | `GetEntityFields` returns `DEFAULT RECORD`, `Search` returns `0` | `getFields()` throws (use `allowMissing: true`), `search()` returns `null` | |

`email` attributes are case-insensitive in both.

## Translating to TypeScript

| HareScript | TypeScript |
| --- | --- |
| `OpenWRDSchema("mymodule:crm")` | `wrd("mymodule:crm")` |
| `wrdschema->^wrd_person` | the type argument `"wrdPerson"` |
| tags `"WRD_FULLNAME"`, `"contact_email"` | `"wrdFullName"`, `"contactEmail"` |
| `wrd_limitdate`, `wrd_creationdate`, `wrd_modificationdate` | `wrdClosed`, `wrdCreated`, `wrdModified` |
| `wrd_ordering`, `wrd_infix` | `wrdOrder`, `wrdLastNamePrefix` |
| `->RunQuery([ outputcolumns := [...], filters := [...] ])` | `.query(type).select({...}).where(...).execute()` |
| `outputcolumn := "WRD_ID"` | `.select("wrdId")` |
| `[ field := "X", matchtype := "IN", value := ids ]` | `.where("x", "in", ids)` |
| `type := "OR"` filters | no equivalent: use `in`, or several queries and merge |
| `RunWRDQuery` with several sources | one `query()` plus `enrich()` per joined type |
| `->GetEntityFields(id, [...])` | `getFields(type, id, [...], { allowMissing: true })` (check history mode, see above) |
| `->Search(field, value)` | `search(type, field, value)` (`null` instead of `0`) |
| `->Enrich(rows, "ID", [...], [ rightouterjoin := TRUE ])` | `enrich(type, rows, "id", {...}, { allowMissing: true, historyMode: "all" })` |
| `->CreateEntity(rec)->id` | `insert(type, rec)` |
| `->UpdateEntity(id, rec)` | `update(type, id, rec)` |
| `->EnsureEntity(fields, [ entitykey, ifnew ])` | `upsert(type, keyFields, otherFields, { ifNew })` |
| `->ImportEntities(joincell, rows, [ deletemode ])` | `modify(type).sync(joinField, rows, { unmatched })` |
| `->CloseEntity(id)` / `->DeleteEntity(id)` | `close(type, id)` / `delete(type, id)` |
| `->GetEventMasks()` | `schema.getEventMasks(type)` |
| `cachettl := ...` | a LocalCache keyed on the query, invalidated by `getEventMasks()` ([localcache skill](../localcache/SKILL.md)) |
| `GetPrimary()->BeginWork()` ... `CommitWork()` | `await runInWork(async () => { ... })` |
| `0` for empty domain, `DEFAULT DATETIME` | `null` |
| `DATETIME` values | `Temporal.Instant` (datetime), `Temporal.PlainDate` (date) |

Preserve HareScript output aliases (`[ id := "WRD_ID" ]`) in TypeScript with an object select
(`.select({ id: "wrdId" })`) rather than renaming afterwards.

## Tollium WRD screens

Tollium's WRD components live in the namespace `xmlns:wrd="http://www.webhare.net/xmlns/wrd/components"` (source of
truth: `mod::wrd/data/components.xsd`). They find their schema through `this->contexts->wrdschema`; set it in the
application or screen before the components load, eg. `this->contexts->wrdschema := OpenWRDSchema("mymodule:crm");`.

### List with add/edit/delete

```xml
<screen name="persons">
  <body>
    <wrd:entitiesedit name="persons" wrdtype="wrd_person" entityeditscreen=".person"
                      deletemode="close" height="1pr">
      <column name="wrd_fullname" title="Name" type="text" />
      <column name="contact_email" title="Email" type="email" />
    </wrd:entitiesedit>
  </body>
</screen>
```

- `<wrd:entitiesedit>` shows entities of `wrdtype` with add/edit/delete buttons and opens `entityeditscreen` to
  edit. `<wrd:entitylist>` is the read-only variant (with `onselect`, `openaction`).
- Columns are named after attribute tags. Use `<wrd:entityrefcolumn field="..." ...>` to show a field of a referred
  entity.
- `deletemode`: `delete`, `close`, `delete-closereferred`, `delete-denyreferred`, `close-denyreferred` (same as the
  TypeScript `close()` modes).
- `historymode="all"` also shows closed entities (grayed out); default `now`.
- Restrict the list in the screen object with `^list->entitycontext := [ wrd_leftentity := personid ]`: the list
  only shows matching entities and new entities get these values (eg. a person's attachments). Use
  `^list->listfilters := [...]` (RunQuery filters) for filters that shouldn't be set on new entities.
- Inside an entity edit screen, `linkfrom="entity"` on a child `<wrd:entitiesedit>` (eg. attachments) binds it to
  the entity being edited, including a new one that hasn't been stored yet. Don't also put `wrd_leftentity` in its
  `entitycontext`.

### Entity edit screen

```xml
<screen name="person" implementation="wrd:entityedit">
  <compositions>
    <wrd:entity name="entity" wrdtype="wrd_person" />
  </compositions>
  <body>
    <textedit composition="entity" cellname="wrd_firstname" title="First name" />
    <textedit composition="entity" cellname="contact_email" title="Email" />
    <wrd:selectentity composition="entity" cellname="country" title="Country" type="pulldown" />
    <select title="Category" type="radio">
      <wrd:runquery wrdtype="category" />
    </select>
  </body>
</screen>
```

```harescript
PUBLIC STATIC OBJECTTYPE Person EXTEND WRDEntityEditScreenBase   // from mod::wrd/lib/screenbase.whlib
<
  UPDATE MACRO Init(RECORD data)
  {
    WRDEntityEditScreenBase::Init(data);  // always call the base Init
  }
  UPDATE MACRO Validator(OBJECT work, RECORD updatevalue)
  {
    // add errors to work for invalid input
  }
  UPDATE RECORD FUNCTION Submitter(OBJECT work, RECORD updatevalue)
  {
    RETURN CELL[ ...updatevalue, last_edited := GetCurrentDatetime() ];  // adjust what is stored
  }
  UPDATE MACRO AfterStore(OBJECT work)
  {
    // runs in the same work after the entity was stored; this->GetNewEntityId() has the id
  }
>;
```

- The edit screen needs a `<wrd:entity>` composition named `entity`, and either `implementation="wrd:entityedit"`
  or an object deriving from `WRDEntityEditScreenBase`.
- Components bind to attributes with `composition="entity" cellname="<tag>"`. `<wrd:selectentity>` picks a domain
  value (`type`: `pulldown`, `radio`, `checkbox`, `checkboxlist`, `dialog`; `selectmultiple="true"` for
  `domainarray`). `<wrd:runquery>` fills a plain `<select>` with entities of a type.
- `<wrd:entity autoupdate="true" onupdate="...">` on an overview screen reloads when the entity changes.
- Keep business logic that also runs outside Tollium in TypeScript and call it from `Submitter`/`AfterStore`
  (see the harescript-development skill for `CallJS`). Avoid duplicating validation between HareScript screens and
  TypeScript APIs.
