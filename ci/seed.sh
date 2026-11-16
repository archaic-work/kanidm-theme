#!/usr/bin/env bash
set -euo pipefail
: "${KANIDM_VERSION:?Missing KANIDM_VERSION}"

container="kanidm-theme-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
volume="$container-data"
image="docker.io/kanidm/tools:${KANIDM_VERSION}"
cache_dir="${RUNNER_TEMP:-/tmp}/kanidm-theme-cache"
mkdir -p "$cache_dir"
chmod 700 "$cache_dir"
printf '{}\n' > "$cache_dir/kanidm_tokens"
chmod 600 "$cache_dir/kanidm_tokens"
docker pull "$image"

# The client runs on the isolated CI runner, never against a real IdP.
cli() {
  docker run --rm --network host \
    --mount "type=volume,source=$volume,target=/data,readonly" \
    --mount "type=bind,source=$cache_dir/kanidm_tokens,target=/root/.cache/kanidm_tokens" \
    -e KANIDM_URL=https://localhost:8443 \
    -e KANIDM_CA_PATH=/data/ca.pem \
    "$image" /sbin/kanidm "$@"
}

recover_password() {
  local output password
  output="$(docker exec "$container" /sbin/kanidmd scripting recover-account "$1" 2>&1)"
  password="$(printf '%s\n' "$output" |
    grep -E '^\{.*"' | tail -n 1 |
    jq -er '.output // .password // empty')"
  [[ -n "$password" ]] || { echo "Failed to recover fixture account" >&2; exit 1; }
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    printf '::add-mask::%s\n' "$password" >&2
  fi
  printf '%s' "$password"
}

admin_password="$(recover_password idm_admin)"
admin="idm_admin@localhost"
cli login -D "$admin" --password "$admin_password"

# Match the site identity shown in the screenshots. This changes only the
# disposable domain's display name, not its DNS name or authentication origin.
cli system domain set-displayname "archaic.work" -D "$admin"

cli group create theme_apps -D "$admin"
cli person create theme_user "Theme Demo User" -D "$admin"
cli person update theme_user --mail theme.user@example.test -D "$admin"
cli group add-members theme_apps theme_user -D "$admin"
cli group add-members idm_ui_enable_experimental_features "$admin" -D "$admin"

cli system oauth2 create theme_demo "Theme Demo Application" https://example.com -D "$admin"
cli system oauth2 update-scope-map theme_demo theme_apps openid -D "$admin"

user_password="$(recover_password theme_user)"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    printf 'KANIDM_THEME_USER_PASSWORD=%s\n' "$user_password"
    printf 'KANIDM_THEME_ADMIN_PASSWORD=%s\n' "$admin_password"
  } >> "$GITHUB_ENV"
else
  mkdir -p .local
  chmod 700 .local
  printf 'export KANIDM_THEME_USER_PASSWORD=%q\nexport KANIDM_THEME_ADMIN_PASSWORD=%q\n' \
    "$user_password" "$admin_password" > .local/credentials.env
  chmod 600 .local/credentials.env
  echo "For local Playwright: source .local/credentials.env"
fi

echo "Seeded theme_user, theme_apps, one OAuth2 application, and the admin fixture"
