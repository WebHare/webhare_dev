import { CLIRuntimeError, runCli } from "@webhare/cli";
import { lockMutex, scheduleTimedTask, toFSPath } from "@webhare/services";
import { runInWork } from "@webhare/whdb";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

interface Checkout {
  /** Checkout name, the folder in storage::webhare_dev/checkouts/ */
  name: string;
  repository: string;
  /** Task to schedule after the initial clone or when the checked-out commit changes */
  onChange?: string;
}

const checkouts: Checkout[] = [
  { name: "webhare_dev", repository: "https://github.com/WebHare/webhare_dev.git", onChange: "webhare_dev:import_repo" },
  { name: "platform", repository: "https://github.com/WebHare/platform.git", onChange: "webhare_dev:import_platform" }
];

async function git(args: string[], { timeout = 120_000 } = {}) {
  let stdout: string, stderr: string;
  try {
    ({ stdout, stderr } = await executeFile("git", ["-c", "credential.helper=", ...args], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "" },
      timeout,
      maxBuffer: 16 * 1024 * 1024
    }));
  } catch (e) {
    //Report git's own error output on stderr, runCli then also sets a nonzero exit code
    const details = (e as { stderr?: string }).stderr?.trim() || (e as Error).message;
    throw new CLIRuntimeError(`git ${args.join(" ")} failed: ${details}`);
  }

  //Only echo git's output when run interactively. As a servicemanager task, any output without an error exit code is
  //reported as a possible problem. Failures are reported above, with an exit code
  if (process.stdout.isTTY) {
    if (stdout)
      console.log(stdout.trimEnd());
    //git reports progress and status (eg "Already on 'main'") on stderr. Real failures make execFile throw
    if (stderr)
      console.log(stderr.trimEnd());
  }
  return stdout.trim();
}

/** Clone or fast-forward the main branch of a checkout. Returns whether the checked-out commit changed */
async function updateCheckout({ name, repository }: Checkout): Promise<boolean> {
  const checkout = toFSPath(`storage::webhare_dev/checkouts/${name}`);
  let previousCommit: string | undefined;
  if (!existsSync(join(checkout, ".git"))) {
    await mkdir(dirname(checkout), { recursive: true });
    //Blobless clone: history is complete but old file versions are only fetched when needed. The platform repository is big
    await git(["clone", "--quiet", "--filter=blob:none", "--branch", "main", "--single-branch", repository, checkout], { timeout: 30 * 60_000 });
  } else {
    previousCommit = await git(["-C", checkout, "rev-parse", "HEAD"]);
    await git(["-C", checkout, "fetch", repository, "refs/heads/main:refs/remotes/origin/main"], { timeout: 10 * 60_000 });
    await git(["-C", checkout, "checkout", "main"]);
    await git(["-C", checkout, "merge", "--ff-only", "origin/main"], { timeout: 10 * 60_000 });
  }
  const currentCommit = await git(["-C", checkout, "rev-parse", "HEAD"]);
  return currentCommit !== previousCommit;
}

runCli({
  description: "Keep the main branch checkouts of webhare_dev and platform up to date from GitHub",
  async main() {
    using lock = await lockMutex("webhare_dev:update-from-github", { timeout: 0 });
    if (!lock)
      throw new CLIRuntimeError("Another update-from-github task is already running");

    //Update each checkout independently, so a failing one doesn't block the others
    const failed: string[] = [];
    for (const checkout of checkouts) {
      try {
        if (await updateCheckout(checkout) && checkout.onChange)
          await runInWork(() => scheduleTimedTask(checkout.onChange!));
      } catch (e) {
        console.error(`Updating checkout '${checkout.name}' failed:`, (e as Error).message);
        failed.push(checkout.name);
      }
    }
    if (failed.length)
      throw new CLIRuntimeError(`Failed to update checkout(s): ${failed.map(name => `'${name}'`).join(", ")}`);
    return 0;
  }
});
