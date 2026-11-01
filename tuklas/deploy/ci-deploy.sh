#!/usr/bin/env bash
# What GitHub Actions' deploy key is allowed to run on the server, and nothing else. The key's line
# in ~/.ssh/authorized_keys forces this script (deploy/README.md, "Automatic deploys"), so the key
# can't open a shell even if the GitHub secret leaks. GitHub sends the branch or tag to deploy as
# the SSH command; anything that isn't `main` or a release tag (v1.2.3) is refused.

set -euo pipefail

REF="${SSH_ORIGINAL_COMMAND:-main}"
if [[ ! "$REF" =~ ^(main|v[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "Refusing to deploy \"$REF\": only main or a release tag like v1.2.3." >&2
  exit 1
fi

REPO_COPY="$HOME/SIA-TUKLAS"
# The deploy scripts themselves come from this copy, so bring it up to date first
git -C "$REPO_COPY" fetch --quiet --tags origin
git -C "$REPO_COPY" checkout --quiet main
git -C "$REPO_COPY" pull --quiet --ff-only

exec bash "$REPO_COPY/tuklas/deploy/deploy.sh" --ref "$REF"
