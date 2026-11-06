# WRD schema definitions and registration

A schema definition file (`*.wrdschema.xml`) declares the types, attributes and seed values of a WRD schema.
Source of truth for the format: `mod::wrd/data/schemadefinition.xsd`. There is no YAML format for schema
definitions; registration in the module definition can be YAML or XML.

## File skeleton

```xml
<schemadefinition xmlns="http://www.webhare.net/xmlns/wrd/schemadefinition">

  <!-- optional: pull in other definitions (shared types, platform auth types) -->
  <import definitionfile="mod::othermodule/data/shared.wrdschema.xml" />

  <!-- optional: data migrations, see the wrd-migrations skill -->

  <domain tag="country" title="Country">
    <attributes>
      <free tag="iso_code" required="true" unique="true" />
    </attributes>
    <values matchattribute="wrd_tag">
      <value><field tag="wrd_tag">NL</field><field tag="wrd_title">Netherlands</field><field tag="iso_code">NL</field></value>
      <value><field tag="wrd_tag">BE</field><field tag="wrd_title">Belgium</field><field tag="iso_code">BE</field></value>
    </values>
  </domain>

  <object tag="wrd_person">  <!-- adds attributes to the base wrd_person type -->
    <attributes>
      <email tag="contact_email" unique="true" />
      <telephone tag="phone" />
      <domain tag="country" domain="country" />
      <array tag="addresses">
        <enum tag="kind" allowedvalues="home work" required="true" />
        <address tag="address" />
      </array>
    </attributes>
  </object>

  <object tag="wrd_organization">
    <attributes>
      <free tag="external_id" unique="true" />
      <boolean tag="is_customer" />
    </attributes>
  </object>

  <link tag="employment" linkfrom="wrd_person" linkto="wrd_organization" title="Employment">
    <attributes>
      <free tag="role" />
      <date tag="start_date" />
    </attributes>
  </link>

  <attachment tag="note" linkfrom="wrd_person" title="Note" haspersonaldata="true">
    <attributes>
      <richdocument tag="text" />
      <domain tag="author" domain="wrd_person" />
    </attributes>
  </attachment>

</schemadefinition>
```

- Every definition implicitly imports the base definition (`mod::wrd/data/wrdschemas/base.wrdschema.xml`), which
  declares `wrd_person`, `wrd_organization`, `wrd_settings` and `wrd_relation`. You never declare these from
  scratch; you add attributes to them.
- Tags are lowercase snake_case in XML and camelCase in TypeScript (`start_date` -> `startDate`,
  `wrd_person` -> `wrdPerson`; an underscore before a digit is kept: `level_2` -> `level_2`).

## Types

| Element | Required attributes | Built-in fields |
| --- | --- | --- |
| `<object tag>` | - | `wrdId`, `wrdGuid`, `wrdTag`, `wrdCreated`, `wrdClosed`, `wrdModified` |
| `<attachment tag linkfrom>` | `linkfrom` | + `wrdLeftEntity` (required) |
| `<link tag linkfrom linkto>` | `linkfrom`, `linkto` | + `wrdLeftEntity`, `wrdRightEntity` (both required) |
| `<domain tag>` | - | + `wrdLeftEntity` (optional parent value), `wrdTitle`, `wrdOrder` (if declared as `wrd_ordering`) |
| `<extend tag>` | - | adds attributes/values to a type declared earlier (in this file or an import); fails if it doesn't exist |

Declaring an `<object>` (or other metatype) with the tag of an existing type, as in the skeleton, also merges
attributes into it. Use `<extend>` when you want the definition to fail if the type isn't there.

`wrd_person` also has `wrdFirstName`, `wrdFirstNames`, `wrdInitials`, `wrdLastNamePrefix`, `wrdLastName`,
`wrdTitles`, `wrdTitlesSuffix`, `wrdGender` (`"male" | "female" | "other"`), `wrdDateOfBirth`, `wrdDateOfDeath`
and the generated `wrdFullName`. `wrd_organization` has `wrdOrgName`.

Type attributes:

