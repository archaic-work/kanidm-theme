#!/usr/bin/env bash
set -euo pipefail

: "${KANIDM_VERSION:?Run ci/resolve-version.sh first and export KANIDM_VERSION}"
container="kanidm-theme-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
volume="$container-data"
image="docker.io/kanidm/server:${KANIDM_VERSION}"

if docker container inspect "$container" >/dev/null 2>&1; then
  echo "Container $container already exists; run ci/stop.sh first" >&2
  exit 1
fi

docker pull "$image"
docker volume create "$volume" >/dev/null
docker create --name "$container" \
  --publish 127.0.0.1:8443:8443 \
  --mount "type=volume,source=$volume,target=/data" \
  --mount "type=bind,source=$PWD/override.css,target=/hpkg/override.css,readonly" \
  "$image" >/dev/null

docker cp ci/server.toml "$container:/data/server.toml"
docker run --rm \
  --mount "type=volume,source=$volume,target=/data" \
  "$image" /sbin/kanidmd cert-generate

docker start "$container" >/dev/null
echo "Waiting for ephemeral Kanidm at https://localhost:8443"
ready=0
for _ in $(seq 1 90); do
  if [[ "$(curl -ksS --max-time 2 https://localhost:8443/status 2>/dev/null)" == "true" ]]; then
    ready=1
    break
  fi
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container")" != "true" ]]; then
    break
  fi
  sleep 2
done

if [[ "$ready" != 1 ]]; then
  echo "Kanidm failed to become healthy" >&2
  docker logs --tail 120 "$container" >&2 || true
  exit 1
fi
echo "Kanidm is healthy ($KANIDM_VERSION)"
