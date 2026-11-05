import { runCli } from "@webhare/cli";
import { lockMutex, scheduleTimedTask, toFSPath } from "@webhare/services";
import { runInWork } from "@webhare/whdb";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const repository = "https://github.com/WebHare/webhare_dev.git";

async function git(args: string[]) {
  const { stdout, stderr } = await executeFile("git", ["-c", "credential.helper=", ...args], {
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "" },
    timeout: 120_000
  });

  if (stdout)
    console.log(stdout.trimEnd());
  if (stderr)
    console.error(stderr.trimEnd());
  return stdout.trim();
}

runCli({
  description: "Keep the webhare_dev main branch checkout up to date from GitHub",
  async main() {
    using lock = await lockMutex("webhare_dev:update-from-github", { timeout: 0 });
    if (!lock)
      throw new Error("Another update-from-github task is already running");

    const checkout = toFSPath("storage::webhare_dev/checkouts/webhare_dev");
    let previousCommit: string | undefined;
    if (!existsSync(join(checkout, ".git"))) {
      await mkdir(dirname(checkout), { recursive: true });
      await git(["clone", "--branch", "main", "--single-branch", repository, checkout]);
    } else {
      previousCommit = await git(["-C", checkout, "rev-parse", "HEAD"]);
      await git(["-C", checkout, "fetch", repository, "refs/heads/main:refs/remotes/origin/main"]);
      await git(["-C", checkout, "checkout", "main"]);
      await git(["-C", checkout, "merge", "--ff-only", "origin/main"]);
    }
    const currentCommit = await git(["-C", checkout, "rev-parse", "HEAD"]);
    //import-repo syncs the site folder (and generates ai/index.json) from the checkout. Also run it if that never happened
    if (currentCommit !== previousCommit)
      await runInWork(() => scheduleTimedTask("webhare_dev:import_repo"));
    return 0;
  }
});
