#!/usr/bin/env bash
# Restores a Tuklas backup made by backup.sh: the database and the uploads, on this server.
# Everything currently in the database is replaced. Steps: deploy/README.md ("Restore a backup").
#
#   bash restore.sh /var/backups/tuklas/tuklas-20261102-143000.tar.age --identity ~/backup-key.txt
#
#   --identity  the age PRIVATE key file (from the password manager). Delete it from the server afterwards.
#   --yes       don't ask for confirmation (for the CI restore test)

set -euo pipefail
umask 077

APP_ROOT="${APP_ROOT:-/var/www/tuklas}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/.env}"
UPLOADS="${UPLOADS:-$APP_ROOT/shared/storage/app/private}"
APP="${APP:-$APP_ROOT/current}"
FILE=""
IDENTITY=""
YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --identity) IDENTITY="${2:-}"; shift 2 ;;
    --yes) YES=true; shift ;;
    -h|--help) sed -n 2,9p "$0"; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) FILE="$1"; shift ;;
  esac
done

[[ -f "$FILE" ]] || { echo "Give the backup file to restore (a .tar.age from backup.sh)." >&2; exit 1; }
[[ -f "$IDENTITY" ]] || { echo "Give the private key file with --identity (from the password manager)." >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Can't read $ENV_FILE." >&2; exit 1; }

env_value() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}

WORK="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK"
  # Never leave the site in maintenance mode by accident
  if [[ "${DOWN:-false}" == true ]]; then php "$APP/artisan" up >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

echo "==> Decrypting and checking $(basename "$FILE")"
age -d -i "$IDENTITY" "$FILE" | tar -C "$WORK" -xf -
(cd "$WORK" && sed -n '/  /p' manifest.txt | sha256sum -c --quiet -) || { echo "The backup's checksums don't match: not restoring." >&2; exit 1; }
grep -E '^(created_utc|database|release)=' "$WORK/manifest.txt" | sed 's/^/    /'

DATABASE="$(env_value DB_DATABASE)"
if [[ "$YES" != true ]]; then
  echo
  echo "This replaces EVERYTHING in the database \"$DATABASE\" and the uploads on this server"
  echo "with the backup above. Anything written since that backup is lost."
  read -r -p "Type the database name ($DATABASE) to go ahead: " answer
  [[ "$answer" == "$DATABASE" ]] || { echo "Not restoring."; exit 1; }
fi

cat > "$WORK/my.cnf" <<CNF
[client]
host=$(env_value DB_HOST)
port=$(env_value DB_PORT)
user=$(env_value DB_USERNAME)
password=$(env_value DB_PASSWORD)
CNF

echo "==> Maintenance mode on"
php "$APP/artisan" down --retry=60 >/dev/null
DOWN=true

echo "==> Database"
# The dump drops and recreates each table it holds; tables added after the backup are dropped first
# so the schema matches the backup exactly (the next deploy migrates it forward again).
mysql --defaults-extra-file="$WORK/my.cnf" -N -e "SELECT CONCAT('DROP TABLE IF EXISTS \`', table_name, '\`;') FROM information_schema.tables WHERE table_schema = '$DATABASE'" \
  | { echo 'SET FOREIGN_KEY_CHECKS=0;'; cat; echo 'SET FOREIGN_KEY_CHECKS=1;'; } \
  | mysql --defaults-extra-file="$WORK/my.cnf" "$DATABASE"
gunzip -c "$WORK/database.sql.gz" | mysql --defaults-extra-file="$WORK/my.cnf" "$DATABASE"

echo "==> Uploads"
# Group-writable like everything else PHP writes (umask 002), so PHP can read and replace them
(
  umask 002
  mkdir -p "$UPLOADS"
  find "$UPLOADS" -mindepth 1 -delete
  tar -C "$UPLOADS" --no-same-owner -xzf "$WORK/uploads.tar.gz"
)

echo "==> Clearing caches, maintenance mode off"
php "$APP/artisan" cache:clear >/dev/null
php "$APP/artisan" up >/dev/null
DOWN=false

echo "Restored $(basename "$FILE"). If the backup is older than the code, run deploy.sh to migrate it forward."
