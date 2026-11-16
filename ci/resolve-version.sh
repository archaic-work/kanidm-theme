#!/usr/bin/env bash
set -euo pipefail

# The latest *released* kaniop version is our compatibility authority.
# In particular, do not select latest Kanidm independently of kaniop.
headers=(-H "Accept: application/vnd.github+json")
if [[ -n "${GH_TOKEN:-}" ]]; then
  headers+=(-H "Authorization: Bearer ${GH_TOKEN}")
fi

if [[ -n "${KANIOP_RELEASE:-}" ]]; then
  release="${KANIOP_RELEASE}"
else
  release="$(curl -fsSL --retry 3 "${headers[@]}" \
    https://api.github.com/repos/pando85/kaniop/releases/latest \
    | jq -er '.tag_name')"
fi

[[ "$release" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "Invalid kaniop release tag: $release" >&2
  exit 1
}

manifest="$(curl -fsSL --retry 3 \
  "https://raw.githubusercontent.com/pando85/kaniop/$release/Cargo.toml")"
kanidm_version="$(printf '%s\n' "$manifest" |
  sed -nE 's/^[[:space:]]*kanidm_client[[:space:]]*=[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/p' |
  head -n 1)"
proto_version="$(printf '%s\n' "$manifest" |
  sed -nE 's/^[[:space:]]*kanidm_proto[[:space:]]*=[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/p' |
  head -n 1)"

if [[ -z "$kanidm_version" || "$kanidm_version" != "$proto_version" ]]; then
  echo "Could not establish one matching Kanidm client/proto version from kaniop $release" >&2
  exit 1
fi

echo "kaniop $release -> kanidm/server:$kanidm_version"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'kaniop_release=%s\nkanidm_version=%s\n' \
    "$release" "$kanidm_version" >> "$GITHUB_OUTPUT"
fi
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'KANIOP_RELEASE=%s\nKANIDM_VERSION=%s\n' \
    "$release" "$kanidm_version" >> "$GITHUB_ENV"
fi
