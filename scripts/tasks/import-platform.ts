import { runCli } from "@webhare/cli";
import { listReleaseNoteVersions, readReleaseNotes } from "@mod-platform/js/devsupport/release-notes";
import { lockMutex, toFSPath } from "@webhare/services";
import { openSite, whfsType } from "@webhare/whfs";
import { runInWork } from "@webhare/whdb";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const markdownType = "platform:filetypes.markdown";

interface ReleaseNotesSource {
  /** WHFS name of the release notes: 'index' for the README, else the version (eg '6.2') */
  name: string;
  /** Description of where the text came from, for logging */
  source: string;
  text: string;
}

/** Map a release notes version to its WHFS name: '6.02' becomes '6.2' */
function getTargetName(version: string): string {
  return version.replace(/^(\d+)\.0(\d)$/, "$1.$2"); //older release notes used zero-padded minor versions (eg 4.03)
}

/** Read the README and the release notes of every version, with the fragments of unreleased notes merged in */
async function readReleaseNotesSources(source: string): Promise<ReleaseNotesSource[]> {
  const result: ReleaseNotesSource[] = [];
  const readme = (await readdir(source)).find(file => file.toLowerCase() === "readme.md");
  if (readme)
    result.push({ name: "index", source: readme, text: await readFile(join(source, readme), "utf8") });

  for (const version of await listReleaseNoteVersions(source)) {
    const notes = await readReleaseNotes(source, version);
    if (notes) {
      const fragments = notes.fragmentFiles.length ? ` and ${notes.fragmentFiles.length} fragment(s) in '${version}/'` : "";
      result.push({ name: getTargetName(version), source: `${version}.md${fragments}`, text: notes.text });
    }
  }
  return result;
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

/** Sync doc/release-notes/ of the platform checkout to reference-next/release-notes on www.webhare.dev, including the
    not yet merged fragments of unreleased versions (doc/release-notes/<version>/*.md). Only creates and updates files:
    release notes are never removed, as the site also has release notes that aren't in the repository */
async function importReleaseNotes(checkout: string) {
  const source = join(checkout, "doc/release-notes");
  if (!existsSync(source))
    throw new Error(`No release notes folder at ${source}`);

  const sources = await readReleaseNotesSources(source);

  await runInWork(async () => {
    const site = await openSite("www.webhare.dev");
    const folder = await site.openFolder("reference-next/release-notes");
    const markdown = whfsType(markdownType);

    for (const { name, source: from, text } of sources) {
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
      console.log(`Updated '${name}' from ${from}`);
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
