---
name: typescript-development
description: "General guidelines for writing TypeScript (.ts/.tsx) code for WebHare modules, both backend and website frontend. Use as a starting point when writing new TypeScript code for a module."
---

# TypeScript development for WebHare modules

General guidelines:
- Use the native `fetch()` for HTTP requests.
- A module is a WebHare extension. The root of a module's folder contains `moduledefinition.xml` and/or
  `moduledefinition.yml`; see the [modules skill](../modules/SKILL.md) and the
  [directory structure skill](../directory-structure/SKILL.md).
- The TypeScript compiler used by WebHare is the one in the WebHare installation's `whtree/node_modules`.

Linting:
- WebHare's ESLint configuration (`@webhare/eslint-config`) treats style issues as errors, which fail
  `wh checkmodule` and CI. In particular, **every file must end with a newline** (`@stylistic/eol-last`) and
  lines may not have trailing whitespace (`@stylistic/no-trailing-spaces`). Make sure the last line of every
  file you create or rewrite is terminated by a newline.
- Run `wh validate <filename>` on touched files to lint them. It doesn't report type errors; use
  `wh checkmodule <modulename>` for the TypeScript type check.

For specific tasks see:
- [Command line tools](../webhare-cli/SKILL.md) using `@webhare/cli`.
- [Managed and timed tasks](../tasks/SKILL.md).
- [Registry keys](../webhare-registry/SKILL.md) using `readRegistryKey` from `@webhare/services`.
- [Building or modernizing tests](../build-modernize-tests/SKILL.md) and [running them](../running-tests/SKILL.md).
