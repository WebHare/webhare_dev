---
name: harescript-development
description: "Use when writing or modifying HareScript (.whlib or .whscr), including macros, functions, objecttypes, and backend tests. Covers K&R brace style, limiting formatting churn, dates, Tollium validationchecks in unvalidated work, and calling TypeScript with CallJS (camelcase conversion, value mapping)."
---

# HareScript development

Prefer TypeScript for new standalone scripts and tools. When maintaining or extending HareScript:

- For significant new code, such as a macro, function, or objecttype, use K&R style: put opening `<`, `{`, and `[` at the end of the preceding line, before any line comment, rather than on a separate line.
- Apply this style to new blocks and code already being edited for substantive reasons. Do not reformat unrelated existing code or make trivial changes merely to justify brace-style cleanup; keep diffs focused.
- Preserve existing indentation widths.

```harescript
PUBLIC OBJECTTYPE Example <
  PUBLIC MACRO Run() {
    IF(TRUE) { // Opening delimiter precedes the line comment
      RECORD value := [
        enabled := TRUE
      ];
    }
  }
>;
```

## Dates and times

- `DATETIME` values cannot be subtracted with `-` (compile error: `Expected a
  numeric value, got a value of type 'DATETIME'`). Use
  `GetMsecsDifference(from, to)` from `wh::datetime.whlib`, and
  `AddTimeToDate(msecs, date)` / `AddDaysToDate(days, date)` to move a date.
- Stored `DATETIME` values are UTC. When a date plus a WRD `time` attribute
  (milliseconds since midnight) represents local wall-clock time, convert it
  explicitly, for example
  `LocalToUTC(AddTimeToDate(starttime, eventdate), "Europe/Amsterdam")`.
  `GetRoundedDatetime(UTCToLocal(now, tz), 24 * 60 * 60 * 1000)` gives the
  local start of the day.

## Tollium input validation

`validationchecks` on a field (for example `validationchecks="whfsname"` on a
`textedit`) only runs when the work validates that component. `BeginWork()`
and `BeginFeedback()` validate the whole frame by default, but
`BeginUnvalidatedWork()` and `BeginWork([ validate := OBJECT[] ])` skip it.
Such unvalidated paths are often used for "save as draft". If an unvalidated
path writes the value somewhere it must be valid (such as a WHFS object name),
check it explicitly and report the same message as the validation check:

```harescript
IF(NOT IsValidWHFSName(^name->value, FALSE))
  work->AddErrorFor(^name, GetTid("tollium:validation.errors.invalid_whfsname", ^name->title));
```

Otherwise the invalid value reaches the database and fails as an uncaught
exception instead of a user-facing error. Reuse the existing
`tollium:validation.errors.*` texts (see `mod::tollium/language/default.xml`)
rather than adding new ones.

## Calling TypeScript from HareScript

Use `CallJS` from `wh::javascript.whlib` to call an exported JavaScript or
TypeScript function. Prefer it over porting logic back into HareScript: new
logic goes in TypeScript, and the HareScript caller stays a thin bridge.

```harescript
LOADLIB "wh::javascript.whlib";

//Calls getOrderSummary({ orderId: 42, langCode: "en" }) in orders.ts next to this library
RECORD summary := CallJS([ camelcase := TRUE ], "./orders.ts#getOrderSummary", [ order_id := 42, lang_code := GetTidLanguage() ]);
```

- The first argument is `<library>#<export>`. The library can be relative
  to the calling library (`./file.ts`), a `mod::` path or a package such as
  `@webhare/std`. Relative paths do not work from a script outside a module
  (eg a `direct::` scratch script); use an absolute path there.
- Promises are awaited; `CallJS` returns the resolved value. Under the WASM
  engine the function runs in the same process and shares the open
  transaction. Pass `runinseparatework := TRUE` to run it in its own work,
  committed unless it throws.
- Without options, cell names arrive in JavaScript as lowercase names
  (`lang_code` stays `lang_code`). Pass `[ camelcase := TRUE ]` to convert
  names both ways: arguments are converted snake_case to camelCase and an
  object result back to snake_case. Conversion works on underscores, so
  write the HareScript name with an underscore wherever the JavaScript name
  has a capital: `lang_code` becomes `langCode`, but `langcode` stays
  `langcode`.
- camelcase only renames record *keys*. String values that name properties
  (eg the column `name`s of `SpreadsheetData`) are not converted, so keep such
  keys lowercase without separators to keep keys and names matching.
- Value conversion: `DEFAULT RECORD` arrives as `null` and a `null` result
  returns as `DEFAULT RECORD`. Properties that are `undefined` are dropped.
  `MONEY` maps to `Money` from `@webhare/std` in both directions, and
  `DATETIME` to `Date`. `DEFAULT DATETIME` is *not* `null`: it arrives as a
  `Date` in year 0, so test for it explicitly rather than with
  `=== null`.

## Scripts

`IsConsoleATerminal()` is false when a script's output is piped or captured,
so scripts that print only in that case appear silent under `wh run ... | tail`.
Check the exit status instead.

Validate changed HareScript files and run the focused affected test following the [running-tests skill](../running-tests/SKILL.md).
