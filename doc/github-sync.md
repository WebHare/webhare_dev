## GitHub checkout
The `update_from_github` task (`scripts/tasks/update-from-github.ts`) runs at startup and every five minutes. It uses
command-line Git over anonymous HTTPS to clone and fast-forward the `main` branch of these repositories:

- https://github.com/WebHare/webhare_dev into `storage::webhare_dev/checkouts/webhare_dev`
- https://github.com/WebHare/platform into `storage::webhare_dev/checkouts/platform`

Git must be available on `PATH`. Initial clones are blobless (`--filter=blob:none`): history is complete, but old
file versions are fetched from GitHub when needed. Updates fail rather than overwrite conflicting local changes or
divergent history. Each checkout is updated independently, so a failure in one doesn't block the other.

An initial clone or a change to the checked-out commit schedules that checkout's import task: `import_repo`
(`scripts/tasks/import-repo.ts`) for webhare_dev, `import_platform` (`scripts/tasks/import-platform.ts`) for
platform. Unchanged checkouts do not schedule an import, unless `storage::webhare_dev/site/ai/index.json` is missing.

## Import
The `import_repo` task mirrors the checkout's `content/` folder to `storage::webhare_dev/site/`, converting all
file and folder names to lowercase (the webserver folds requested URLs to lowercase). Files that no longer exist
in the checkout are removed from the site folder. It then generates `ai/index.json` there, listing the AI skills
in `content/ai/skills/` with their original names and paths. See [AI skills](ai-skills.md).

## Platform import
The `import_platform` task copies the platform checkout's `doc/release-notes/*.md` to markdown files in
`reference-next/release-notes` on the site 'www.webhare.dev'. `README.md` becomes `index`, and zero-padded versions
lose the padding (`6.02.md` becomes `6.2`). New files get the title '<version> release notes'; existing files only get
their content updated, and only when it changed, so unchanged release notes keep their modification date. Files are
never removed from the site. It then sets the order of all files in the folder: the index first, then the most recent
version (comparing version parts numerically, so 4.30 sorts after 4.29), without changing their modification dates.
When the order changes, all files in the folder are republished, as every page shows the folder's navigation.
