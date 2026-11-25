#!/usr/bin/env bash
# Deploy a tagged release of FoodChainIQ next to the latest version.
#
#   deploy/release.sh v0.1.0           build + start v0.1.0, serve it at /v010/
#   deploy/release.sh --remove v0.1.0  stop it and remove its route (keeps its data)
#   deploy/release.sh --list           show deployed releases
#
# Each release runs as its own compose project (foodchainiq-v010) with its own
# database and file storage, on a local port (127.0.0.1:9010, 9011, …) that
# only Caddy can reach. Caddy maps https://<domain>/v010/ to it through a
# snippet in $CADDY_SNIPPETS (see documentation/deployment-digitalocean.md).
#
# Run on the droplet from the main checkout, as the deploy user.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_TOOLS="$APP_DIR/deploy/release"
RELEASES_DIR="${RELEASES_DIR:-$HOME/releases}"
CADDY_SNIPPETS="${CADDY_SNIPPETS:-/etc/caddy/releases}"
FIRST_PORT=9010

die() { echo "error: $*" >&2; exit 1; }
say() { echo "[release] $*"; }

slug_of() { local v="${1#v}"; echo "v${v//./}"; }            # v0.1.0 -> v010
check_tag() { [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "tag must look like v1.2.3, got '$1'"; }

reload_caddy() {
  if sudo -n systemctl reload caddy 2>/dev/null; then
    say "Caddy reloaded"
  else
    say "WARNING: could not reload Caddy (no sudo rule?). Run as root: systemctl reload caddy"
  fi
}

port_for() {  # stable port per slug, recorded in $RELEASES_DIR/ports
  local slug="$1" file="$RELEASES_DIR/ports" port
  touch "$file"
  port="$(awk -v s="$slug" '$1 == s { print $2 }' "$file")"
  if [ -z "$port" ]; then
    port=$FIRST_PORT
    while awk -v p="$port" '$2 == p { found = 1 } END { exit !found }' "$file"; do
      port=$((port + 1))
    done
    echo "$slug $port" >>"$file"
  fi
  echo "$port"
}

compose() {  # compose for one release; needs TAG, SLUG, PORT, SRC, ENV_FILE
  RELEASE_SRC="$SRC" RELEASE_TOOLS="$RELEASE_TOOLS" RELEASE_TAG="$TAG" \
    BASE_PATH="/$SLUG/" APP_PORT="127.0.0.1:$PORT" \
    docker compose -p "foodchainiq-$SLUG" -f "$RELEASE_TOOLS/docker-compose.yml" --env-file "$ENV_FILE" "$@"
}

case "${1:-}" in
  --list)
    [ -f "$RELEASES_DIR/ports" ] || { echo "no releases deployed"; exit 0; }
    while read -r slug port; do
      state="$(docker ps --filter "label=com.docker.compose.project=foodchainiq-$slug" --format '{{.Names}}: {{.Status}}' | tr '\n' ' ')"
      echo "/$slug/  -> 127.0.0.1:$port  ${state:-stopped}"
    done <"$RELEASES_DIR/ports"
    exit 0
    ;;
  --remove)
    TAG="${2:-}"; check_tag "$TAG"
    SLUG="$(slug_of "$TAG")"; PORT="$(port_for "$SLUG")"
    SRC="$RELEASES_DIR/$TAG"; ENV_FILE="$RELEASES_DIR/$SLUG.env"
    [ -d "$SRC" ] && [ -f "$ENV_FILE" ] && compose down --remove-orphans
    if [ -f "$CADDY_SNIPPETS/$SLUG.caddy" ]; then
      rm -f -- "$CADDY_SNIPPETS/$SLUG.caddy"
      reload_caddy
    fi
    [ -d "$SRC" ] && git -C "$APP_DIR" worktree remove --force "$SRC"
    say "removed /$SLUG/ (database and files kept in volumes foodchainiq-${SLUG}_db-data and _storage)"
    exit 0
    ;;
  ""|-h|--help)
    sed -n '2,15p' "$0"; exit 0
    ;;
esac

TAG="$1"; check_tag "$TAG"
SLUG="$(slug_of "$TAG")"
mkdir -p "$RELEASES_DIR"
PORT="$(port_for "$SLUG")"
SRC="$RELEASES_DIR/$TAG"
ENV_FILE="$RELEASES_DIR/$SLUG.env"
say "$TAG -> /$SLUG/ on 127.0.0.1:$PORT"

# 1. Source: a worktree of the main checkout at the tag.
git -C "$APP_DIR" fetch --quiet --force origin "refs/tags/$TAG:refs/tags/$TAG" || die "tag $TAG not found on origin"
if [ -d "$SRC" ]; then
  git -C "$SRC" checkout --quiet --force --detach "$TAG"
else
  git -C "$APP_DIR" worktree add --quiet --force --detach "$SRC" "$TAG"
fi
say "source: $SRC ($(git -C "$SRC" rev-parse --short HEAD))"

# 2. Settings: on first deploy, copy the live .env, with its own JWT secret
#    (sessions don't cross versions). Edit $ENV_FILE afterwards if needed.
if [ ! -f "$ENV_FILE" ]; then
  [ -f "$APP_DIR/.env" ] || die "no $APP_DIR/.env to copy settings from"
  grep -vE '^(APP_PORT|DB_PORT|JWT_SECRET)=' "$APP_DIR/.env" >"$ENV_FILE" || true
  echo "JWT_SECRET=$(openssl rand -hex 32)" >>"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  say "created $ENV_FILE from .env"
fi

# 3. Build and start.
compose up -d --build --remove-orphans

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 5
done
if [ -z "${HEALTHY:-}" ]; then
  compose ps
  compose logs --tail=80 backend web
  die "$TAG did not become healthy"
fi
say "healthy"

# 4. Route https://<domain>/$SLUG/ to it. The app sets its sign-in cookie for
#    /api/...; under the prefix the browser must see /$SLUG/api/... instead.
if [ -d "$CADDY_SNIPPETS" ] && [ -w "$CADDY_SNIPPETS" ]; then
  cat >"$CADDY_SNIPPETS/$SLUG.caddy" <<EOF
# FoodChainIQ $TAG, managed by deploy/release.sh
redir /$SLUG /$SLUG/ 308
handle_path /$SLUG/* {
	reverse_proxy 127.0.0.1:$PORT {
		header_down Set-Cookie "Path=/api/" "Path=/$SLUG/api/"
	}
}
EOF
  reload_caddy
else
  say "WARNING: $CADDY_SNIPPETS is missing or not writable; route /$SLUG/ not configured (see the deployment guide)"
fi

docker image prune -f >/dev/null
say "done: $TAG is live at /$SLUG/"
