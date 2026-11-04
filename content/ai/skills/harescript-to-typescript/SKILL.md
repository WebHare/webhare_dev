---
name: harescript-to-typescript
description: Convert HareScript code to TypeScript while preserving behavior
---

# Goal
Migrate HareScript (.whscr or .whlib) logic to TypeScript with behavior parity and minimal risk.

# Scope
- Input: one or more HareScript files
- Output: equivalent TypeScript implementation
- Keep changes minimal, preserve behavior, and avoid unrelated refactors

# Workflow
1. Capture current behavior before editing:
- inputs and outputs
- side effects
- errors and warnings
- exit/status behavior (for scripts)

2. Map HareScript APIs to TypeScript equivalents:
- prefer @webhare/harescript loadlib bridges where direct TS APIs are not available yet
- before adding a bridge, check nearby TypeScript tests and SDK exports for an existing API. For example, `AuthenticationSettings.fromPasswordHash(hash)` from `@webhare/wrd` replaces `CreateAuthenticationSettingsFromPasswordHash`; see `tests/wrd/nodejs/test_wrd_auth.ts`.
- NEVER loadlib a `.whscr` file. `.whscr` files are executable scripts containing top-level code that executes upon import, causing unwanted side effects. Only `loadlib` `.whlib` files. If logic in a `.whscr` is needed, port it directly to TypeScript or move it to a `.whlib`
- do not add manual openPrimary calls when using loadlib from @webhare/harescript
- map `GetDtapStage()` to `dtapStage` from `@webhare/env` (`"development" | "test" | "acceptance" | "production"`)
- when typing a bridged HareScript object, use an intersection type such as `type KeyPair = HSVMObject & { Method(): Promise<void> }`; `interface KeyPair extends HSVMObject` can trigger TypeScript errors
- TypeScript can call HareScript object methods directly, but cannot directly access HareScript object properties
- read HareScript object properties with `await obj.$get<T>("property")`, not `obj.property`
- write HareScript object properties with `await obj.$set("property", value)`, not `obj.property = value`
- when a blob comes from HareScript via `HSVMObject.$get` or as a return value, type it as `HSVMBlob` (from `@webhare/harescript/src/wasm-hsvmvar`), not `WebHareBlob`
- when using generated WRD TypeScript schemas, map snake_case HareScript fields to camelCase TS fields (example: sfad_moments -> sfadMoments)
- map HS WRD event mask calls to TypeScript as: `wrdschema->^wrdtype->GetEventMasks()` -> `schema.getEventMasks("wrdtype")`
- map HS HTML encoding to TypeScript as: `EncodeHTML(x)` -> `encodeString(x, "html")` from @webhare/std

3. Implement TypeScript incrementally:
- keep function boundaries small
- preserve error text where it is user-visible
- preserve observable ordering where relevant
- preserve deprecation messages verbatim where practical
- preserve aliases and compatibility shims where they exist and are still user-visible
- when HS function names use InitialCaps, convert exported TS functions/classes to normal TypeScript naming conventions (lower camelCase for functions, UpperCamelCase for classes)
- for CLI/task scripts that use @webhare/cli, prefer runCli over run
- for JSON equality checks, prefer stringify(value, { stable: true }) from @webhare/std over custom canonicalization helpers
- prefer `await using work = await beginWork()` and `await work.commit()` from `@webhare/whdb`. Uncommitted work rolls back on disposal, including on exceptions. For dry runs, perform the writes but skip `work.commit()`. The method is `commit()`, not `finish()`.
- avoid redundant try/catch blocks that only rethrow around transactions
- when existing HareScript helpers encode business behavior (for example HTML cleanup/transforms), keep parity via loadlib instead of reimplementing immediately
- for WRD `query().execute()` results, prefer schema-inferred types; avoid custom row types and avoid `as` casts unless there is a proven typing gap
- preserve explicit HS output column aliases (example: `id := "WRD_ID"`) by adding a TS mapping step (for example map `wrdId` to `id`) before downstream logic uses that alias
- when TS output is consumed by remaining HS code and nullable dates are inconvenient, use @webhare/hscompat defaults (`defaultDateTime` for Date, `defaultDateTime.toTemporalInstant()` for Temporal.Instant) to preserve HS `DEFAULT DATETIME` semantics

4. Validate compatibility:
- inspect side effects and the intended target before executing a migrated script. A development DTAP stage is not proof that a server is disposable.
- never run `tests/system/twohare/prepare-server2.ts` on a normal WebHare installation, even for validation. It creates a sysop with a known password and enables dynamic client registration; execution is restricted to the isolated second Twohare test server. Use static diagnostics elsewhere, and do not assume `wh run ... --help` is a safe validation shortcut without verifying its execution path.
- run `wh validate <filename>` on changed .ts files (lint only) and modified HareScript/XML resources
- run `wh checkmodule <modulename>` to type-check the TypeScript; `wh validate` does not report type errors
- run `wh runtest <test name or full path>` for relevant tests when practical
- do not use tsc or npm test as primary verification for WebHare module migrations

5. Rollout cleanup for scheduled tasks:
- for other migrated scripts, update shell runners and test metadata too, including `testinfo.xml` ignore masks for preparation scripts that must not be discovered as tests.
- if the migrated HareScript file is referenced by a `<task script="...">` in moduledefinition.xml, update the script path to the new .ts file
- after updating the reference, offer to delete the original HareScript file; if approved, remove it and verify no references remain

# Conversion checklist
- Inputs parsed the same way
- Error and warning conditions preserved
- Return/exit semantics preserved
- External side effects preserved
- moduledefinition task references updated when applicable
- legacy script deleted when approved and no references remain
- No unrelated formatting or API churn

# Notes
- When adding or substantively editing remaining HareScript, follow the [HareScript development skill](../harescript-development/SKILL.md) for K&R style without unrelated formatting churn, and for calling the converted TypeScript from remaining HareScript with `CallJS`.
- If the target is a command-line script, apply the separate CLI-specific skill.
- Keep legacy HareScript files in place until all callers are migrated, unless explicitly asked to remove them.
- Exception: for moduledefinition task migrations, after updating the task reference to .ts, explicitly offer deletion of the legacy .whscr and remove it when approved.
- In the WebHare platform repository, tests are located under modules/webhare_testsuite/tests.
- In addon modules, tests are located in the module root under /tests/.
- If the migration also changes persistence format (for example HSON field to JSON field), keep payload shape parity with existing consumers unless consumers are migrated in the same change.
