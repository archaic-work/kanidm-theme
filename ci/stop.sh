#!/usr/bin/env bash
set -euo pipefail
container="kanidm-theme-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
docker rm -f "$container" >/dev/null 2>&1 || true
docker volume rm "$container-data" >/dev/null 2>&1 || true
rm -rf "${RUNNER_TEMP:-/tmp}/kanidm-theme-cache"
echo "Removed disposable Kanidm container, volume, and CLI cache"
