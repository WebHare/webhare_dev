---
name: tasks
description: "Set up WebHare managed and timed tasks. Use for TypeScript task runners, scheduleTask and scheduleTimedTask, moduledefinition.yml task registration, or moduledefinition.xml timed-task declarations."
---

# WebHare tasks

Use this skill when adding or changing background work in a WebHare module.
Prefer TypeScript handlers and `moduledefinition.yml` managed-task registration
where supported. Keep HareScript examples for existing modules or requirements
that still use HareScript. Timed-task registration currently uses
`moduledefinition.xml`; its script can be TypeScript.

Before documenting or implementing an API, verify it against the current
`@webhare/services` exports and module-definition schema for the target
WebHare version. Do not copy a plausible API from an old example without
checking whether it is still supported.

## Choose the task kind

- **Managed task:** durable, queued, one-off work. The queue survives the
  request that scheduled it and retries a task after an exception or an
  explicit temporary failure/restart. Use this for deferred work that must
  eventually be attempted.
- **Timed task:** a named script registered in the module definition and run
  on a cron-like schedule. Use `scheduleTimedTask` / `ScheduleTimedTask` to
  request that an existing timed task run sooner; this is not a way to enqueue
  multiple independent task instances.
- For a one-off task that must not run before a particular time, use a managed
  task's `notBefore` option (HareScript: `notbefore`) rather than treating a
  timed task as a per-request queue.

Managed task execution may be retried. Make work safe to retry, especially
external side effects such as sending mail or calling a remote service.

## Register a managed task

For new TypeScript managed tasks, declare the task in the module's
`moduledefinition.yml`. The schema's `tasks` map supports a runner and the
`allowIfRestore` / `ifWebHare` applicability options:

```yaml
tasks:
  archiveitem:
    runner: js/tasks/archive-item.ts#archiveItem
```

The runner is a TypeScript function receiving a `TaskRequest` and returning a
`TaskResponse`. Open work before database operations. Return a resolution from
the request; the task runner finalizes the result and commits the work.

```ts
import { type TaskRequest, type TaskResponse } from "@webhare/services";
import { beginWork } from "@webhare/whdb";

interface ArchiveItemTask {
  itemId: number;
}

export async function archiveItem(req: TaskRequest<ArchiveItemTask>): Promise<TaskResponse> {
  await beginWork();
  // Perform the database work using req.taskdata.
  return req.resolveByCompletion();
}
```

Schedule the task from TypeScript with the public `@webhare/services` API.
Scheduling requires open work; the task becomes eligible when that work is
committed.

```ts
import { scheduleTask } from "@webhare/services";
import { beginWork, commitWork } from "@webhare/whdb";

await beginWork();
const taskId = await scheduleTask("mymodule:archiveitem", { itemId: 123 });
await commitWork();
```

`TaskRequest` exposes `taskid`, `numFailures`, and `taskdata`, and provides
resolutions such as `resolveByCompletion`, `resolveByTemporaryFailure`,
`resolveByPermanentFailure`, and `resolveByRestart`. Use a permanent failure
only when retrying cannot succeed; exceptions and temporary failures are
retryable.

### HareScript and XML compatibility

For an existing HareScript task, the XML registration uses `objectname` and
the implementation derives from `ManagedTaskBase`:

```xml
<servicemanager>
  <managedtask type="archiveitem" objectname="lib/internal/tasks.whlib#ArchiveItemTask" />
</servicemanager>
```

Implement `RunTask` and resolve it with one of the `ManagedTaskBase` resolution
methods. Queue it during open work:

```harescript
ScheduleManagedTask("mymodule:archiveitem", [ itemid := 123 ]);
```

For new registrations, prefer the YAML/TypeScript form above. Use the XML
`<managedtask>` form when maintaining an XML-based module or a HareScript
handler. Do not use the old `->ScheduleTask` API; it was deprecated and has
been disabled on non-production installations.

## Register and trigger a timed task

Timed tasks are declared in the `<servicemanager>` of `moduledefinition.xml`.
The XML schema currently has no YAML timed-task declaration. Use a TypeScript
script where possible:

