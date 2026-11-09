/* Scan a WebHare module for constructs that can be modernized. Read-only: it never changes files.

   wh run mod::webhare_dev/content/ai/skills/modernize-module/scripts/scan-module.ts <module> [--json] [--no-lint]

   Deprecated APIs are found with the module's typed ESLint setup (as used by `wh checkmodule`) plus the
   @typescript-eslint/no-deprecated rule, so every `@deprecated` JSDoc tag in the platform is covered without
   maintaining a list here. The other categories are file and import patterns that aren't marked @deprecated.
*/

import { ESLint } from "eslint";
import { buildRelaxedConfig } from "@webhare/eslint-config";
import { backendConfig } from "@webhare/services";
import { runCli } from "@webhare/cli";
import { globSync, readFileSync } from "node:fs";

type Hit = { file: string; line?: number; detail?: string };
type Category = { id: string; title: string; skill: string; hits: Hit[] };

function listFiles(root: string, pattern: string) {
  return globSync(pattern, { cwd: root, exclude: name => name === "node_modules" || name.startsWith(".") }).toSorted();
}

function findLines(root: string, files: string[], regex: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const lines = readFileSync(root + file, "utf8").split("\n");
    lines.forEach((text, idx) => {
      if (regex.test(text))
        hits.push({ file, line: idx + 1, detail: text.trim() });
    });
  }
  return hits;
}

async function findDeprecatedUses(root: string, tsFiles: string[]): Promise<Hit[]> {
  const project = root + "tsconfig.json";
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      ...buildRelaxedConfig({ project, tsconfigRootDir: root }),
      { files: ["**/*.ts", "**/*.tsx"], rules: { "@typescript-eslint/no-deprecated": "warn" } }
    ],
    allowInlineConfig: false //don't let eslint-disable comments hide deprecations
  });

  const hits: Hit[] = [];
  for (const file of tsFiles) {
    const [result] = await eslint.lintFiles([root + file]);
    for (const msg of result?.messages ?? [])
      if (msg.ruleId === "@typescript-eslint/no-deprecated")
        hits.push({ file, line: msg.line, detail: msg.message });
  }
  return hits;
}

runCli({
  arguments: [{ name: "<module>", description: "Module to scan" }],
  flags: {
    "json": { default: false, description: "Output JSON instead of a report" },
    "no-lint": { default: false, description: "Skip the (slower) deprecated API check" }
  },
  async main({ args, opts }) {
    const root = backendConfig.module[args.module]?.root;
    if (!root)
      throw new Error(`No such module '${args.module}'`);

    const tsFiles = listFiles(root, "**/*.{ts,tsx}").filter(_ => !_.endsWith(".d.ts"));
    const categories: Category[] = [
      {
        id: "deprecated-api",
        title: "Deprecated APIs (eg run -> runCli, test.run -> test.runTests)",
        skill: "none - follow the replacement in the deprecation message",
        hits: opts.noLint ? [] : await findDeprecatedUses(root, tsFiles)
      }, {
        id: "legacy-wrd",
        title: "Legacy WRD API (wh:wrd/... imports, new WRDSchema)",
        skill: "wrd (references/migrating-legacy.md)",
        hits: findLines(root, tsFiles, /from\s+["']wh:wrd\/|new WRDSchema\s*[<(]/)
      }, {
        id: "rpc-json",
        title: "rpc.json imports",
        skill: "rpc-json-to-service",
        hits: findLines(root, tsFiles, /from\s+["'][^"']*\.rpc\.json["']/)
      }, {
        id: "es-files",
        title: "JavaScript .es files",
        skill: "none - run `wh devkit:es2ts <module>`",
        hits: listFiles(root, "**/*.es").map(file => ({ file }))
      }, {
        id: "siteprofile-xml",
        title: "XML siteprofiles (.siteprl.xml)",
        skill: "siteprofiles",
        hits: listFiles(root, "**/*.siteprl.xml").map(file => ({ file }))
      }, {
        id: "witty",
        title: "Witty templates",
        skill: "witty-to-litty",
        hits: listFiles(root, "**/*.witty").map(file => ({ file }))
      }, {
        id: "harescript-cli",
        title: "HareScript wh commands (scripts/whcommands/*.whscr)",
        skill: "harescript-cli-to-typescript",
        hits: listFiles(root, "scripts/whcommands/*.whscr").map(file => ({ file }))
      }, {
        id: "shell-scripts",
        title: "Shell scripts",
        skill: "convert-shell-to-typescript",
        hits: listFiles(root, "**/*.sh").map(file => ({ file }))
      }
    ];

    if (opts.json) {
      console.log(JSON.stringify(categories, null, 2));
      return;
    }

    console.log(`Modernization scan of ${args.module} (${root})\n`);
    for (const cat of categories) {
      const fileCount = new Set(cat.hits.map(_ => _.file)).size;
      const skipped = cat.id === "deprecated-api" && opts.noLint;
      console.log(`[${cat.id}] ${cat.title}: ${skipped ? "skipped (--no-lint)" : `${fileCount} files, ${cat.hits.length} occurrences`}`);
      if (!cat.hits.length)
        continue;

      console.log(`  skill: ${cat.skill}`);
      if (cat.id === "deprecated-api") { //break down per deprecated symbol, the message names it and its replacement
        const bySymbol = [...Map.groupBy(cat.hits, _ => _.detail!).entries()].toSorted(([, lhs], [, rhs]) => rhs.length - lhs.length);
        for (const [message, hits] of bySymbol)
          console.log(`  - ${message}\n      ${hits.map(_ => `${_.file}:${_.line}`).join(", ")}`);
      } else {
        for (const hit of cat.hits)
          console.log(`  - ${hit.file}${hit.line ? `:${hit.line}` : ""}`);
      }
    }
  }
});
