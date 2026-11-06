---
name: siteprofiles
description: "Create, update, or convert WebHare YAML siteprofiles (.siteprl.yml). Use for types, members, apply rules, applySiteProfiles, webdesign registration, RTD types, XML-to-YAML migrations, and siteprofile validation."
---

# YAML siteprofiles

## Start with the installed platform

Read a nearby profile and the profile that includes it. Check the installed
platform's `modules/platform/data/schemas/siteprofile.schema.yml` for exact
property names, supported types, and selectors. Do not mechanically camel-case
XML element names or assume a legacy alias is the preferred YAML spelling.

Prefer `.siteprl.yml` for new siteprofiles. Keep Tollium screens and
tabsextensions in separate `.screens.xml` files; a YAML siteprofile references
those editors rather than embedding XML.

## Definitions and naming

```yaml
types:
  settings.example:
    tid: example:siteprofile.settings.example
    members:
      heading:
        type: string
      showDetails:
        type: boolean
      description:
        type: richTextDocument
      buttonLink:
        type: intExtLink
      items:
        type: array
        members:
          title:
            type: string
          target:
            type: whfsRef
```

- Without `namespace`, the type identifier is `<module>:<key>`, e.g.
  `example:settings.example`. An optional top-level `typeGroup` adds a prefix to
  the key; inspect it before deriving the identifier.
- Type keys use lowercase letters, digits, underscores, and dots, not hyphens.
  Check the schema's exact pattern rather than guessing edge cases.
- Members use camelCase, including nested array members. TypeScript sees
  `showDetails`; HareScript and Tollium compositions use `show_details`.
- Prefer canonical member types such as `richTextDocument`, `intExtLink`,
  `whfsRef`, `whfsRefArray`, `stringArray`, and `instant`, not legacy XML aliases.
- A plain instance/settings type can omit `metaType`. Select the appropriate
  `metaType` for file, folder, page, or widget types using the schema.
- Keep user-facing labels in language resources and refer to them with `tid`.
  Preserve existing gids/text IDs when converting a profile.
- Do not casually rename types, members, or namespaces: these identify persisted
  data. Preserve identity during format-only conversions. A schema-valid new
  identifier does not migrate old instance data.

## Apply rules and editors

Definitions register types; `apply` rules control their use in context.

```yaml
apply:
  - to: all
    editProps:
      - type: settings.example
        tabsExtension: example.screens.xml#settings
```

Use the existing design's selectors and policy. Narrow `to` when settings apply
only to particular objects, folder trees, sites, or file types. Preserve rule
priority and selector semantics during conversion; do not broaden them to `all`
just to make an editor appear.

For widgets, use `editor.tabsExtension` and `onRenderWidget`, not the settings
type's `editProps` pattern; see the [widgets skill](../widgets/SKILL.md).
The schema notes that widget-local `apply` rules affect WHFS widgets, not widgets
embedded in rich text. Widget availability and RTD policies need their own checks.

RTD definitions belong under `rtdTypes`; consuming rules select them using
`rtdDoc.rtdType`. Check existing block styles, inline styles, tables, and widget
policies before reusing or defining an RTD type.

## Include the profile in the intended scope

A webdesign's YAML siteprofile includes other profiles with **`applySiteProfiles`**:

```yaml
applySiteProfiles:
  - widgets/example/example.siteprl.yml
  - mod::anothermodule/data/shared.siteprl.yml
```

Do not use `siteProfiles` here. Relative paths resolve from the containing
profile. Use `mod::<module>/...` for cross-module references and check the module
dependency when adding one.

A YAML moduledefinition registers a design's root profile differently:

```yaml
webDesigns:
  example:
    title: Example design
    siteProfile: webdesigns/example/example.siteprl.yml
```

Add includes to the actual consuming design, not an unrelated legacy design.
Only register a profile globally when its definitions/rules genuinely need that
scope. Registering a profile does not include CSS or JavaScript: connect frontend
assets through the appropriate asset-pack entrypoint.

## XML-to-YAML conversion checklist

1. Read the original definitions, apply rules, editors, and all incoming references.
1. Preserve stored type identity, member meaning, labels, and apply behavior.
1. Move embedded tabsextensions to `.screens.xml`. Update `tabsExtension`,
   `editProps`, and direct `LoadTabsExtension` callers to the new screen path.
1. Update every include of the old `.siteprl.xml` path. Search again for stale
   references before removing it.
1. Use schema-supported YAML names. Do not carry XML-only attributes over as
   speculative YAML properties.
1. Validate the result and test editing/storage/rendering, not just parsing.

## Validation and generated bindings

- Run `wh validate` on the changed siteprofile and referenced screens; validate
  affected HareScript and check TypeScript diagnostics.
- If validation says "must NOT have additional properties", check both the
  property names and map-key patterns (including illegal hyphens in type keys).
- Run `wh apply config` when configuration-derived bindings need regeneration.
  Never edit generated TypeScript manually.
- Generated bindings and stored data are separate concerns. Applying config does
  not by itself prove a rename migrated data or that apply rules select the right
  objects.
- Follow the [running-tests skill](../running-tests/SKILL.md) for focused tests.
  Check field round trips, editor loading, matching/nonmatching apply contexts,
  and rendered output where applicable.

See also the [directory-structure skill](../directory-structure/SKILL.md) for
module/path resolution and the [modules skill](../modules/SKILL.md) for
moduledefinition registration and dependencies.