```xml
<servicemanager>
  <task tag="dailycleanup"
        script="scripts/tasks/daily-cleanup.ts"
        runat="13 0 * * *"
        runtz="UTC"
        description="Clean up expired data" />
</servicemanager>
```

For `<task>`:

- `script` and `tag` are required. The task is addressed as
  `module:tag` (here, `mymodule:dailycleanup`).
- `runat` is a five-field cron mask: minute, hour, day of month, month, day of
  week. Check the current `GetNextCronTime` documentation/tests for supported
  syntax; do not assume every system's cron extensions are accepted.
- `runtz` selects the timezone and defaults to UTC. The special `maintenance`
  timezone offsets from UTC using `WEBHARE_MAINTENANCE_OFFSET`.
- `runatstartup="true"` requests a startup run in addition to the schedule.
- `timeout` is in minutes for a timed `<task>`; the managed-task timeout uses
  milliseconds. Do not carry units between these two declarations.

Trigger it from TypeScript with `scheduleTimedTask`:

```ts
import { scheduleTimedTask } from "@webhare/services";
import { beginWork, commitWork } from "@webhare/whdb";

await beginWork();
const queued = await scheduleTimedTask("mymodule:dailycleanup");
await commitWork();
await queued.taskDone;
```

`scheduleTimedTask` requires open work. Its optional `when` requests an
execution time, but the request is ignored if the task is already scheduled
sooner (including by its own `runat`). Await `taskDone` only after committing;
it waits up to 24 hours for the timed task to finish and rejects if it fails
or does not finish in time. Repeated requests do not create multiple runs.

The HareScript equivalent is `ScheduleTimedTask("mymodule:dailycleanup",
[ when := ... ])`, also called during open work. `when` is optional (run as
soon as possible); HareScript also supports `allowmissing`, while the current
TypeScript API does not.

### Activate a newly declared timed task

A `<task>` added to `moduledefinition.xml` is not known to the task scheduler
until WebHare performs a soft reset. Running `wh apply all` (or applying only
the module's WRD schema or registry) does not register it. Until then,
`ScheduleTimedTask("module:tag")` throws `No such timed task 'module:tag'
registered`. After adding the declaration, run `wh softreset` on the
development installation (this restarts services) before testing code that
schedules the task. Code that can run before the module is fully installed,
for example from a Tollium screen's save handler, can pass
`[ allowmissing := TRUE ]` in HareScript.

### Pattern: run at a per-record moment ("24 hours before X")

To act at a moment derived from data (for example, send a mail 24 hours
before each event starts) without polling every minute:

1. Declare a timed task with an infrequent `runat` (for example daily) as a
   safety net.
1. In each run, process every record that is due. At the end, compute the
   earliest future due moment and call
   `ScheduleTimedTask("module:tag", [ when := nextmoment ])`. A `when` later
   than an already scheduled run is ignored, so this is safe to call each run.
1. Wherever the underlying data is edited (for example the `AfterStore` of a
   WRD entity edit screen), request a run as soon as possible with
   `ScheduleTimedTask("module:tag")` inside the open work, so the next moment
   is recalculated.
1. Make each run idempotent: record per item that the action was done (for
   example a `...sent` datetime field), and have the actual side effect
   recheck its preconditions, because the data may have changed after it was
   queued.

Do the side effect itself (such as sending mail) in a managed task queued by
the timed task, so it gets the managed task's retries.

### Wait for a managed task (HareScript)

`RetrieveManagedTaskResult(taskid, maxwait)` from `mod::system/lib/tasks.whlib`
waits for the task and returns its result. It throws if the task failed
(options `acceptcancel`, `accepttempfailure` and `accepttimeout` relax this)
and throws when called with work open. Commit the work that scheduled the task
first.

## Verification

1. Confirm the registration shape and options against the current
   `moduledefinition.yml` schema or `moduledefinition.xml` XSD.
1. Confirm TypeScript imports against the public `@webhare/services` exports;
   do not depend on internal SDK paths.
1. Validate the module and TypeScript task using the repository's normal
   module-check and TypeScript validation workflow.

See also the [module definition skill](../modules/SKILL.md) for general
module-definition conventions.
