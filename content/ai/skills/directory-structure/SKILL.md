---
name: directory-structure
description: Explains how to navigate WebHare Platform and WebHare module directory structure. Use this skill to find things especially how to resolve module references (`<modulename>:<tag>`) or `mod::<module>/` paths which are used everywhere in a WebHare installation
---

Every directory containing 'moduledefinition.xml' or 'moduledefinition.yml' starts a module (named after the directory it contains)

A module reference (`<modulename>:<tag>`) generally refers to the moduledefinition file in folder 'module' - and there you look for the tag in the appropriaty section
to find paths that will be relative to the module root (or refer to other modules if they start with `mod::`)

The moduledefinitions explain various external entrypoints into modules, for example:
- a backend service implementation. These are opened by OpenWebHareService (HareScript) or openBackendService (TypeScript), followed by a `<module>:<tag>`. Find the actual
  service implementation by checking the backendServices section of that module, and following `onCreateClient` or `onCreateController`.

Command line scripts invoked by `wh <module>:<command>` eg `wh publisher:listissues` live in the `scripts/whcommands` subfolder of that module.

Command scripts invoked by `<wh command>` witout a colon are in either `modules/platform/cli-commands` (where new scripts should go) or still in `modules/system/scripts/whcommands` (which is the original default location). Some `wh` subcommands are implemented in `bin/wh` itself.

## Generated files

TypeScript files under a module's `generated/` directory and bindings resolved through imports such as `wh:wrd/<module>` or `wh:db/<module>` are generated from source definitions. `wh:wrd/<module>` is a legacy WRD API; use the [wrd skill](../wrd/SKILL.md) for the modern `@webhare/wrd` API. Check generated file headers and follow the corresponding moduledefinition or schema definition to find the source to edit.

Do not edit generated files manually. Changes will be overwritten on regeneration and can make the TypeScript declarations disagree with the source configuration and runtime behavior. Edit the source definitions, then run `wh apply config` to regenerate configuration-derived bindings. For WRD, this includes the generated schema types and modern `WRDSchemaLike` registrations.

Regenerating bindings is distinct from applying WRD schema definitions to the database: use `wh apply wrd` for the latter. See the `wrd` skill for details.

See also: the `modules` skill for moduledefinition.xml editing conventions (runonce scripts, dependencies), the `wrd` skill for WRD schema specifics, and the `openapi` skill for OpenAPI YAML and generated TypeScript bindings.

For widget type definitions, editor tabsextensions, TypeScript rendering, and
webdesign siteprofile includes, use the [widgets skill](../widgets/SKILL.md).
For YAML siteprofile definitions, apply rules, registration, and XML conversions,
use the [siteprofiles skill](../siteprofiles/SKILL.md).