| Attribute | Meaning |
| --- | --- |
| `title`, `description`, `comment` | documentation / UI title |
| `parent` | inherit attributes from another type of the same metatype. Queries on the parent type also return entities of child types |
| `haspersonaldata` | the type holds personal data |
| `deleteclosedafter` | delete closed entities this many days after closing |
| `keephistorydays` | how many days of change history to keep |

Don't use `wrd_relation` as `parent`, `linkfrom` or `linkto` in new definitions; refer to `wrd_person` or
`wrd_organization` directly. `<classification>` is a legacy name for `<attachment>`.

## Attributes

Common attribute options: `tag` (required), `title`, `description`, `comment`, `required`, `unique`,
`unsafetocopy` (don't copy the value when cloning/syncing schemas - use for secrets and installation-specific data).

| XML element | TypeScript value | Filterable | Notes |
| --- | --- | --- | --- |
| `free` | `string` | yes | plain text; `multiline="true"` for multi-line |
| `email` | `string` | yes, always case-insensitive | validated on write |
| `telephone`, `url` | `string` | yes | |
| `integer` | `number` | yes | |
| `integer64` | `bigint` | yes | |
| `money` | `Money` (from `@webhare/std`) | yes | |
| `boolean` | `boolean` | yes | |
| `date` | `Temporal.PlainDate \| null` | yes | |
| `datetime` | `Temporal.Instant \| null` (accepts `Date` on write) | yes | |
| `time` | `Temporal.PlainTime \| null` | yes | |
| `enum` | union of `allowedvalues` \| `null` | yes | `allowedvalues="a b c"`; values with `*`/`?` wildcards allow any matching string |
| `enumarray` | array of allowed values | `contains`, `intersects`, `=` | |
| `domain` | `number \| null` | yes; also accepts a `wrdGuid` string | `domain="<type tag>"`, may point to any type |
| `domainarray` | `number[]` | `contains`, `intersects`, `=` | |
| `array` | array of objects | only members, with `mentions`/`mentionsany` | child elements are the member attributes |
| `json` | the `typedeclaration` type, or `object` | no | `typedeclaration="mod::mymodule/js/types.ts#MyType"` (or an `@mod-...`/package path) |
| `richdocument` | `RichTextDocument \| null` | no | `checklinks="true"` to include it in link checking |
| `file`, `image` | `ResourceDescriptor \| null` | no | |
| `address` | `AddressValue \| null` | no | |
| `whfsinstance` | `Instance \| null` | no | |
| `whfsintextlink` | `IntExtLink \| null` | no | |
| `whfslink` | WHFS object id \| `null` | no | |
| `authenticationsettings` | `AuthenticationSettings \| null` | no | login credentials, see `AuthenticationSettings` in `@webhare/wrd` |
| `password` | | no | older password storage; new account types use `authenticationsettings` |
| `payment`, `paymentprovider` | payment values | no | WRD payment integration |
| `obsolete` | - | - | deletes the attribute (and its data) when the definition is applied |

Legacy elements not to use in new definitions: `record` (HSON - use `json`), `domainsingle`/`domainmultiple`
(use `domain`/`domainarray`), `statusrecord`.

Removing an attribute from the definition leaves it (and its data) in the database. Replace it with
`<obsolete tag="..."/>` to delete it. To move data from an old attribute to a new one first, see the
[wrd-migrations skill](../../wrd-migrations/SKILL.md).

## Seeding entities with values

`<values>` creates or updates entities when the definition is applied, matched on `matchattribute`
(usually `wrd_tag`). Use it for fixed domain values and well-known singleton entities.

```xml
<domain tag="category">
  <values matchattribute="wrd_tag" overwriteattributes="wrd_title">
    <value>
      <field tag="wrd_tag">FRUIT</field>
      <field tag="wrd_title">Fruit</field>
      <subvalues>  <!-- child values: wrdLeftEntity points to FRUIT -->
        <value><field tag="wrd_tag">APPLE</field><field tag="wrd_title">Apple</field></value>
      </subvalues>
    </value>
  </values>
</domain>
```

- For entities that already exist, only the fields listed in `overwriteattributes` are reset to the definition's
  value on apply; other fields are only set when the entity is created, so users can change them afterwards.
- Use `<arrayfield tag="..."><element><field tag="...">...</field></element></arrayfield>` for array values.
- Look seeded entities up in code by tag: `await schema.find("category", { wrdTag: "FRUIT" })`.

## Schema-level attributes

The root `<schemadefinition>` element can configure user management: `accounttype` (the type of user accounts,
usually `wrd_person`), `accountloginfield`, `accountemailfield`, `accountpasswordfield` and `accountstatus`. Only
set these for schemas that are used for logging in; see the platform's `mod::system/data/wrdschemas/usermgmt.wrdschema.xml`.

## Registering the schema in the module definition

Prefer `moduledefinition.yml`:

```yaml
wrdSchemas:
  crm:                               # schema name becomes mymodule:crm
    schema: data/crm.wrdschema.xml   # relative to the module root, or a mod:: path
    title: CRM
  shared:
    abstract: true                   # never created; only used for types/imports by other schemas
    schema: data/shared.wrdschema.xml
  "tenant-*":                        # wildcard: definition applies to any matching schema, never autocreated
    schema: data/tenant.wrdschema.xml
  devdata:
    schema: data/devdata.wrdschema.xml
    ifWebHare:
      dtapStages: [development]
```

Options: `schema`, `title`, `abstract`, `autoCreate` (default `true`), `ifWebHare`. Source of truth:
`mod::platform/data/schemas/moduledefinition.schema.yml` (`WRDSchemas`).

The equivalent in `moduledefinition.xml`:

```xml
<wrdschemas>
  <schema tag="crm" definitionfile="data/crm.wrdschema.xml" title="CRM" />
</wrdschemas>
```

(`autocreate="false"` to disable autocreation; a tag with a wildcard is never autocreated.)

For a wildcard schema there's no `WRDSchemaLike` key per actual schema; open it with
`wrd<WRDSchemaLike["mymodule:tenant-*"]>(actualName)`.

## Applying changes

1. `wh apply config` regenerates the TypeScript types (`WRDSchemaLike[...]` and the legacy `wh:wrd/<module>`
   exports).
1. `wh apply wrd` applies definitions to the database: autocreates missing schemas, creates/updates types and
   attributes, applies `<values>` and runs migrations. It only updates schemas whose definition files changed; use
   `wh apply --force wrd` to re-apply an unchanged definition. Both steps also run on module install and WebHare
   restart.
1. Check the output for errors; a definition that fails to apply leaves that schema unchanged.

## Renaming or moving a schema

The full name (`module:tag`) is stored in the database. To rename it, open it in HareScript and call
`UpdateMetadata` with the new full name, from a `<runonce>` script (see the [modules skill](../../modules/SKILL.md)),
never at normal load/request time:

```harescript
LOADLIB "mod::wrd/lib/api.whlib";

OBJECT wrdschema := OpenWRDSchema("oldmodule:oldtag");
IF(ObjectExists(wrdschema))
  wrdschema->UpdateMetadata([ tag := "newmodule:newtag" ]);
```

`UpdateMetadata` accepts only: `description`, `name`/`tag`, `protected`, `usermgmt`, `accounttype`,
`accountlogin(tag)`, `accountpassword(tag)`, `accountemail(tag)`, `title`, `creationdate` (and rejects
`languages`).

Autocreation and definition apply always run **before** `poststart` runonce scripts (on restart, `wh apply`, and
module install). So if you move a schema declaration to a new module or tag with autocreation enabled, WebHare
first creates an empty schema under the new name, and your rename then clashes. Safe order:

1. Remove the declaration from the old module.
1. Add it to the new module with `autoCreate: false` (XML: `autocreate="false"`), with a comment explaining why,
   and move the definition file.
1. Add a `poststart` runonce script in the new module that renames the old schema.
1. After all installations have run the rename, enable autocreation again in a follow-up change.
