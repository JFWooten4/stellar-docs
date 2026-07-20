// @ts-check

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const DEFAULT_BASELINE_PATH = ".github/xdr-watch.json";
const DEFAULT_REPORT_PATH = "xdr-watch-report.md";
const ISSUE_MARKER = "<!-- xdr-documentation-watch -->";
const CURRENT_XDR_LINK =
  /https:\/\/github\.com\/stellar\/stellar-xdr\/blob\/curr\/([^#)\s>]+)(?:#L(\d+)(?:-L(\d+))?)?/g;
const MAX_REPORTED_FILES = 100;
const MAX_REPORTED_LINKS = 200;

function parseArguments(argv) {
  const options = {
    baselinePath: DEFAULT_BASELINE_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    baseSha: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--baseline" && value) {
      options.baselinePath = value;
      index += 1;
    } else if (argument === "--output" && value) {
      options.reportPath = value;
      index += 1;
    } else if (argument === "--base-sha" && value) {
      options.baseSha = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  return options;
}

async function fetchGitHubJson(path, token) {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "stellar-docs-xdr-watch",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `GitHub API request failed (${response.status} ${response.statusText}): ${details}`,
    );
  }

  return response.json();
}

function getTrackedMarkdownFiles() {
  const output = execFileSync("git", ["ls-files", "--", "*.md", "*.mdx"], {
    encoding: "utf8",
  });

  return output.split(/\r?\n/).filter(Boolean);
}

function findCurrentXdrLinks(markdownFiles) {
  const links = [];

  for (const documentationPath of markdownFiles) {
    const source = readFileSync(documentationPath, "utf8");
    CURRENT_XDR_LINK.lastIndex = 0;

    for (const match of source.matchAll(CURRENT_XDR_LINK)) {
      const sourceLine = source.slice(0, match.index).split("\n").length;
      links.push({
        documentationPath,
        sourceLine,
        xdrPath: decodeURIComponent(match[1]),
        xdrStartLine: match[2] ?? "",
        xdrEndLine: match[3] ?? "",
        targetUrl: match[0],
      });
    }
  }

  return links;
}

function formatLimitedList(items, limit, formatter) {
  const visible = items.slice(0, limit).map(formatter);
  if (items.length > limit) {
    visible.push(`- _${items.length - limit} additional items omitted_`);
  }
  return visible.join("\n");
}

function documentationUrl(documentationPath, sourceLine) {
  const repository = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  if (!repository || !sha) {
    return "";
  }

  return `https://github.com/${repository}/blob/${sha}/${documentationPath}#L${sourceLine}`;
}

function formatDocumentationReference(link) {
  const label = `${link.documentationPath}:${link.sourceLine}`;
  const sourceUrl = documentationUrl(link.documentationPath, link.sourceLine);
  const source = sourceUrl ? `[\`${label}\`](${sourceUrl})` : `\`${label}\``;
  const lineRange = link.xdrStartLine
    ? `#L${link.xdrStartLine}${link.xdrEndLine ? `-L${link.xdrEndLine}` : ""}`
    : "";

  return `- ${source} -> [\`${link.xdrPath}${lineRange}\`](${link.targetUrl})`;
}

function setOutput(name, value) {
  console.log(`${name}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

const options = parseArguments(process.argv.slice(2));
const baseline = JSON.parse(readFileSync(options.baselinePath, "utf8"));
const repository = baseline.repository;
const branch = baseline.branch;
const baseSha = options.baseSha || baseline.baseSha;
const token = process.env.GITHUB_TOKEN ?? "";

if (!repository || !branch || !baseSha) {
  throw new Error(
    `The baseline file must define repository, branch, and baseSha: ${options.baselinePath}`,
  );
}

const branchData = await fetchGitHubJson(
  `/repos/${repository}/branches/${encodeURIComponent(branch)}`,
  token,
);
const headSha = branchData.commit.sha;
const changed = headSha !== baseSha;
let report;

if (!changed) {
  report = `${ISSUE_MARKER}
# XDR documentation watch

The recorded baseline already matches [\`${repository}@${branch}\`](https://github.com/${repository}/tree/${branch}) at \`${headSha}\`. No documentation review is required.
`;
} else {
  const comparison = await fetchGitHubJson(
    `/repos/${repository}/compare/${baseSha}...${headSha}`,
    token,
  );
  const comparisonFiles = comparison.files ?? [];
  const changedXdrFiles = comparisonFiles
    .map((file) => file.filename)
    .filter((filename) => filename.endsWith(".x"))
    .sort();
  const comparisonMayBeTruncated = comparisonFiles.length >= 300;
  const currentLinks = findCurrentXdrLinks(getTrackedMarkdownFiles());
  const changedXdrSet = new Set(changedXdrFiles);
  const affectedLinks = currentLinks
    .filter(
      (link) => comparisonMayBeTruncated || changedXdrSet.has(link.xdrPath),
    )
    .sort((left, right) =>
      `${left.documentationPath}:${left.sourceLine}`.localeCompare(
        `${right.documentationPath}:${right.sourceLine}`,
      ),
    );

  const changedFileList = changedXdrFiles.length
    ? formatLimitedList(
        changedXdrFiles,
        MAX_REPORTED_FILES,
        (filename) => `- \`${filename}\``,
      )
    : "- No `.x` files changed; advance the baseline after confirming the comparison.";
  const affectedLinkList = affectedLinks.length
    ? formatLimitedList(
        affectedLinks,
        MAX_REPORTED_LINKS,
        formatDocumentationReference,
      )
    : "- No documentation links target the changed XDR files.";
  const truncationWarning = comparisonMayBeTruncated
    ? "\n> [!WARNING]\n> GitHub returned at least 300 changed files, so the comparison may be truncated. This report conservatively lists every `curr` XDR link for review.\n"
    : "";

  report = `${ISSUE_MARKER}
# XDR \`curr\` changed

[\`${repository}@${branch}\`](https://github.com/${repository}/tree/${branch}) moved from \`${baseSha}\` to \`${headSha}\`.

- [Review the upstream comparison](https://github.com/${repository}/compare/${baseSha}...${headSha})
- Changed XDR files: **${changedXdrFiles.length}**
- Potentially affected documentation links: **${affectedLinks.length}**
${truncationWarning}
## Changed XDR files

${changedFileList}

## Documentation links to review

${affectedLinkList}

## Resolve this check

1. Confirm that each linked definition and line range still identifies the intended XDR.
2. Update any stale documentation links.
3. Set \`baseSha\` in \`${options.baselinePath}\` to \`${headSha}\` in the same pull request.

The bot will close this issue after the updated baseline reaches the default branch.
`;
}

writeFileSync(options.reportPath, report);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
}

setOutput("changed", String(changed));
setOutput("head_sha", headSha);
setOutput("base_sha", baseSha);
console.log(`Wrote XDR documentation report to ${options.reportPath}`);
