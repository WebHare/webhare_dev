# WebHare AI skills

The `content/ai/skills/` folder of this module contains skills for AI agents (such as Claude) that help with WebHare module development: module structure,
TypeScript and HareScript conventions, WRD, siteprofiles, tests and more. Each skill is a subfolder with a `SKILL.md`
file and optional supporting files:

```text
<skill-name>/
├── SKILL.md      # YAML frontmatter with 'name' and 'description', followed by the instructions
└── ...           # Optional references/, scripts/, assets/
```

Only subfolders containing a `SKILL.md` are skills.

## How AI clients get these skills

WebHare's devkit module includes an MCP server (`wh devkit:mcp-server`) that offers these skills to AI clients. See
"MCP server" in the devkit documentation (`doc/devkit.md` in the WebHare platform repository) for how to connect it to
Claude.

The MCP server shows the agent the name and `description` of every skill, so the agent knows when a skill applies. The
agent then loads the full `SKILL.md` (and any supporting files it refers to) through the server. A good description
is therefore what makes a skill get used.

### Registry keys
Two registry keys of the devkit module, on the WebHare server the MCP server connects to, decide where the skills come
from:

- **`devkit:integrations.use_checkedout_site`** (boolean, default `true`)
  - `true`: use the skills in `content/ai/skills/` of your locally installed `webhare_dev` module. Changes are available
    to the agent right away. This is the setting for working on skills. If `webhare_dev` isn't installed, the server
    falls back to the published copy.
  - `false`: always use the published copy, even if `webhare_dev` is installed. This is useful to check what other
    developers get.
- **`devkit:integrations.webhare_dev_site`** (string, default `https://www.webhare.dev/`)
  - The site to load the published skills from. The MCP server reads `<site>ai/index.json` and fetches the skill
    files relative to `<site>ai/`. Only change this to test against another copy of the webhare.dev site.

View or change them with `wh registry`:

```bash
wh registry get devkit:integrations.use_checkedout_site
wh registry set devkit:integrations.use_checkedout_site false
```

A running MCP server picks up changes to these keys immediately. You don't need to reconnect the agent.

### Publication on webhare.dev
Skills reach www.webhare.dev through the `main` branch of the
[webhare_dev repository](https://github.com/WebHare/webhare_dev):

1. The `webhare_dev:update_from_github` task checks GitHub every 5 minutes and pulls new commits.
2. On a new commit, the `webhare_dev:import_repo` task (see [GitHub checkout](github-sync.md)) copies the repository's `content/` folder to the site with all
   file and folder names in lowercase, and generates `/ai/index.json` listing every skill with its description and
   files.
3. MCP servers using the published copy check `/ai/index.json` every 15 minutes.

So a merged change is usually live for everyone within about 20 minutes.

## Contributing

Skills are maintained in the [webhare_dev repository](https://github.com/WebHare/webhare_dev). To add or improve a
skill:

1. Read the [maintaining-skills](../content/ai/skills/maintaining-skills/SKILL.md) skill first. It explains which guidance belongs here and
   which belongs in the WebHare platform repository, how to structure a skill and write its description, and has a
   review checklist. You can also ask your agent to follow it.
2. Make the change in `content/ai/skills/`. The folder name must match the `name` in the frontmatter (lowercase, digits and
   hyphens).
3. Test it with an agent: with the `webhare_dev` module installed and `devkit:integrations.use_checkedout_site`
   enabled (the default), the MCP server
   picks up your change immediately. Check that the agent selects the skill for the tasks you intend, and that it
   follows the instructions correctly.
4. Open a pull request against `main`.
