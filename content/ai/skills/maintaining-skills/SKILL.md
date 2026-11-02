---
name: maintaining-skills
description: "Create, update, review, or organize WebHare agent skills. Use when editing SKILL.md files, deciding whether guidance belongs in webhare_dev or the WebHare platform repository, or keeping skill content focused and accurate."
---

# Maintaining WebHare skills

Use this workflow when adding or changing skills in `content/ai/skills`, or
when deciding where WebHare development guidance should live.

## Choose the right repository

Choose the location by **who needs the guidance**, not just where the relevant
implementation happens to live:

- Put reusable guidance for people developing WebHare modules, add-ons, and
  applications in `webhare_dev/content/ai/skills/<skill-name>/SKILL.md`. These
  skills should help across module repositories and should not require access
  to the WebHare platform source tree. Examples include module structure,
  backend services, CLI tools, OpenAPI, siteprofiles, widgets, WRD, and tests.
- Put guidance that is **only** useful when developing the WebHare platform
  itself in the platform repository's `.agents/skills/<skill-name>/SKILL.md`.
  This includes platform-internal C++ conventions, how the JSSDK is organized
  and built, and other source-tree-specific developer information. The
  platform's `jssdk` skill is an example of this kind of guidance.
- Do not move a module-development skill into the platform repository merely
  because it describes an API implemented there. If module authors can use
  the instructions without changing the platform, the guidance belongs in
  `webhare_dev`.
- If a topic has both audiences, keep the portable workflow in `webhare_dev`
  and put only the platform-specific additions in the platform repository.
  Avoid maintaining two copies of the same instructions.

## Inspect before editing

1. Read the relevant skill and its neighboring skills. Search for overlapping
   instructions and follow existing links before creating a new skill.
2. Verify technical details against the current source, schemas, tests, and
   established workflows. A plausible convention is not enough; skills should
   distinguish verified behavior from assumptions or version-dependent details.
3. Identify the task boundary. Prefer one focused skill for a coherent workflow;
   use links to related skills for shared prerequisites instead of repeating
   their full instructions.
4. Keep module-facing instructions portable. Do not rely on an individual
   developer's installation, local hostname, checkout path, or unverified
   environment state.

The current collection already separates broad tasks such as
[directory structure](../directory-structure/SKILL.md),
[module definitions](../modules/SKILL.md),
[managed and timed tasks](../tasks/SKILL.md),
[WebHare CLI](../webhare-cli/SKILL.md), and
[running tests](../running-tests/SKILL.md) from narrower topics such as
[widgets](../widgets/SKILL.md), [siteprofiles](../siteprofiles/SKILL.md), and
[OpenAPI](../openapi/SKILL.md). Preserve useful boundaries like these.

## Clarify requirements and verify API freshness

- Ask the requester about every material ambiguity before creating or updating
  a skill. Do not fill gaps by assuming an audience, behavior, supported
  version, or preferred implementation. Questions that are already answered
  by the request or verified source do not need to be asked.
- Be especially cautious with API guidance: verify claims against current
  public APIs, schemas, tests, and version/deprecation notes before including
  them. Do not present an obsolete API as a recommended approach. If a legacy
  form must be documented for maintenance or migration, label it clearly and
  state the current replacement when verified.
- When both alternatives support the needed behavior, prefer YAML and
  TypeScript over XML and HareScript. Verify that the newer alternative
  actually covers the use case; otherwise document the older form as required
  rather than implying an unsupported conversion.

## Structure and frontmatter

Create each skill in its own kebab-case directory:

```text
content/ai/skills/<skill-name>/
├── SKILL.md
├── references/   # Optional: detailed material loaded only when needed
├── scripts/      # Optional: executable helpers required by the workflow
└── assets/       # Optional: templates or other reusable assets
```

- The required YAML frontmatter `name` must match the directory name. Use
  lowercase letters, numbers, and hyphens.
- Write a concise, keyword-rich `description` that says what the skill does
  and when to load it. Include the terms a developer is likely to use when
  asking for the task; avoid vague descriptions or an overly broad trigger.
- Keep the main `SKILL.md` focused and under 500 lines. Put substantial
  reference material in `references/` and link to it with a relative path.
- Make the procedure usable on its own: explain the goal, applicable scope,
  ordered steps, important constraints, and how to verify the result.
- Include examples only when they clarify a real decision or API shape. Check
  them against current code and avoid examples that silently imply unsafe or
  unsupported behavior.
- Cross-link directly relevant skills with relative Markdown links. Avoid
  duplicate procedures, circular link networks, and links to files that do not
  exist.

## Keep skills actionable and maintainable

- Put repeatable task procedures and task-specific knowledge in skills, not
  general always-on rules that belong in project instructions.
- State critical constraints where they affect the workflow, and explain
  choices that are easy to get wrong. Prefer clear actions over broad advice.
- Name the source of truth when behavior depends on a schema, generated file,
  tool, or runtime. Tell the reader what to inspect or run; do not treat
  generated output as the editable source.
- Reuse existing helpers and repository-standard validation. Give the narrow
  validation steps that match the work, and do not recommend commands that
  have side effects without explaining them.
- Keep the guidance proportional: remove obsolete detail, speculative claims,
  redundant examples, and rules already covered by a linked skill.
- Update affected cross-links when a skill is renamed, split, or removed.

## Review checklist

Before finishing a skill change, check that:

- The skill is in the repository appropriate for its audience.
- Its folder and frontmatter names match, and its description has clear
  discovery keywords and a bounded trigger.
- Its instructions are accurate, actionable, and specific to a coherent task.
- Related skills are linked instead of copied, and every relative link resolves.
- Examples and commands match the current codebase and are safe for the stated
  workflow.
- The main file remains concise, with optional references used only when they
  improve progressive loading.
