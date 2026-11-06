---
name: building-reports
description: "Declare and implement WebHare module reports: the `reports` section of moduledefinition.yml, the `onGenerate` JavaScript/TypeScript generator, the optional Tollium `configScreen`, and the `application/x-webhare-spreadsheet` output format (SpreadsheetData for XLSX/ODS/CSV export). Use when adding, changing or debugging a report."
---

# Building reports

Use this skill when a module offers a report: a named, declared unit of
output (eg an SEO overview or an export of registrations) that WebHare can
generate on request and, in the future, on a schedule or in the background.

> The reporting API is under active development. This skill describes what is
> currently implemented. Anything marked *planned* is not yet available; do
> not depend on it and do not invent APIs for it.

## Declare a report

Reports are declared in the module's `moduledefinition.yml` under `reports`.
The key is the report name; WebHare qualifies it with the declaring module,
so `exportorders` in module `webshop` becomes `webshop:exportorders`.

```yaml
reports:
  exportorders:
    configScreen: tolliumapps/reports/exportorders.xml#config
    onGenerate: js/reports/exportorders.ts#generateOrdersReport
    outputFormat: application/x-webhare-spreadsheet
```

A report without a `configScreen` needs nothing from the user beyond the
params it is started with. For example the platform's SEO settings report
(declared in the `platform` module, implemented in `publisher`):

```yaml
reports:
  seosettings:
    onGenerate: mod::publisher/tolliumapps/filemanager/reports/seoreport.ts#getSEOReport
    outputFormat: application/x-webhare-spreadsheet
```

- Report names must match `^[a-z_][-a-z0-9_]*$`.
- `onGenerate` (required) is a reference to the exported JavaScript/TypeScript
  function that produces the report data: `<path>#<exportname>`, relative to
  the module root (or a full `mod::` path).
- `outputFormat` (required) is the mimetype of what `onGenerate` returns.
  Currently only `application/x-webhare-spreadsheet` is accepted.
- `configScreen` (optional) is a Tollium screen that lets the user set the
  report's parameters before generating it, as `<path>.xml#<screenname>`
  relative to the module root. Omit it if the report needs no user input;
  the report is then generated directly.

Relative references are resolved against the module's `moduledefinition.yml`
in the same way as other moduledefinition function references (see
[module definitions](../modules/SKILL.md)).

## Generator and config screen calling convention

A report is requested with an initial **params** record (eg the folder to
report on). If the report has a `configScreen`, that screen is run first and
returns a **settings** record. `onGenerate` then receives both, plus a
**context**:

```typescript
import type { SpreadsheetData } from "@webhare/office-formats";
import type { ReportContext } from "@webhare/backend-integration";

export async function generateOrdersReport(params: { shop: number }, settings: { includeCancelled: boolean }, context: ReportContext): Promise<SpreadsheetData> {
  …
}
```

- `params` is the record passed by the caller (an empty object if none).
- `settings` is the record returned by the config screen's `Submit` (an empty
  object if the report has no `configScreen`).
- `context.langCode` is the language to use for user-visible texts, eg
  `getTid("module:some.tid", { langCode: context.langCode })`. Do not rely on
  the ambient tid language inside the generator.
- The type for this signature is `SpreadsheetReportGeneratorFunction<Params, Settings>`
  from `@webhare/backend-integration`. Generators may declare fewer
  parameters if they do not need them.
- Give the function that gathers the data the generator signature directly
  and point `onGenerate` at it, as `getSEOReport` does. Do not add a wrapper
  that only reshapes arguments; tests can call the function with the same
  `(params, settings, context)` arguments.

The config screen is an ordinary Tollium screen. It receives
`CELL[ params ]` in `Init` and must implement `RECORD FUNCTION Submit()`,
bound to its OK action with `onexecute="submit"`. Returning a non-default
record proceeds with generation; returning `DEFAULT RECORD` (eg after failed
validation) keeps the screen open, and cancelling aborts the report.

