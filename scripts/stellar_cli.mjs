import fs from "fs-extra";
import path from "path";
import { execFileSync, execSync } from "child_process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const repoUrl = "https://github.com/stellar/stellar-cli.git";
const localRepoPath = "./stellar-cli-repo";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  }).trim();
}

const argv = yargs(hideBin(process.argv))
  .parserConfiguration({
    "strip-dashed": true,
  })
  .option("cli-ref", {
    type: "string",
    description: "Cli reference",
  })
  .parse();

// Remove the existing repo if it exists
if (fs.existsSync(localRepoPath)) {
  console.log("Removing existing repository...");
  fs.removeSync(localRepoPath);
}

// Perform a shallow clone of the repository
console.log("Cloning repository...");
git(["clone", repoUrl, localRepoPath]);
git(["fetch", "--all"], { cwd: localRepoPath });
git(["fetch", "origin", "+refs/pull/*/merge:refs/remotes/origin/pr/*/merge"], {
  cwd: localRepoPath,
});

const latestVersionTag = git(["tag", "--sort=v:refname"], {
  cwd: localRepoPath,
})
  .split("\n")
  .map((tag) => tag.trim())
  .filter((tag) => tag && !/(rc|preview)/i.test(tag))
  .at(-1);

if (!latestVersionTag) {
  throw new Error("Unable to determine the latest stable stellar-cli tag.");
}

const latestVersion = latestVersionTag.replace(/^v/, "");

const cliRef = argv.cliRef || `v${latestVersion}`;

console.log("the latest version is", latestVersion.toString());
console.log("using cli ref to fetch cli docs: ", cliRef.toString());

execSync(`cd ${localRepoPath} && git checkout --quiet ${cliRef}`);

// Copy FULL_HELP_DOCS.md
const fullHelpDocsPath = path.join(localRepoPath, "FULL_HELP_DOCS.md");
const fullHelpDocsContent = fs.readFileSync(fullHelpDocsPath, "utf8");

const modifiedContent = `---
sidebar_position: 10
description: This document contains the help content for the Stellar command-line program.
---

${fullHelpDocsContent}
`;

fs.writeFileSync(
  "src/helpers/stellarCli.ts",
  `export const latestVersion = "${latestVersion}";`,
);

fs.writeFileSync("docs/tools/cli/stellar-cli.mdx", modifiedContent);

fs.cpSync(path.join(localRepoPath, "cookbook"), "docs/tools/cli/cookbook", {
  recursive: true,
});

execSync("yarn format:mdx");

console.log("All files processed successfully.");
