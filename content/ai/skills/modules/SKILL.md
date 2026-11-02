---
name: modules
description: WebHare moduledefinition.xml conventions - runonce scripts, dependencies vs fetchmodule, and moving functionality (schemas, code, sites) between modules during a module merge/split. Use this when editing moduledefinition.xml or restructuring/merging modules.
---

# runonce scripts

Declared under `<servicemanager>`:

```xml
<runonce script="scripts/runonce/my_migration.whscr" tag="my_migration_2026_09_18" when="poststart" />
```

- A runonce script is uniquely identified by `<modulename> + tag`, and is guaranteed to run only once unless it fails/throws - pick a new, never-reused tag for every new runonce script (a `_YYYY_MM_DD` suffix is the common convention here).
- `when=` controls the phase it runs in: `afterschemacreation` < `aftertablecreation` (default) < `aftertablesbeforerights` < `afterregistryupdate` < `poststart`. Only built-in modules can use phases other than `poststart`.
- Schema/table setup (including WRD schema autocreate, see the `wrd` skill) always finishes before any `poststart` runonce script runs, both on restart and on module install.
- Runonce scripts commonly wrap their work in `OpenPrimary()->BeginWork(); ... GetPrimary()->CommitWork();`.

# Dependencies vs fetchmodule

- `<meta><packaging><dependency module="..." repository="..." />` is a **hard runtime dependency**: required for the module to load/run, and needed if your code imports TypeScript bindings from that module (eg `wh:wrd/<module>`, `@mod-<module>`).
- `<meta><validation><fetchmodule module="..." repository="..." />` only makes the module available for **CI/validation tests** of the current module. It is not transitive and does not imply a runtime dependency. Don't rely on it for actual code being loadable at runtime.

# Merging/splitting modules

When moving a piece of functionality (eg a WRD schema, a siteprofile, some library code) from module A into module B:

1. Move the underlying file(s) (siteprl.xml, wrdschema.xml, whlib, etc.) into module B's tree.
2. Move/adjust the moduledefinition.xml declaration referencing it from A to B (see the `wrd` skill for the specific caveats around `<wrdschemas>` and `autocreate`).
3. Update every literal cross-reference to the old `module:tag` / import path across the whole workspace, not just within the moved module - grep for the old identifier, since consuming code can live in any other module.
4. If code in module A now references something owned by module B (eg `OpenWRDSchema("B:tag")` or a TypeScript import from `wh:wrd/B`), double check whether A needs a new `<dependency>` on B (existing code in the same module may already imply this dependency is fine without an explicit `<dependency>` entry - check for precedent before adding one).
5. Run `wh apply config` after touching moduledefinition.xml (regenerates generated TypeScript types/bindings). If a `<wrdschemas>` or `*.wrdschema.xml` was touched, also run `wh apply wrd` (or `wh apply all`) - see the `wrd` skill for what each command does and when it runs automatically.

See also: the `directory-structure` skill for how `<modulename>:<tag>` and `mod::` references resolve in general, and the `wrd` skill for WRD schema specifics.

For `.siteprl.yml` definitions, webdesign `applySiteProfiles` includes, and
XML-to-YAML conversions, use the [siteprofiles skill](../siteprofiles/SKILL.md).
