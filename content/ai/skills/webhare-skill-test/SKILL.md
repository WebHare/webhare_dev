---
name: webhare-skill-test
description: "Check which WebHare AI skill sources this session can use and report them as a checklist: the WebHare devkit MCP server (wh_get_skill), an editable webhare_dev checkout, and the WebHare platform repository's own skills. Only use when the user explicitly asks for a WebHare skill test or skill check, eg. '/webhare-skill-test' or 'run the webhare skill test'. Do not load it on your own initiative."
---

# WebHare skill test

Report which sources of WebHare AI skills are available in the current session.
Only run this when the user explicitly asks for it.

In MCP clients that turn prompts into slash commands, the devkit MCP server
offers this skill as a prompt, eg. `/mcp__webhare__webhare-skill-test` in
Claude Code (the middle part is the name the MCP server was registered under).

Only inspect: don't install modules, change registry keys or edit files as
part of the test. Mention fixes in the report instead.

## Checks

### 1. WebHare devkit MCP server

The devkit MCP server (`wh devkit:mcp-server`) is usually registered under the
name `webhare`, but the name is up to the user. Identify it by its tool instead:
look for a tool named `wh_get_skill`, possibly prefixed with the server name
(eg. `mcp__webhare__wh_get_skill`). The tool may be deferred, in which case
only its name is listed until you load its schema.

- ✅ if the tool is available. Report the server name and, from the server
  instructions, the WebHare version and server name it is connected to.
- ❌ if no such tool exists. If the client lists an MCP server that failed to
  connect and looks like a WebHare server, report that it failed to connect.
  The WebHare VS Code extension registers the server automatically; otherwise
  it can be added by hand as a stdio server running `wh devkit:mcp-server`.

### 2. Editable webhare_dev checkout

Skills can only be updated when they come from a checked-out, writable
webhare_dev module.

1. Read the `wh_get_skill` tool description (load its schema if it is
   deferred). It says where the skills come from:
   - "read from the local webhare_dev checkout on disk at `<path>`": the
     server uses a local checkout.
   - "downloaded from the webhare.dev site ... read-only published copies":
     the server uses the published site. A reason in parentheses says why it
     didn't use a local checkout.
1. Run `wh getmoduledir webhare_dev`. If it fails, webhare_dev isn't installed.
1. If it is installed, check that the module directory is a git checkout
   (`git -C <moduledir> rev-parse --show-toplevel`) and that you can write to
   its `content/ai/skills/` directory (eg. `test -w`).

- ✅ if webhare_dev is installed, is a git checkout and its skills directory is
  writable. Report the path and the current branch.
- ⚠️ if the checkout is editable but the MCP server serves the published
  site skills, so edits won't be visible through `wh_get_skill`. Suggest
  `wh registry set devkit:integrations.use_checkedout_site true`.
- ❌ if webhare_dev isn't installed, isn't a git checkout or isn't writable.
  It can be checked out from https://github.com/WebHare/webhare_dev and
  installed as a module.

If the MCP server isn't available (check 1), still do steps 2 and 3.

### 3. WebHare platform skills

The WebHare platform repository (github.com/webhare/platform) keeps skills for
working on the platform itself in `.agents/skills/`. Claude Code finds them
through the `.claude/skills` symlink when the session is started in a
platform checkout.

Check the list of skills available to you in this session (not the
`wh_get_skill` list) for:

- `devkit-containers`
- `create-pr`

- ✅ if both are available.
- ⚠️ if only one is.
- ❌ if neither is. Note whether the current working directory is a platform
  checkout (it contains `whtree/` and `.agents/skills/`). These skills are
  only needed when working on the platform itself, so this is expected in a
  module repository.

## Report

Answer with a short checklist, one line per check plus a detail line where
useful, eg.:

```text
- ✅ WebHare devkit MCP server: 'webhare' (WebHare 6.2.1, server 'dev.example')
- ✅ webhare_dev editable: /path/to/webhare_dev (branch main), served by the MCP server
- ❌ WebHare platform skills: devkit-containers and create-pr not available (not a platform checkout)
```

Follow it with the suggested fixes for any ⚠️ or ❌ items.
