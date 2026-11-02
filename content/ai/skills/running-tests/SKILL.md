---
name: running-tests
description: Run and debug WebHare TypeScript or HareScript tests with wh runtest, resolve test-result URLs to the local installation, and verify frontend behavior in a browser.
---

# Running WebHare tests

WebHare uses a customized runner for backend tests (terminal) and frontend tests (usually a headless browser).

When adding or modifying HareScript tests, follow the [HareScript development skill](../harescript-development/SKILL.md) for K&R style in significant new code without reformatting unrelated existing code.

## Validate and run

1. Check TypeScript diagnostics with the editor's diagnostics tool. For HareScript (`.whscr`), use the available WebHare validation tool.
2. Run the narrow affected test using the available WebHare test tool, passing the full test-file path. Discover the tool before invoking it; tool names vary between integrations.
3. If the test tool is unavailable, use `wh runtest <testname>` or `wh runtest -- /absolute/path/to/test.ts`. For example, `wh runtest tollium.richdoc.teststructured-tables`.
4. Run tests serially: they share a global testframework lock. Do not kill another developer's test to acquire the lock; report blocked verification.
5. On failure, inspect the reported log and screenshot. Read logs in bounded sections and use the failure location to narrow the investigation.

For module-wide validation, use `wh checkmodule <modulename>` or the available WebHare module-check tool. This takes longer than focused diagnostics and complements rather than replaces behavioral tests.

## CLI command discovery

`wh runtest` is the test runner; it is listed by `wh help` (also available as
`wh --help`). Prefer the known command and a full test-file path over rediscovering
it for each task. `wh help <module>` lists a module's commands, not usage for an
individual command.

`wh node` runs Node with WebHare's TypeScript compiler plugin and environment;
it is not the test runner. Use `wh run <script.ts>` for ordinary scripts and
`wh runtest` for tests.

For tests involving an already-running backend service, see the
[backend-services skill](../backend-services/SKILL.md): applying configuration
alone does not ensure the process has loaded changed code.

## Open test URLs on the correct installation

Test failures may print links starting with `https://my.webhare.dev/`. This is a generic redirect hostname, not the installation running the test.

- Before opening such a link, replace only `my.webhare.dev` with the actual hostname of the local WebHare installation. Preserve the path, query, and fragment.
- Determine the hostname from a URL supplied by the user or from the active installation's information (for example, the available `wh_info` tool). If it remains unknown, ask the user.
- Hostnames differ per developer and installation. Never hardcode a hostname learned from another session or assume `localhost`.
- Do not configure the generic redirect page just to run a local test.

For example, a reported URL of:

```text
https://my.webhare.dev/.system/jstests/?site=webhare_testsuite.testsite&mask=tollium.richdoc.teststructured-tables
```

should be opened with the same path and query on the current installation's hostname.

## Verify frontend behavior in a browser

Use the user's supplied test-screen URL when available. A Tollium screen can be opened directly through the installation's test portal, for example:

```text
https://<installation-hostname>/testoutput/webhare_testsuite.testsite/testsuiteportal/?app=webhare_testsuite:runscreen(tests%2Frichdoc.main)&
```

This opens an interactive screen; it does not execute the automated test suite. Run the automated test separately.

Use real browser interactions to verify browser-native behavior. Synthetic events dispatched by test helpers do not necessarily trigger native default actions. In particular, synthetic mouse gestures are not proof that native popover light-dismiss works. Prefer the browser automation tools' click, hover, and key actions for such checks. Read DOM state and geometry to confirm the outcome rather than relying only on screenshots.

For a native table-size popover, verify:

- The trigger's `popoverTargetElement` references the picker and clicking the trigger toggles `:popover-open`.
- The picker is positioned beside the trigger, not merely visible somewhere in the viewport.
- Hovering a size highlights the expected number of cells and displays the correct dimensions.
- Clicking outside dismisses the picker without inserting a table.
- Escape dismisses the picker without cancelling the enclosing Tollium screen. If it fails, check whether an enclosing keyboard handler prevents the browser's default action.
- Selecting a size inserts the exact requested rows and columns, closes the picker, and preserves the editor's intended insertion position.

Report automated-test results separately from interactive browser verification, and state any checks that could not be completed.
