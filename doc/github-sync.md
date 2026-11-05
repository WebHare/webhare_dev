## GitHub checkout
The `update_from_github` task (`scripts/tasks/update-from-github.ts`) runs at startup and every five minutes. It uses
command-line Git over anonymous HTTPS to clone and fast-forward the `main` branch
of https://github.com/WebHare/webhare_dev into
`storage::webhare_dev/checkouts/webhare_dev`. Git must be available on `PATH`.
Updates fail rather than overwrite conflicting local changes or divergent history.
An initial clone or a change to the checked-out commit schedules the `import_repo`
task to run `scripts/tasks/import-repo.ts`. Unchanged checkouts do not schedule an
import. The import script is currently a placeholder.
