import { runCli } from "@webhare/cli";
import { lockMutex, toFSPath } from "@webhare/services";
import { openSite, whfsType } from "@webhare/whfs";
import { runInWork } from "@webhare/whdb";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const markdownType = "platform:filetypes.markdown";

/** Map a release notes file name to its WHFS name: README.md becomes the folder's index, '6.02.md' becomes '6.2' */
function getTargetName(file: string): string {
  const base = file.replace(/\.md$/i, "");
  if (base.toLowerCase() === "readme")
    return "index";
  return base.replace(/^(\d+)\.0(\d)$/, "$1.$2"); //older release notes used zero-padded minor versions (eg 4.03)
}

/** Compare release note names so the most recent version sorts first, comparing each version part numerically
    (4.30 after 4.29, not after 4.3). The index sorts before all versions */
function compareReleaseNotes(lhs: string, rhs: string): number {
  if (lhs === "index" || rhs === "index")
    return (lhs === "index" ? -1 : 0) + (rhs === "index" ? 1 : 0);
  const lhsParts = lhs.split(".").map(Number), rhsParts = rhs.split(".").map(Number);
  for (let i = 0; i < Math.max(lhsParts.length, rhsParts.length); ++i) {
    const diff = (rhsParts[i] ?? 0) - (lhsParts[i] ?? 0);
    if (diff)
      return diff;
  }
  return lhs.localeCompare(rhs);
}

/** Sync doc/release-notes/ of the platform checkout to reference-next/release-notes on www.webhare.dev. Only creates
    and updates files: release notes are never removed, as the site also has release notes that aren't in the repository */
async function importReleaseNotes(checkout: string) {
  const source = join(checkout, "doc/release-notes");
  if (!existsSync(source))
    throw new Error(`No release notes folder at ${source}`);

  const files = (await readdir(source, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /\.md$/i.test(entry.name))
    .map(entry => entry.name)
    .sort();

  await runInWork(async () => {
    const site = await openSite("www.webhare.dev");
    const folder = await site.openFolder("reference-next/release-notes");
    const markdown = whfsType(markdownType);

    for (const file of files) {
      const name = getTargetName(file);
      const text = await readFile(join(source, file), "utf8");
      //Don't use ensureFile: it updates (and thus touches the modification date of) existing files even if nothing changed
      let target = await folder.openFile(name, { allowMissing: true });
      if (target?.type === markdownType) {
        const current = await markdown.get(target.id, { export: true });
        if (current.data?.type === "platform:markdown" && "text" in current.data && current.data.text === text)
          continue;
      }

      if (!target)
        target = await folder.createFile(name, { type: markdownType, title: name === "index" ? "Release notes" : `${name} release notes`, publish: true });

      await markdown.set(target.id, { data: { type: "platform:markdown", text } });
      await target.update({ type: markdownType, publish: true }); //sets the modification date and republishes the file
      console.log(`Updated '${name}' from '${file}'`);
    }

    //Order the folder's files (including release notes that aren't in the repository) with the most recent version first
    const entries = (await folder.list(["name", "ordering", "isFolder", "modified"])).filter(entry => !entry.isFolder);
    entries.sort((lhs, rhs) => compareReleaseNotes(lhs.name, rhs.name));
    const reorder = entries.filter((entry, idx) => entry.ordering !== idx + 1);
    for (const entry of reorder)
      await (await folder.openFile(entry.name)).update({ order: entries.indexOf(entry) + 1, modified: entry.modified }); //reordering doesn't modify the release notes themselves

    //Every page shows the folder's navigation, so republish them all when the order changed
    if (reorder.length) {
      for (const entry of entries)
        await (await folder.openFile(entry.name)).republish();
      console.log(`Reordered ${reorder.length} release notes, republished ${entries.length} files`);
    }
  });
}

runCli({
  description: "Import the platform repository checkout: sync its release notes to www.webhare.dev",
  async main() {
    using lock = await lockMutex("webhare_dev:import-platform", { timeout: 0 });
    if (!lock)
      throw new Error("Another import-platform task is already running");

    const checkout = toFSPath("storage::webhare_dev/checkouts/platform");
    if (!existsSync(join(checkout, ".git")))
      throw new Error(`No platform checkout at ${checkout} - run the webhare_dev:update_from_github task first`);

    await importReleaseNotes(checkout);
    return 0;
  }
});
