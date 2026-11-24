---
name: self-checks
description: "Add a module check that reports problems as issues on the WebHare dashboard and in 'wh check': selfChecks in moduledefinition.yml with a TypeScript CheckFunction returning CheckResult objects (type, metadata, messageText/messageTid, isCritical, jumpTo). Use when a module should raise a dashboard issue, warning or alert when something is wrong (a failing build, an expiring credential, a missing configuration), or when debugging why such an issue does or doesn't appear or disappear."
---

# Module self-checks

A self-check is a TypeScript function that the platform runs periodically to
find problems. Every result it returns is shown as an issue on the WebHare
dashboard and by `wh check`; an issue disappears once the check stops
returning it. Use it for conditions someone should notice and fix, not for
logging events or sending notifications.

Don't confuse this with [dashboard panels](../dashboard-panels/SKILL.md),
which add a screen to the dashboard, or with `wh checkmodule`, which validates
module source code.

## Register the checker

List the checker under `selfChecks` in the module's `moduledefinition.yml`.
The path is relative to the module root, followed by `#` and the exported
function name:

```yaml
selfChecks:
  - checker: js/checks.ts#checkBackups
```

`checker` is the only property. The schema is `SelfChecks` in
`mod::platform/data/schemas/moduledefinition.schema.yml`.

## Write the checker

The function takes no arguments and returns (a promise of) an array of
`CheckResult`. Import the types from `@webhare/services`:

```typescript
import type { CheckFunction, CheckResult } from "@webhare/services";

export async function checkBackups(): Promise<CheckResult[]> {
  const issues: CheckResult[] = [];
  for (const backup of await loadBackupStatus()) { // your own (cheap) status source
    if (backup.lastSuccess < Date.now() - 2 * 86400_000)
      issues.push({
        type: "mymodule:backup.outdated",
        metadata: { target: backup.target },
        messageText: `Backup of ${backup.target} hasn't succeeded for over two days`,
        isCritical: backup.target === "production",
        jumpTo: null
      });
  }
  return issues;
}

checkBackups satisfies CheckFunction;
```

The `CheckResult` properties:

- `type` (required): a module-scoped name, `<module>:<name>`. Use a distinct
  type per kind of problem.
- `metadata`: an object identifying *which* instance of the problem this is,
  eg. `{ repository, branch }`. See identity below.
- `messageText` or `messageTid` (one is required): the message shown to the
  user. `messageTid` is `{ tid, params? }` and is resolved in English when the
  result is stored.
- `isCritical`: marks the issue as critical (shown first, prefixed with
  `CRITICAL:` by `wh check`).
- `jumpTo`: `null`, or a record with the backend application (`app`, and
  optionally `target` and `reusemode`) that the dashboard opens for the issue.
- `scopes`: optional classification (`"gdpr"`, `"policy"`); leave it out for
  ordinary issues.

## How results become issues

The `system:intervalchecks` timed task runs all checkers every 5 minutes, at
startup and after `wh softreset`, and stores the results:

- An issue is identified by `type` plus `metadata`. Returning the same pair
  again keeps the existing issue (and any snooze on it); a changed message,
  `jumpTo` or `isCritical` updates it in place.
- An issue that a run doesn't return is closed. So put only stable
  identifying data in `metadata`, never timestamps or counters; put those in
  the message. Otherwise every run closes the issue and opens a new one.
- Duplicate results (same `type` and `metadata`) are merged.
- If a checker throws, the run reports a `platform:checkfailed` issue for it
  instead of its results, so a broken checker is visible too.

## Constraints

- Checkers run on every server that has the module installed, including
  development and test servers, and `selfChecks` has no server-type filter.
  If a check only makes sense in production, make the function return `[]`
  elsewhere, eg. when the data it inspects doesn't exist.
- Checkers run every 5 minutes and in parallel with all others. Keep them
  cheap: read state that a task or webhook already gathered (a WRD entity,
  registry key, or a file in `storage::<module>/`) instead of calling slow or
  rate-limited external APIs from the checker.
- Keep the decision logic in a separate function that takes the gathered
  state as a parameter, so a test can feed it data without depending on
  live state.

## Verify

1. Run `wh checkmodule <module>` to validate `moduledefinition.yml` and the
   TypeScript.
1. Run `wh softreset`. It reloads the module configuration, runs the checks,
   waits up to a minute for them and prints the current issues. `wh check`
   prints the issues stored by the last run without running the checks.
1. Look for `platform:checkfailed` (`Checker ... failed: ...`) in the output,
   which means the checker threw or couldn't be loaded.
1. Test the decision logic with a backend test; see
   [running tests](../running-tests/SKILL.md).
