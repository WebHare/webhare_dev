---
name: convert-shell-to-typescript
description: 'Guide for converting shell scripts to TypeScript in this workspace. Covers parity-first migration, CLI conversion with @webhare/cli, safe rollout with shell wrappers, and validation steps.'
---

# Convert Shell To TypeScript

Use this skill when a user asks to migrate a `.sh` script to TypeScript while preserving behavior.

## Goals

- Keep runtime behavior identical first; refactor second.
- Preserve flags, output, exit codes, and side effects.
- Prefer incremental migration so existing entry points keep working.

## Workflow

1. Read the full shell script and map responsibilities:
- CLI parsing and flags.
- Environment variables and defaults.
- External commands and their error handling.
- File I/O, locking, networking, and reporting.
- Comments/TODO/FIXME notes that carry operational knowledge.

2. Create a TypeScript entrypoint next to the shell script:
- File naming pattern: `script.ts` next to `script.sh`.
- Shebang for direct execution: `#!/usr/bin/env node`.
- Make executable when requested: `chmod +x script.ts`.

3. Convert CLI handling:
- Use `@webhare/cli` (`runCli({ flags, options, arguments, main })`).
- Keep option names compatible with the shell script (`--dry-run`, `--fix`, etc.).
- Map kebab-case flags to camelCase option usage consistently.
- Do **not** use `process.exitCode` inside command logic, return numeric status from `main()` instead
- For error exits, prefer `throw new CLIRuntimeError(message, { exitCode })`.

4. Port behavior in small units:
- Command execution wrappers (`spawnSync`, exit-code checks).
- File/path operations (`fs`, `path`, explicit modes for private files).
- Network operations (`fetch` + retries/timeouts as needed).
- Locking (`proper-lockfile` or equivalent if the shell used lock files/flock).

5. Preserve observability and semantics:
- Keep the same user-facing messages where practical.
- Keep error paths and non-zero exit behavior.
- Re-add important shell comments into TS near equivalent logic.

6. Rollout strategy:
- Keep `script.sh` as a wrapper that calls `script.ts`, forwarding args.
- If requested, call TS directly from shell wrapper (no explicit `node`/`tsrun`).
- Remove migrated blocks from shell only after TS parity is verified.

7. Validate:
- Run diagnostics (`get_errors`) on changed TS files.
- Run shell syntax checks (`bash -n`) on modified wrappers.
- If possible, run the command in dry-run mode and compare output with old behavior.

8. Apply generic migration guidance:
- Use the `harescript-to-typescript` skill for generic WebHare migration rules (parity strategy, loadlib bridging, stable JSON comparison strategy, field-name mapping, and module-native validation/testing guidance).

## Shell-To-TS Mapping Cheatsheet

- `set -e`/manual status checks -> explicit status checks and thrown errors.
- `if [ -n "$VAR" ]` -> `if (process.env.VAR)`.
- `mkdir -p` -> `fs.mkdirSync(dir, { recursive: true })`.
- `chmod 700` -> `fs.chmodSync(path, 0o700)`.
- `curl -F` -> `fetch` + `FormData`.
- `jq` transforms -> JSON parse/modify/stringify in TS.
- `flock`/lockfiles -> `proper-lockfile` with clear lock scope.

## Migration Checklist

- Flags/options parity verified.
- Exit codes parity verified.
- Logging/messages parity verified.
- Locking semantics preserved.
- Sensitive file permissions preserved.
- Legacy comments/TODOs retained where still relevant.
- Wrapper updated and syntax-checked.
- New TS file diagnostics clean.

## Common Pitfalls

- Losing shell comments that explain operational constraints. Always migrate comments to the new code too
- Changing defaults accidentally when converting flag parsing.
- Ignoring stderr/stdout behavior differences.
- Removing wrapper too early and breaking existing workflows.
- Missing executable bit when direct invocation is required.
- Using `process.exitCode` in `@webhare/cli` commands instead of returning numeric status (when supported) or throwing `CLIRuntimeError`.
