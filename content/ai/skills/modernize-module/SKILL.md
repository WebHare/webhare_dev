---
name: modernize-module
description: "Scan a WebHare module for deprecated and legacy constructs and modernize the ones the user picks: deprecated APIs (run -> runCli, test.run -> runTests, any @deprecated platform API), deprecated YAML properties in moduledefinition.yml and siteprofiles (pageBuilder -> onRenderPage, workflow -> clone: onDraft, clientFactory -> onCreateClient, OpenAPI initHook -> onInitService), legacy wh:wrd/... WRD imports, rpc.json imports, .es files, XML siteprofiles, Witty templates, HareScript wh commands and shell scripts. Use when asked to modernize, upgrade, clean up or find deprecated code in a module."
---

# Modernize a module

Find everything in a module that can be modernized, report it per category, and let the user choose what to
convert. **Never start converting before the user has chosen.** The scan is read-only.

## 1. Scan

1. Determine the module. Use the one the user names, otherwise the module containing the current working
   directory. Ask if that is ambiguous.
1. Run the scan (the deprecated API check lints every TypeScript file and can take a minute on large modules):

   ```bash
   wh devkit:show-technical-debt <module>
   ```

   Add `--json` for machine-readable output, or `--no-lint` to skip the slow deprecated API check.
1. Note uncommitted changes in the module (`git status`); mention them when reporting so the user can commit first.

What the scan detects:

| Category | Detection | How to convert |
| --- | --- | --- |
| `deprecated-api` | `@typescript-eslint/no-deprecated` with the module's own typed ESLint config | The replacement named in the deprecation message |
| `deprecated-yaml` | Properties marked `deprecated: true` in the platform's YAML schemas (`moduledefinition.yml`, `*.siteprl.yml`) | The replacement named in the schema description, see below |
| `legacy-wrd` | `from "wh:wrd/..."`, `new WRDSchema(` | [wrd skill](../wrd/SKILL.md), [migrating-legacy](../wrd/references/migrating-legacy.md) |
| `rpc-json` | Imports of `*.rpc.json` | [rpc-json-to-service](../rpc-json-to-service/SKILL.md) |
| `es-files` | `*.es` files | `wh devkit:es2ts <module>`, then fix the reported lint/type errors |
| `siteprofile-xml` | `*.siteprl.xml` files | `wh devkit:siteprl2yml <module>` (`--dry-run` first, `--mask` to limit), then [siteprofiles](../siteprofiles/SKILL.md) |
| `witty` | `*.witty` files | [witty-to-litty](../witty-to-litty/SKILL.md) |
| `harescript-cli` | `scripts/whcommands/*.whscr` | [harescript-cli-to-typescript](../harescript-cli-to-typescript/SKILL.md) |
| `shell-scripts` | `*.sh` files | [convert-shell-to-typescript](../convert-shell-to-typescript/SKILL.md) |

The deprecated API check relies on `@deprecated` JSDoc tags, so it covers every deprecated platform API (and
deprecated JavaScript built-ins such as `substr`) without a list to maintain. It also covers `run` from
`@webhare/cli` (now `runCli`) and `run` from `@webhare/test` (now `runTests`).

The deprecated YAML check works the same way, using `deprecated: true` in the schemas of the platform's
`moduleFileTypes` (eg. `mod::platform/data/schemas/siteprofile.schema.yml`). Renames it currently finds include:

| Where | Deprecated | Replacement |
| --- | --- | --- |
| siteprofile `webDesign` | `pageBuilder` | `onRenderPage` |
| siteprofile `webDesign` | `siteResponseFactory` | `onRenderPage` (rewrite: the page builder receives a `PageBuildRequest`) |
| siteprofile types | `workflow: true` | `clone: onDraft` (drop `workflow: false`, `onCopy` is the default) |
| siteprofile `apply` | array form of `baseProps` | object form, see the [siteprofiles skill](../siteprofiles/SKILL.md) |
| moduledefinition `backendServices` | `clientFactory`, `controllerFactory` | `onCreateClient`, `onCreateController` |
| moduledefinition `openApiServices` | `initHook`, `handlerInitHook` | `onInitService`, `onInitHandler` |
| moduledefinition `acmeChallengeHandlers` | `handlerFactory` | `onCreateHandler` |

The renames are WebHare 6.0 changes. `contentBuilder` and `widgetBuilder` (now `onRenderContent` and
`onRenderWidget`) are no longer supported at all, not even as deprecated aliases, so the scan can't report them.
Search for them (`grep -rnE 'contentBuilder|widgetBuilder' --include='*.yml'`) and rename them by hand.

## 2. Report and ask

Present the results as a table with one row per category that has hits: the category, what it is, the number of
affected files and occurrences, and the effort (mechanical rename vs. rewrite). Split `deprecated-api` into one row
per deprecated symbol, as each is a separate, often trivial, change. Leave out empty categories but say they were
checked.

Also mention these, which the scan doesn't count but may be worth doing:

- HareScript libraries and screens that could move to TypeScript
  ([harescript-to-typescript](../harescript-to-typescript/SKILL.md)). Only suggest this for a specific, contained
  piece of code; never as a blanket conversion.
- `moduledefinition.xml` sections that `moduledefinition.yml` also supports (eg. tasks, WRD schemas, siteprofiles,
  webdesigns, backend services). Check the platform's `moduledefinition.schema.yml` before suggesting a move.

Then ask the user which modernizations to do (multi-select if the tool supports it) and stop until they answer.

## 3. Convert the selected categories

Handle one category at a time:

1. Load the linked skill for the category and follow it.
1. Before applying a replacement API, check that it exists in the oldest WebHare version the module supports
   (`webhareversion` on `<packaging>` in `moduledefinition.xml`). Deprecation messages often say when the
   replacement was introduced, eg. "Switch to plainText in WH5.8+". If the module still supports an older version,
   skip that change and report it.
1. Keep behavior identical. A legacy and modern API with the same method names can still differ in field names and
   value types (eg. the WRD API returns `Temporal` values instead of `Date`), so update every consumer.
1. Verify: `wh checkmodule <module>` must not report new errors, and rerun the scan to confirm the category is gone.
   Run the tests covering the changed code ([running-tests](../running-tests/SKILL.md)).
1. Summarize per category what was converted, what was skipped and why.
