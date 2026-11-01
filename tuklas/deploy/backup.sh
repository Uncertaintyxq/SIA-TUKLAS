#!/usr/bin/env bash
# Backs up Tuklas: the MySQL database and the uploads (storage/app/private), in one file encrypted
# with age. The server only holds the PUBLIC key, so it can make backups but can't read them; the
# private key lives in the team's password manager. Steps and restore: deploy/README.md.
#
#   bash backup.sh                 # what cron runs nightly (setup-server.sh)
#   bash backup.sh --label pre-migrate
#
# Settings come from the server's .env:
#   BACKUP_AGE_RECIPIENT   the age public key (age1…); required
#   BACKUP_RCLONE_REMOTE   optional rclone destination for an off-server copy, e.g. gdrive:tuklas-backups
# Backups older than BACKUP_KEEP_DAYS (default 30) are deleted, locally and on the remote.

set -euo pipefail
umask 077

APP_ROOT="${APP_ROOT:-/var/www/tuklas}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/.env}"
UPLOADS="${UPLOADS:-$APP_ROOT/shared/storage/app/private}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tuklas}"
LABEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --label) LABEL="-${2:-}"; shift 2 ;;
    -h|--help) sed -n 2,13p "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# A value from .env, without surrounding quotes (the file is never sourced: it isn't shell)
env_value() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}

[[ -r "$ENV_FILE" ]] || { echo "Can't read $ENV_FILE." >&2; exit 1; }
RECIPIENT="$(env_value BACKUP_AGE_RECIPIENT)"
REMOTE="$(env_value BACKUP_RCLONE_REMOTE)"
KEEP_DAYS="$(env_value BACKUP_KEEP_DAYS)"; KEEP_DAYS="${KEEP_DAYS:-30}"
if [[ "$RECIPIENT" != age1* ]]; then
  echo "Set BACKUP_AGE_RECIPIENT in $ENV_FILE to the backup public key (age1…); see deploy/README.md." >&2
  exit 1
fi
command -v age >/dev/null || { echo "age isn't installed (sudo apt install age)." >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The password goes in a private options file, never on the command line (where `ps` shows it)
cat > "$WORK/my.cnf" <<CNF
[client]
host=$(env_value DB_HOST)
port=$(env_value DB_PORT)
user=$(env_value DB_USERNAME)
password=$(env_value DB_PASSWORD)
CNF
DATABASE="$(env_value DB_DATABASE)"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
NAME="tuklas-${STAMP}${LABEL}"
echo "==> Database $DATABASE"
mysqldump --defaults-extra-file="$WORK/my.cnf" --single-transaction --quick --no-tablespaces \
  --set-gtid-purged=OFF --default-character-set=utf8mb4 "$DATABASE" | gzip -9 > "$WORK/database.sql.gz"

echo "==> Uploads"
if [[ -d "$UPLOADS" ]]; then
  tar -C "$UPLOADS" -czf "$WORK/uploads.tar.gz" .
else
  tar -czf "$WORK/uploads.tar.gz" -T /dev/null
fi

release="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
{
  echo "created_utc=$STAMP"
  echo "database=$DATABASE"
  echo "release=$(git -C "$release/.." rev-parse --short HEAD 2>/dev/null || echo unknown)"
  (cd "$WORK" && sha256sum database.sql.gz uploads.tar.gz)
} > "$WORK/manifest.txt"

echo "==> Encrypting"
tar -C "$WORK" -cf - manifest.txt database.sql.gz uploads.tar.gz | age -r "$RECIPIENT" -o "$BACKUP_DIR/$NAME.tar.age"
echo "    $BACKUP_DIR/$NAME.tar.age ($(du -h "$BACKUP_DIR/$NAME.tar.age" | cut -f1))"

if [[ -n "$REMOTE" ]]; then
  echo "==> Off-server copy to $REMOTE"
  rclone copy "$BACKUP_DIR/$NAME.tar.age" "$REMOTE"
  rclone delete --min-age "${KEEP_DAYS}d" "$REMOTE" || echo "    Couldn't prune old remote backups; check rclone." >&2
else
  echo "    No BACKUP_RCLONE_REMOTE set: this backup stays on the server only (lost with the server)."
fi

find "$BACKUP_DIR" -name 'tuklas-*.tar.age' -mtime +"$KEEP_DAYS" -delete
echo "Done: $NAME"
