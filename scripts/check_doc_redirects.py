#!/usr/bin/env python3
"""Detect removed docs URLs and propose safe, documented Nginx redirects.

Only moves with uniquely identified destinations receive an automatic fix.
Ambiguous deletions and invalid redirect chains must be reviewed manually.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REDIRECTS = Path("nginx/includes/redirects.conf")
DOC_SUFFIXES = (".md", ".mdx")
REWRITE = re.compile(r'^\s*rewrite\s+(\^\S+)\s+"([^"\n]+)"\s+permanent\s*;', re.M)
SLUG = re.compile(r'^slug:\s*["\']?([^\s"\']+)', re.M)


def git(*args):
  result = subprocess.run(["git", *args], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
  return result.stdout.decode("utf-8", errors="replace")


def is_doc(path):
  return path.startswith("docs/") and path.endswith(DOC_SUFFIXES)


def route(path, content=""):
  """Map ordinary docs paths and supported absolute Docusaurus slugs to URLs."""
  if not is_doc(path):
    return None
  frontmatter = content.split("---", 2)
  if content.startswith("---") and len(frontmatter) > 2:
    match = SLUG.search(frontmatter[1])
    if match:
      slug = match.group(1)
      if not slug.startswith("/"):
        return None  # Relative slugs require manual inspection.
      return ("/docs" + slug).rstrip("/") if not slug.startswith("/docs/") else slug.rstrip("/")
  raw = "/" + path.rsplit(".", 1)[0]
  return raw[:-6] if raw.endswith("/index") else raw


def changed_docs(base, head):
  """Return removed or renamed pages, plus candidate newly added pages."""
  changes = git("diff", "--name-status", "-M", "--diff-filter=ADR", base, head, "--", "docs/")
  removed = []
  added = []
  for row in changes.splitlines():
    fields = row.split("\t")
    action = fields[0][0]
    if action == "R" and len(fields) == 3:
      old, new = fields[1:]
      if is_doc(old):
        removed.append((old, new if is_doc(new) else None))
      if is_doc(new):
        added.append(new)
    elif action == "D" and len(fields) == 2 and is_doc(fields[1]):
      removed.append((fields[1], None))
    elif action == "A" and len(fields) == 2 and is_doc(fields[1]):
      added.append(fields[1])
  return removed, added


def current_docs(head):
  paths = git("ls-tree", "-r", "--name-only", head, "--", "docs/").splitlines()
  docs = {path: "" for path in paths if is_doc(path)}
  # Read bodies only where an explicit slug might override a file's URL.
  result = subprocess.run(
    ["git", "grep", "-l", "^slug:", head, "--", "docs/"],
    check=False, capture_output=True, text=True,
  )
  if result.returncode not in (0, 1):
    raise RuntimeError(result.stderr)
  for row in result.stdout.splitlines():
    path = row.split(":", 1)[1]
    if path in docs:
      docs[path] = git("show", f"{head}:{path}")
  return docs


def redirects(contents):
  return [(re.compile(source), target) for source, target in REWRITE.findall(contents)]


def lookup(url, rules):
  """Resolve permanent rewrite chains without accepting loops or external URLs."""
  visited = set()
  current = url
  for _ in range(20):
    if current in visited:
      return None, "redirect loop"
    visited.add(current)
    matches = [(pattern, target) for pattern, target in rules if pattern.match(current)]
    if not matches:
      return current, None
    pattern, target = matches[0]
    match = pattern.match(current)
    next_url = re.sub(
      r"\$(\d+)",
      lambda m: (match.group(int(m.group(1))) or "") if int(m.group(1)) <= (match.lastindex or 0) else "",
      target,
    )
    current = next_url.split("#", 1)[0].split("?", 1)[0]
    if not current.startswith("/docs"):
      return None, "external or unsupported redirect destination"
  return None, "redirect chain too long"


def assess(removed, added, before_docs, after_docs, conf, pr_url):
  """Return safe generated rewrite statements and unresolved problems."""
  live_routes = {route(path, content) for path, content in after_docs.items()}
  live_routes.discard(None)
  candidates = {}
  for path in added:
    candidates.setdefault(Path(path).name, []).append(path)
  rules = redirects(conf)
  new_rules = []
  problems = []
  for old, moved in removed:
    previous = route(old, before_docs[old])
    if previous is None:
      problems.append(f"{old}: unsupported slug; check redirect manually")
      continue
    if previous in live_routes:
      continue
    new = moved
    if not new:
      matches = candidates.get(Path(old).name, [])
      if len(matches) == 1:
        new = matches[0]
    replacement = route(new, after_docs[new]) if new in after_docs else None
    resolved, error = lookup(previous, rules)
    if error:
      problems.append(f"{previous}: {error}")
      continue
    if resolved != previous:
      if resolved not in live_routes:
        problems.append(f"{previous}: redirect points to missing {resolved}")
      continue
    if replacement is None or replacement == previous or replacement not in live_routes:
      problems.append(f"{previous}: removed without a unique, live replacement; add a reviewed redirect")
      continue
    if any(pattern.match(previous) for pattern, _ in rules):
      problems.append(f"{previous}: existing redirect must be reviewed")
      continue
    # A contextual comment explains *why* the rule exists, not merely its URL.
    explanation = f"# Preserve links after moving {previous} to {replacement} ({pr_url})"
    escaped = re.escape(previous).replace("\\-", "-")
    statement = f'rewrite ^{escaped}$ "{replacement}" permanent;'
    new_rules.append(explanation + "\n" + statement)
    rules.append((re.compile("^" + re.escape(previous) + "$"), replacement))
  return new_rules, problems


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--base", required=True, help="Git base ref before the PR")
  parser.add_argument("--head", default="HEAD", help="Git head ref")
  parser.add_argument("--mode", choices=("check", "fix"), default="check")
  parser.add_argument("--pr-url", default="https://github.com/stellar/stellar-docs/pulls")
  args = parser.parse_args()
  removed, added = changed_docs(args.base, args.head)
  if not removed:
    print("No moved or deleted documentation pages")
    return 0
  after = current_docs(args.head)
  before = {old: git("show", f"{args.base}:{old}") for old, _ in removed}
  conf = REDIRECTS.read_text(encoding="utf-8")
  fixes, problems = assess(removed, added, before, after, conf, args.pr_url)
  if fixes and args.mode == "fix":
    with REDIRECTS.open("a", encoding="utf-8") as stream:
      stream.write("\n# Automatically preserved documentation URLs\n" + "\n\n".join(fixes) + "\n")
    print(f"Added {len(fixes)} documented Nginx redirects")
  elif fixes:
    problems.extend(f"Missing permanent redirect: {rule.splitlines()[-1]}" for rule in fixes)
  for error in problems:
    print(f"::error::{error}", file=sys.stderr)
  return 1 if problems else 0


if __name__ == "__main__":
  sys.exit(main())