```harescript
PUBLIC STATIC OBJECTTYPE Config EXTEND TolliumScreenBase <
  MACRO Init(RECORD data) {
    ^shop->value := data.params.shop;
  }

  RECORD FUNCTION Submit() {
    OBJECT work := this->BeginFeedback();
    IF(NOT work->Finish())
      RETURN DEFAULT RECORD;
    RETURN CELL[ include_cancelled := ^include_cancelled->value ];
  }
>;
```

`RunReportDialog` calls the generator with `CallJS` camelcase conversion, so a
HareScript `include_cancelled` arrives as `includeCancelled`. See
[calling TypeScript from HareScript](../harescript-development/SKILL.md#calling-typescript-from-harescript)
for how names and values are converted.

## Running a report from the backend

`RunReportDialog` in `mod::platform/lib/dialogs.whlib` runs the whole flow:
config screen (if any), `onGenerate`, then the standard column file export
dialog (`RunColumnFileExportDialog`) to let the user download XLSX/ODS/CSV.
It passes the current tid language as `context.langCode`.

```harescript
LOADLIB "mod::platform/lib/dialogs.whlib";

MACRO DoExportSEOReport() {
  RunReportDialog(this, "platform:seosettings", CELL[ folder := this->GetCurrentlySelectedFolder() ]);
}
```

It takes the opener (a screen or controller), the full `module:report` name
and the optional params record. It returns `FALSE` if the user cancelled the
config screen and otherwise the result of the export dialog. Do not write a
per-report `CallJS` + `RunColumnFileExportDialog` wrapper; declare the report
and call `RunReportDialog`.

## Output format: `application/x-webhare-spreadsheet`

This is an intermediate tabular format that WebHare can convert to XLSX, ODS
or CSV. `onGenerate` returns `SpreadsheetData` (or a `WorkbookData` with
multiple sheets) from `@webhare/office-formats`:

```typescript
import type { SpreadsheetData } from "@webhare/office-formats";

export async function generatePagesReport(): Promise<SpreadsheetData> {
  return {
    title: "Pages",
    columns: [
      { name: "path", title: "Path", type: "string" },
      { name: "noindex", title: "No index", type: "boolean" }
    ],
    rows: [
      { path: "/", noindex: false }
    ],
    split: { rows: 1 },
    withAutoFilter: true
  };
}
```

- Every row property should have a matching entry in `columns`; the column
  `name` is the row property and `title` is the header shown to the user.
- Column types include `string`, `number` (with optional `decimals`),
  `boolean`, `date`, `dateTime` (requires `storeUTC`), `money` and `time`.
  Check `SpreadsheetColumn` in `@webhare/office-formats` for the current list.
- Use language texts (`getTid`) for titles and other user-visible strings.
- Keep row keys lowercase without separators (eg `pageheading`). The data is
  returned to HareScript with camelcase conversion, which renames row keys but
  not the column `name` values that refer to them.
- Generate the data only; do not produce the XLSX/ODS file in the generator.
  `generateXLSX` and `generateODS` from `@webhare/office-formats` are the
  converters for this format.

## Planned

- Scheduled and background generation of reports.
- Additional output formats.

## Verify

1. Run `wh apply config` after changing `moduledefinition.yml`; schema errors
   in the `reports` section are reported by `wh check <module>`.
1. The parsed declarations are written to the `reports` configuration extract
   (`<dataroot>/config/extracts/reports.json`). Check there that the report
   name is qualified and `onGenerate`/`configScreen` resolve to the intended
   `mod::` paths.
1. Test the generator from a backend test (see
   [running tests](../running-tests/SKILL.md)), eg asserting on the returned
   `columns` and `rows`. Call it through
   `generateReport(name, params, settings, { langCode })` from
   `@mod-platform/js/reports/reports` to also verify the declaration resolves.
1. Test the full flow from a Tollium HareScript test: run `RunReportDialog`
   with `ExpectScreenChange`, fill in the config screen (if any), click its
   submit button, then capture the download with
   `ExpectSentWebFile(PTR TTClick(":Download"))` and check the rows with
   `GetOOXMLSpreadsheetRows` (from `wh::ooxml/spreadsheet.whlib`). The
   platform's `webhare_testsuite:testreport` (with config screen),
   `webhare_testsuite:testreport_noconfig` (without) and
   `tests/tollium/test-reports.whscr` show this pattern.
