"""Redirect regression tests, including the #1637/#2858 SDEX incident."""

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_doc_redirects.py"
spec = importlib.util.spec_from_file_location("check_doc_redirects", SCRIPT)
redirects = importlib.util.module_from_spec(spec)
spec.loader.exec_module(redirects)
OLD = "docs/learn/encyclopedia/sdex/liquidity-on-stellar-sdex-liquidity-pools.mdx"
NEW = "docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools.mdx"
OLD_URL = "/" + OLD[:-4]
NEW_URL = "/" + NEW[:-4]
SOURCE = "https://github.com/stellar/stellar-docs/pull/1637"


class RedirectChecks(unittest.TestCase):
  def test_missing_sdex_redirect_fails_before_2858(self):
    before = {OLD: "---\ntitle: Liquidity on Stellar\n---\n"}
    after = {NEW: before[OLD]}
    conf = f'rewrite ^/docs/(learn/)?glossary/liquidity-pools$ "{OLD_URL}#liquidity-pools" permanent;\n'
    additions, errors = redirects.assess([(OLD, NEW)], [NEW], before, after, conf, SOURCE)
    self.assertEqual(errors, [])
    self.assertEqual(len(additions), 1)
    self.assertIn("# Preserve links after moving", additions[0])
    self.assertIn(SOURCE, additions[0])
    self.assertIn(f'rewrite ^{OLD_URL}$ "{NEW_URL}" permanent;', additions[0])
    _, errors = redirects.assess([(OLD, NEW)], [NEW], before, after, conf + additions[0], SOURCE)
    self.assertEqual(errors, [])

  def test_2858_existing_fix_passes(self):
    before = {OLD: "---\ntitle: Liquidity\n---\n"}
    after = {NEW: before[OLD]}
    conf = f'rewrite ^{OLD_URL}$ "{NEW_URL}" permanent;\n'
    fixes, errors = redirects.assess([(OLD, NEW)], [NEW], before, after, conf, SOURCE)
    self.assertEqual((fixes, errors), ([], []))

  def test_redirect_loop_and_broken_destination_fail(self):
    before = {OLD: ""}
    after = {NEW: ""}
    loop = f'rewrite ^{OLD_URL}$ "{OLD_URL}" permanent;\n'
    _, errors = redirects.assess([(OLD, NEW)], [NEW], before, after, loop, SOURCE)
    self.assertIn("redirect loop", errors[0])
    wrong = f'rewrite ^{OLD_URL}$ "/docs/removed-page" permanent;\n'
    _, errors = redirects.assess([(OLD, NEW)], [NEW], before, after, wrong, SOURCE)
    self.assertIn("missing", errors[0])

  def test_ambiguous_removal_does_not_autofix(self):
    before = {OLD: ""}
    after = {"docs/elsewhere/a.mdx": ""}
    fixes, errors = redirects.assess([(OLD, None)], [], before, after, "", SOURCE)
    self.assertEqual(fixes, [])
    self.assertIn("without a unique", errors[0])

  def test_renames_and_deletions_from_git_diff(self):
    with tempfile.TemporaryDirectory() as tmp:
      repo = Path(tmp)
      def git(*args):
        return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()
      git("init", "-q")
      git("config", "user.email", "tests@example.com")
      git("config", "user.name", "Redirect Test")
      src = repo / OLD
      src.parent.mkdir(parents=True)
      src.write_text("---\ntitle: Stellar liquidity\n---\nText\n")
      git("add", ".")
      git("commit", "-qm", "Initial SDEX")
      base = git("rev-parse", "HEAD")
      target = repo / NEW
      target.parent.mkdir(parents=True)
      src.rename(target)
      git("add", "-A")
      git("commit", "-qm", "Move SDEX")
      prior_git = redirects.git
      redirects.git = lambda *args: git(*args)
      try:
        removed, added = redirects.changed_docs(base, "HEAD")
        self.assertEqual(removed, [(OLD, NEW)])
        self.assertEqual(added, [NEW])
      finally:
        redirects.git = prior_git


  def test_cli_fails_then_autofixes_sdex_move(self):
    with tempfile.TemporaryDirectory() as tmp:
      repo = Path(tmp)
      def git(*args):
        return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()
      git("init", "-q")
      git("config", "user.email", "tests@example.com")
      git("config", "user.name", "Redirect Test")
      old = repo / OLD
      old.parent.mkdir(parents=True)
      old.write_text("---\ntitle: SDEX liquidity\n---\nContent\n")
      conf = repo / "nginx/includes/redirects.conf"
      conf.parent.mkdir(parents=True)
      conf.write_text(f'rewrite ^/docs/(learn/)?glossary/liquidity-pools$ "{OLD_URL}#liquidity-pools" permanent;\n')
      git("add", ".")
      git("commit", "-qm", "Before SDEX move")
      base = git("rev-parse", "HEAD")
      new = repo / NEW
      new.parent.mkdir(parents=True)
      old.rename(new)
      git("add", "-A")
      git("commit", "-qm", "Move SDEX without redirect")
      def run(mode):
        return subprocess.run(["python3", str(SCRIPT), "--base", base, "--mode", mode, "--pr-url", SOURCE], cwd=repo, capture_output=True, text=True)
      self.assertNotEqual(run("check").returncode, 0)
      result = run("fix")
      self.assertEqual(result.returncode, 0, result.stderr)
      self.assertEqual(run("check").returncode, 0)
      self.assertIn(SOURCE, conf.read_text())
      self.assertIn(f'rewrite ^{OLD_URL}$ "{NEW_URL}" permanent;', conf.read_text())



if __name__ == "__main__":
  unittest.main()
