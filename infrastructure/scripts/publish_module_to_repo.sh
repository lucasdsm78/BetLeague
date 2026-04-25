#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 <module-name> <git-remote-url> [branch]" >&2
  exit 1
fi

MODULE_NAME="$1"
REMOTE_URL="$2"
BRANCH="${3:-main}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
MODULE_PATH="infrastructure/modules/${MODULE_NAME}"
TMP_BRANCH="split-${MODULE_NAME}-$(date +%s)"

cd "$REPO_ROOT"

if [ ! -d "$MODULE_PATH" ]; then
  echo "Module introuvable: $MODULE_PATH" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Le working tree Git doit être propre avant un subtree split." >&2
  exit 1
fi

echo "[1/4] subtree split de ${MODULE_PATH}"
git subtree split --prefix "$MODULE_PATH" -b "$TMP_BRANCH" >/dev/null

echo "[2/4] push vers ${REMOTE_URL} (${BRANCH})"
git push "$REMOTE_URL" "$TMP_BRANCH:$BRANCH"

echo "[3/4] suppression de la branche temporaire ${TMP_BRANCH}"
git branch -D "$TMP_BRANCH" >/dev/null

echo "[4/4] terminé"
echo "Module ${MODULE_NAME} publié dans ${REMOTE_URL} sur ${BRANCH}."

