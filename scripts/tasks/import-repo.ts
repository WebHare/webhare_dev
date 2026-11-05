import { runCli } from "@webhare/cli";
import { lockMutex, toFSPath } from "@webhare/services";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";

const executeFile = promisify(execFile);

/** Format of ai/index.json in the site folder, consumed by the devkit MCP server to advertise skills without parsing every SKILL.md */
interface SkillIndex {
  /** Format version, bump on incompatible changes */
  version: 1;
  /** Commit of the webhare_dev checkout this index was generated from */
  commit: string;
  skills: Array<{
    /** Skill name (frontmatter 'name', falls back to the directory name) */
    name: string;
    /** Short description of when to use the skill (frontmatter 'description') */
    description: string;
    /** Skill directory, relative to ai/ (eg 'skills/wrd'). Original case, the webserver folds URLs to lowercase */
    path: string;
    /** All files in the skill directory, relative to that directory. Original case. Always includes 'SKILL.md' */
    files: string[];
  }>;
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match)
    return {};
  try {
    const parsed = YAML.parse(match[1]);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.error("Invalid skill frontmatter:", (e as Error).message);
    return {};
  }
}

async function buildSkillIndex(checkout: string, commit: string): Promise<SkillIndex> {
  const aiRoot = join(checkout, "content/ai");
  const skillsRoot = join(aiRoot, "skills");
  const index: SkillIndex = { version: 1, commit, skills: [] };
  if (!existsSync(skillsRoot))
    return index;

  for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("."))
      continue;
    const dir = join(skillsRoot, entry.name);
    const skillFile = join(dir, "SKILL.md");
    if (!existsSync(skillFile))
      continue;

    const meta = parseFrontmatter(await readFile(skillFile, "utf8"));
    const files = (await readdir(dir, { withFileTypes: true, recursive: true }))
      .filter(file => file.isFile() && !file.name.startsWith("."))
      .map(file => relative(dir, join(file.parentPath, file.name)).split(sep).join("/"))
      .sort();

    index.skills.push({
      name: typeof meta.name === "string" && meta.name ? meta.name : entry.name,
      description: typeof meta.description === "string" ? meta.description : "",
      path: relative(aiRoot, dir).split(sep).join("/"),
      files
    });
  }
  index.skills.sort((a, b) => a.name.localeCompare(b.name));
  return index;
}

/** Recursively list all files in a folder, relative to that folder ('/' separated) */
async function listFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir))
    return [];
  return (await readdir(dir, { withFileTypes: true, recursive: true }))
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"));
}

/** Mirror the source folder to the target folder, converting all folder and file names to lowercase (the webserver
    folds requested URLs to lowercase). Files in the target that don't exist in the source are removed, except for
    the paths in 'keep' */
async function syncLowercased(source: string, target: string, keep: string[]) {
  const wanted = new Map<string, string>(); //lowercased target path => source path
  for (const file of (await listFiles(source)).sort()) {
    const lower = file.toLowerCase();
    if (wanted.has(lower))
      console.error(`Case conflict: '${wanted.get(lower)}' and '${file}' both map to '${lower}', using '${file}'`);
    wanted.set(lower, file);
  }

  for (const [lower, file] of wanted) {
    const src = join(source, file), dest = join(target, lower);
    //git checkouts don't preserve mtimes, so compare content (files are small)
    if (existsSync(dest) && (await readFile(src)).equals(await readFile(dest)))
      continue;
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest + ".tmp");
    await rename(dest + ".tmp", dest);
  }

  for (const file of await listFiles(target))
    if (!wanted.has(file) && !keep.includes(file))
      await rm(join(target, file));

  //Remove folders that became empty, deepest first
  const dirs = existsSync(target) ? (await readdir(target, { withFileTypes: true, recursive: true })).filter(entry => entry.isDirectory()) : [];
  for (const dir of dirs.map(entry => join(entry.parentPath, entry.name)).sort((a, b) => b.length - a.length))
    if ((await readdir(dir)).length === 0)
      await rm(dir, { recursive: true });
}

/** Sync the checkout's content/ folder to the site folder and generate ai/index.json there */
async function updateSite(checkout: string, site: string, commit: string) {
  await syncLowercased(join(checkout, "content"), site, ["ai/index.json"]);

  //Write the index atomically, so readers never see a partial file
  const indexFile = join(site, "ai/index.json");
  await mkdir(dirname(indexFile), { recursive: true });
  await writeFile(indexFile + ".tmp", JSON.stringify(await buildSkillIndex(checkout, commit), null, 2) + "\n");
  await rename(indexFile + ".tmp", indexFile);
}

runCli({
  description: "Import the webhare_dev repository checkout: sync its content/ folder to the site folder and generate ai/index.json",
  async main() {
    using lock = await lockMutex("webhare_dev:import-repo", { timeout: 0 });
    if (!lock)
      throw new Error("Another import-repo task is already running");

    const checkout = toFSPath("storage::webhare_dev/checkouts/webhare_dev");
    if (!existsSync(join(checkout, ".git")))
      throw new Error(`No webhare_dev checkout at ${checkout} - run the webhare_dev:update_from_github task first`);

    const commit = (await executeFile("git", ["-C", checkout, "rev-parse", "HEAD"])).stdout.trim();
    await updateSite(checkout, toFSPath("storage::webhare_dev/site"), commit);
    console.log(`Imported commit ${commit}`);
    return 0;
  }
});
