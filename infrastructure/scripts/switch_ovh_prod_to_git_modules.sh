#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 <repo-url-or-github-org> <version-tag-or-branch> [stack-main-tf]" >&2
  echo "Example (monorepo): $0 https://github.com/lucasdsm78/BetLeague dev /Users/.../infrastructure/stacks/ovh-prod/main.tf" >&2
  echo "Example (repos dédiés): $0 lucasdsm78 v1.0.0 /Users/.../infrastructure/stacks/ovh-prod/main.tf" >&2
  exit 1
fi

REPO_OR_ORG="$1"
VERSION="$2"
TARGET_FILE="${3:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/stacks/ovh-prod/main.tf}"

python3 - <<'PY' "$REPO_OR_ORG" "$VERSION" "$TARGET_FILE"
from pathlib import Path
import sys

repo_or_org = sys.argv[1]
version = sys.argv[2]
target = Path(sys.argv[3])
content = target.read_text()

is_repo_url = repo_or_org.startswith(("http://", "https://", "ssh://", "git@"))

if is_repo_url:
    repo = repo_or_org.removesuffix(".git")
    replacements = {
        'source = "../../modules/ovh-private-network"': f'source = "git::{repo}.git//infrastructure/modules/ovh-private-network?ref={version}"',
        'source = "../../modules/cloudinit-docker-host"': f'source = "git::{repo}.git//infrastructure/modules/cloudinit-docker-host?ref={version}"',
        'source = "../../modules/ovh-public-instance"': f'source = "git::{repo}.git//infrastructure/modules/ovh-public-instance?ref={version}"',
        'source = "../../modules/ovh-zone-records"': f'source = "git::{repo}.git//infrastructure/modules/ovh-zone-records?ref={version}"',
    }
else:
    org = repo_or_org
    replacements = {
        'source = "../../modules/ovh-private-network"': f'source = "git::ssh://git@github.com/{org}/terraform-ovh-private-network.git?ref={version}"',
        'source = "../../modules/cloudinit-docker-host"': f'source = "git::ssh://git@github.com/{org}/terraform-cloudinit-docker-host.git?ref={version}"',
        'source = "../../modules/ovh-public-instance"': f'source = "git::ssh://git@github.com/{org}/terraform-ovh-public-instance.git?ref={version}"',
        'source = "../../modules/ovh-zone-records"': f'source = "git::ssh://git@github.com/{org}/terraform-ovh-zone-records.git?ref={version}"',
    }

original_content = content
for src, dst in replacements.items():
    content = content.replace(src, dst)

if content == original_content:
    raise SystemExit(f"Aucune source locale ../../modules/... trouvée dans {target}")

target.write_text(content)
print(f"Updated {target}")
PY


