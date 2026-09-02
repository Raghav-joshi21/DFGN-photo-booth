#!/usr/bin/env bash
#
# Auto-commit hook.
#
# Wired up as a PostToolUse hook (see .claude/settings.json) so every Write /
# Edit / NotebookEdit that Claude Code makes is committed and pushed. Runs
# async, so it never blocks the editing tool.
#
# Design rules, because this runs unattended after *every* edit:
#   - Always exit 0. A non-zero exit from a PostToolUse hook is surfaced as a
#     tool failure; a bookkeeping script must never break the actual work.
#   - Never commit mid-merge/rebase/cherry-pick — that would corrupt the
#     in-progress operation.
#   - Hold a lock. Parallel edits fire parallel hooks, and two `git commit`
#     runs racing on the same index produce "index.lock exists" failures.
#   - A failed push is not fatal: the work stays committed locally.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}" 2>/dev/null || exit 0

git rev-parse --git-dir >/dev/null 2>&1 || exit 0
GIT_DIR_PATH="$(git rev-parse --git-dir)"

# Bail out if a merge/rebase/cherry-pick/bisect is in flight.
for marker in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD BISECT_LOG; do
  [ -e "$GIT_DIR_PATH/$marker" ] && exit 0
done
if [ -d "$GIT_DIR_PATH/rebase-merge" ] || [ -d "$GIT_DIR_PATH/rebase-apply" ]; then
  exit 0
fi

# Detached HEAD: committing is fine but there's no branch to push, so skip
# entirely rather than pile up commits nothing will ever reference.
BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null)" || exit 0
[ -n "$BRANCH" ] || exit 0

# --- Lock (mkdir is atomic) ------------------------------------------------
LOCK="$GIT_DIR_PATH/claude-auto-commit.lock"
# Clear a lock left behind by a killed run.
if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +5 2>/dev/null)" ]; then
  rmdir "$LOCK" 2>/dev/null
fi
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# --- Commit ----------------------------------------------------------------
git add -A || exit 0

# Nothing staged (e.g. the edit only touched gitignored files) → done.
if git diff --cached --quiet; then
  exit 0
fi

CHANGED="$(git diff --cached --name-only | head -3 | xargs -n1 basename 2>/dev/null | paste -sd', ' -)"
COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [ "$COUNT" -gt 3 ]; then
  SUBJECT="chore(auto): update $CHANGED +$((COUNT - 3)) more"
else
  SUBJECT="chore(auto): update $CHANGED"
fi

git commit -q -m "$SUBJECT" -m "Automated commit from the Claude Code PostToolUse hook.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" || exit 0

# --- Push ------------------------------------------------------------------
# Best effort: offline / rejected push leaves the commit safely on the branch.
if git remote get-url origin >/dev/null 2>&1; then
  git push -q origin "$BRANCH" 2>/dev/null \
    || echo "auto-commit: committed locally, push to origin/$BRANCH failed" >&2
fi

exit 0
