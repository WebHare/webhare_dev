---
name: webhare-cli
description: "Create, update, or migrate WebHare TypeScript command-line tools with @webhare/cli. Use for CLI argument parsing, flags and options, Commander migrations, stdin handling, and command error behavior."
---

# WebHare CLI tools

Use `@webhare/cli` for WebHare TypeScript command-line tools. Import `runCli`; the shorter `run` export is deprecated.

## Find and invoke existing commands

- `wh help` (or `wh --help`) lists available commands. Use it for command discovery, not for individual command usage.
- For commands implemented with `@webhare/cli`, use `wh <command> --help` or `wh <command> <subcommand> --help` for targeted usage. `wh help <module>` lists that module's commands; `wh help run` is not help for the `run` command.
- `wh runtest -- /absolute/path/to/test.ts` runs a WebHare test. See the [running-tests skill](../running-tests/SKILL.md).
- `wh service` controls the service manager and registered backend services. For example, `wh service restart <module>:<service>` restarts only that backend service; see the [backend-services skill](../backend-services/SKILL.md).
- `wh node` invokes Node with WebHare's TypeScript compiler plugin and environment. Use `wh run <script.ts>` for ordinary WebHare scripts rather than bypassing the script runner with raw `node`.

## Define a command

- Put boolean switches in `flags` and switches that take values in `options`—options always require a value. Use `multiple: true` when an option accepts repeated values.
- Declare positional argument shapes explicitly: `<name>` required, `[name]` optional, `<name...>` one-or-more, `[name...]` zero-or-more. Preserve their order and required/optional behavior.
- Option and flag names use lowercase kebab-case in the definition and become camelCase in `opts`. Comma-separated aliases are supported; the last name is the property used in `opts`.
- An option without a default is optional in `opts`; adding a default makes it present. Defaults should have the parsed value's type. Flags default to `false`, and are set to `true` when supplied even if their default is `true`.
- Use `enumOption`, `intOption`, and `floatOption` for constrained values rather than parsing unvalidated strings inside `main`. A custom `CLIArgumentType` can provide `parseValue` and optional `autoComplete`; incomplete completion suggestions should end in `*`.
- For integer positional arguments as well as options (for example entity IDs, process IDs, and counts), declare `type: intOption()` and use the resulting number directly in `main`; do not call `parseInt` or `Number` on the raw argument. For example: `{ name: "<id>", description: "Entity ID", type: intOption() }`. This rejects malformed values such as `123invalid` instead of accepting a numeric prefix. Use `intOption({ start, end })` when bounds are required by the command.
- For subcommands, define global flags/options on the parent and command-specific ones on each subcommand. Use `shortDescription` for concise command listings, `description` for detailed help, and `hidden: true` for executable commands omitted from help and completion. Set `mixedFlags: false` only when a command intentionally disallows mixing options and positional arguments.
- Preserve the command name, aliases, descriptions, defaults, help text, subcommands, output, and exit behavior.
- `main` may return `void`, a number, or a promise of either. A returned number sets the process exit code if one has not already been set. Throw `CLIRuntimeError` for expected user-facing failures; it prints the message without a stack trace and defaults to exit code 1. Use its `exitCode` or `showHelp` options when needed. `CLISyntaxError` is for invalid parsed values such as failures in a custom `parseValue`.
- `runCli` starts command processing and returns before `main` runs; it is not a promise to await or chain. Define behavior in `main`, and don't call it separately or wrap the `runCli` call in `.then()`, `.catch()`, or `.finally()`. If shared setup needs parsed global options, use the returned handle's `global` promise.
- Add the exact `// @webhare/cli: <short description>` header only when loading the file is safe for command discovery/autocomplete (no side effects outside the `runCli` call). Keep its description short enough for the command listing, ideally under 50 characters.

For example, `main` receives parsed positional arguments as `args`, option and flag values as `opts`, and the names of explicitly supplied options in `specifiedOpts`:

```typescript
// @webhare/cli: Load a file

import { runCli } from "@webhare/cli";

runCli({
  flags: {
    "v,verbose": { description: "Show extra info" },
  },
  options: {
    "with-data": { description: "string option" },
  },
  arguments: [
    { name: "<file>", description: "File to load" },
  ],
  main({ args, opts, specifiedOpts }) {
    console.log(`Load file ${args.file}`);
    console.log(`Verbose: ${opts.verbose ? "yes" : "no"}`);
    console.log(`WithData: ${opts.withData ?? "<not specified>"}`);
    console.log(`List of specified options: ${specifiedOpts.join(", ")}`);
  },
});
```

## Migrate a Commander command

1. Read the whole command and record its positional arguments, options, flags, aliases, defaults, subcommands, help behavior, output, and error/exit semantics.
1. Replace the `commander` import and `program` setup with `runCli` from `@webhare/cli`.
1. Map the chained `.name()`, `.argument()`, `.option()`, and `.parse()` declarations to the corresponding command configuration, keeping their behavior.
1. Move the old `main` implementation into `runCli`'s `main` callback. Remove a separate top-level `main()` call.
1. If the file is safe for command discovery/autocomplete, add the exact `// @webhare/cli: <short description>` header. If the old file has a `//short:` description, use that text and remove the old comment.
1. Validate the converted command's syntax, help, output, and exit codes against the original behavior.

## Read filename arguments and stdin

For a filename argument where `-` means stdin, a simple synchronous read can use `readFileSync(filename === "-" ? 0 : filename)` from `node:fs`; pass `"utf-8"` for text or wrap the bytes in `WebHareBlob.from(...)` when a `WebHareBlob` is required.

Synchronous reads from piped stdin can fail with `EAGAIN`: `readFileSync(0)` does not make stdin blocking, and prior stream activity can leave a pipe nonblocking. Temporary gaps before EOF can expose this, especially with large base64 payloads passed through `spawnSync({ input })`; reading `/dev/null` does not test this case. For robust piped input, use an asynchronous reader such as `readArgFile` from `@mod-platform/js/cli/cli-tools` rather than duplicating stdin/file buffering.

## Terminal formatting

Use `ansiCmd` for supported color and cursor escape sequences rather than hard-coding them. It emits no sequences when output is not detected as a color terminal. Use `setAnsiCmdMode("enabled" | "disabled" | "default")` only when a deliberate override is needed, such as making terminal output deterministic in a test.

## HareScript command migrations

When converting a HareScript command from `scripts/whcommands`, also use the [HareScript CLI migration skill](../harescript-cli-to-typescript/SKILL.md) for wrapper conventions and HareScript-specific compatibility and validation guidance.
