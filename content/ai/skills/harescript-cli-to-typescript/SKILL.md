---
name: harescript-cli-to-typescript
description: Convert WebHare CLI command scripts from HareScript to TypeScript
---

# Goal
Migrate a command in scripts/whcommands from HareScript to TypeScript while preserving syntax, behavior, and integration with wh.

# Scope
- Input: one existing .whscr command file, optionally with a .sh wrapper
- Output: a .ts command implementation plus wrapper updates if needed

# CLI workflow
1. Read the source command and document user-visible behavior:
- subcommands
- syntax/help output
- success/failure output
- exit semantics

2. Implement the TypeScript CLI with `@webhare/cli` following the shared [WebHare CLI skill](../webhare-cli/SKILL.md), preserving the command's existing interface and behavior.

3. Keep wrapper behavior stable:
- if a .sh wrapper has special-case handling, keep it
- route migrated paths to TS using wh run when requested by module conventions

4. Apply the generic harescript-to-typescript skill for shared migration rules:
- compatibility behavior preservation
- loadlib and API-bridging guidance
- validation and test guidance

# Checklist
- subcommand and argument behavior preserved
- option/flag behavior preserved (`--name value` as `options`, boolean toggles as `flags`)
- invalid syntax handled by @webhare/cli
- error exit codes handled by CLIRuntimeError
- warnings/success output preserved
