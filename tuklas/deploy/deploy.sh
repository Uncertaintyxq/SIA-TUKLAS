#!/usr/bin/env bash
# Puts a new release of Tuklas live on a server prepared by setup-server.sh. Run it as the login
# user (not root). Each release gets its own folder and a symlink switches to it, so a failed build
# never takes the site down.
#
#   bash deploy.sh             # deploy main
#   bash deploy.sh --seed      # first deploy: also load the demo data (staging only)
#   bash deploy.sh --ref v1.0  # deploy a tag or another branch

set -euo pipefail
# Files made here (logs, caches) stay writable by PHP, which shares the www-data group
umask 002

APP_ROOT="/var/www/tuklas"
REPO="${TUKLAS_REPO:-https://github.com/Uncertaintyxq/SIA-TUKLAS.git}"
REF="main"
SEED=false
KEEP=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="${2:-}"; shift 2 ;;
    --seed) SEED=true; shift ;;
    -h|--help) sed -n 2,10p "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ $EUID -eq 0 ]]; then
  echo "Run deploy.sh as your login user, not with sudo." >&2
  exit 1
fi
if [[ ! -f "$APP_ROOT/shared/.env" ]]; then
  echo "No $APP_ROOT/shared/.env: run setup-server.sh first." >&2
  exit 1
fi

RELEASE="$APP_ROOT/releases/$(date +%Y%m%d-%H%M%S)"
APP="$RELEASE/tuklas"
fail() {
  echo "Deploy failed; the site still runs the previous release. Removing $RELEASE." >&2
  rm -rf "$RELEASE"
}
trap fail ERR

echo "==> Getting $REF"
git clone --quiet --depth 1 --branch "$REF" "$REPO" "$RELEASE"
echo "    $(git -C "$RELEASE" log -1 --format='%h %s')"

echo "==> Linking the shared .env and storage/"
ln -s "$APP_ROOT/shared/.env" "$APP/.env"
rm -rf "$APP/storage"
ln -s "$APP_ROOT/shared/storage" "$APP/storage"

cd "$APP"
echo "==> PHP packages"
composer install --no-dev --optimize-autoloader --no-interaction --no-progress --quiet

echo "==> Building the React app (a minute or two on a small server)"
npm ci --no-audit --no-fund --loglevel=error
npm run build --silent
rm -rf node_modules client/node_modules

if [[ "$SEED" == true ]] && grep -q '^APP_ENV=production' .env; then
  echo "--seed loads demo accounts; it's refused when APP_ENV=production." >&2
  exit 1
fi
# A migration can't be undone by switching the symlink back, so take a backup first (backup.sh).
# Skipped until backups are set up (BACKUP_AGE_RECIPIENT in .env), and when nothing is pending.
if grep -q '^BACKUP_AGE_RECIPIENT=age1' .env && php artisan migrate:status --pending 2>/dev/null | grep -q 'Pending'; then
  echo "==> Backup before migrating"
  bash "$APP/deploy/backup.sh" --label pre-migrate
fi

echo "==> Database migrations"
php artisan migrate --force $([[ "$SEED" == true ]] && echo --seed)

echo "==> Caching config, routes and events"
php artisan config:cache --quiet
php artisan route:cache --quiet
php artisan event:cache --quiet

echo "==> Switching to the new release"
ln -sfn "$APP" "$APP_ROOT/current.new"
mv -T "$APP_ROOT/current.new" "$APP_ROOT/current"
trap - ERR
sudo systemctl reload php8.4-fpm
sudo supervisorctl restart 'tuklas:*' >/dev/null

echo "==> Checking the site answers"
url="$(grep '^APP_URL=' .env | cut -d= -f2)"
sleep 2
if curl -fsS -o /dev/null "$url/up"; then
  echo "    $url/up is OK"
else
  echo "    $url/up did not answer. Logs: $APP_ROOT/shared/storage/logs/ and /var/log/nginx/error.log" >&2
fi

echo "==> Keeping the last $KEEP releases"
ls -1dt "$APP_ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "Done: $(git -C "$RELEASE" log -1 --format='%h %s')"
