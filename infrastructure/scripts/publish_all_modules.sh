#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <github-org-or-user> [branch]" >&2
  echo "Example: $0 lucasdsm78 main" >&2
  exit 1
fi

ORG="$1"
BRANCH="${2:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PUBLISH_SCRIPT="${SCRIPT_DIR}/publish_module_to_repo.sh"

MODULES=(
  "cloudinit-docker-host"
  "ovh-private-network"
  "ovh-public-instance"
  "ovh-zone-records"
)

for module in "${MODULES[@]}"; do
  remote="git@github.com:${ORG}/terraform-${module}.git"
  echo "============================================================"
  echo "Publication du module ${module} vers ${remote} (${BRANCH})"
  echo "============================================================"
  "${PUBLISH_SCRIPT}" "${module}" "${remote}" "${BRANCH}"
done

echo "Tous les modules ont été publiés."

