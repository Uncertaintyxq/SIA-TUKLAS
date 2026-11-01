#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for Tuklas: Nginx, PHP 8.4, MySQL, Node 22,
# Composer, Supervisor, the HTTPS certificate and the server's .env. Steps: deploy/README.md
#
#   sudo bash setup-server.sh --domain tuklas-1a2b3c.southeastasia.cloudapp.azure.com --email you@example.com
#
# Run it from a clone of the repo on the server, as the login user (the one deploy.sh runs as).
# Safe to run again: it keeps an existing .env and database password.

set -euo pipefail

DOMAIN=""
EMAIL=""
APP_ROOT="/var/www/tuklas"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_USER="${SUDO_USER:-}"

usage() {
  cat <<'EOF'
Usage: sudo bash setup-server.sh --domain <host name> [--email <address>]

  --domain  the site's host name (from create-vm.sh, or your own domain pointed at this server)
  --email   for the free Let's Encrypt HTTPS certificate (expiry notices). Without it the site
            stays on plain HTTP; run the script again with --email to add HTTPS later.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 || -z "$DEPLOY_USER" || "$DEPLOY_USER" == "root" ]]; then
  echo "Run it with sudo from your own login (not as root): sudo bash setup-server.sh ..." >&2
  exit 1
fi
if [[ ! "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  echo "--domain is required: the host name only, e.g. tuklas-1a2b3c.southeastasia.cloudapp.azure.com" >&2
  usage >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Packages (Nginx, PHP 8.4, MySQL, Supervisor, Certbot, Node 22)"
apt-get update -q
apt-get install -yq software-properties-common ca-certificates curl gnupg git unzip
if ! grep -rq "ondrej/php" /etc/apt/sources.list.d/ 2>/dev/null; then
  add-apt-repository -y ppa:ondrej/php
fi
if ! command -v node >/dev/null || [[ "$(node -v)" != v22.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
fi
apt-get update -q
apt-get install -yq nginx mysql-server supervisor certbot python3-certbot-nginx nodejs \
  php8.4-fpm php8.4-cli php8.4-mysql php8.4-mbstring php8.4-xml php8.4-curl php8.4-zip \
  php8.4-intl php8.4-bcmath php8.4-opcache php8.4-readline

if ! command -v composer >/dev/null; then
  echo "==> Composer (checked against its published signature)"
  expected="$(curl -fsSL https://composer.github.io/installer.sig)"
  curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
  actual="$(php -r "echo hash_file('sha384', '/tmp/composer-setup.php');")"
  if [[ "$expected" != "$actual" ]]; then
    echo "Composer installer signature mismatch; not installing." >&2
    exit 1
  fi
  php /tmp/composer-setup.php --quiet --install-dir=/usr/local/bin --filename=composer
  rm -f /tmp/composer-setup.php
fi

echo "==> PHP and MySQL settings"
install -m 644 "$HERE/php.ini" /etc/php/8.4/fpm/conf.d/99-tuklas.ini
install -m 644 "$HERE/php.ini" /etc/php/8.4/cli/conf.d/99-tuklas.ini
# Files PHP creates (logs, uploads, cache) stay writable by the deploy user's group
mkdir -p /etc/systemd/system/php8.4-fpm.service.d
printf '[Service]\nUMask=0002\n' > /etc/systemd/system/php8.4-fpm.service.d/umask.conf
install -m 644 "$HERE/mysql.cnf" /etc/mysql/mysql.conf.d/99-tuklas.cnf
systemctl daemon-reload
systemctl restart mysql php8.4-fpm

echo "==> Folders in $APP_ROOT (releases/, shared/.env, shared/storage/)"
usermod -aG www-data "$DEPLOY_USER"
mkdir -p "$APP_ROOT/releases" \
  "$APP_ROOT/shared/storage/app/private" \
  "$APP_ROOT/shared/storage/framework/cache/data" \
  "$APP_ROOT/shared/storage/framework/sessions" \
  "$APP_ROOT/shared/storage/framework/views" \
  "$APP_ROOT/shared/storage/logs"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_ROOT" "$APP_ROOT/releases" "$APP_ROOT/shared"
# Only storage/ is writable by PHP (group www-data, setgid so new files keep the group)
chown -R "$DEPLOY_USER:www-data" "$APP_ROOT/shared/storage"
find "$APP_ROOT/shared/storage" -type d -exec chmod 2775 {} +

ENV_FILE="$APP_ROOT/shared/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> Database and .env (new keys and passwords, generated here)"
  db_password="$(openssl rand -hex 24)"
  mysql <<SQL
CREATE DATABASE IF NOT EXISTS tuklas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'tuklas'@'localhost' IDENTIFIED BY '$db_password';
ALTER USER 'tuklas'@'localhost' IDENTIFIED BY '$db_password';
GRANT ALL PRIVILEGES ON tuklas.* TO 'tuklas'@'localhost';
FLUSH PRIVILEGES;
SQL
  sed -e "s|__APP_KEY__|base64:$(openssl rand -base64 32)|" \
      -e "s|__APP_URL__|http://$DOMAIN|" \
      -e "s|__SECURE__|false|" \
      -e "s|__DOMAIN__|$DOMAIN|g" \
      -e "s|__DB_PASSWORD__|$db_password|" \
      -e "s|__REVERB_APP_ID__|$((RANDOM * 100 + RANDOM % 100))|" \
      -e "s|__REVERB_APP_KEY__|$(openssl rand -hex 16)|" \
      -e "s|__REVERB_APP_SECRET__|$(openssl rand -hex 32)|" \
      "$HERE/../.env.production.example" > "$ENV_FILE"
else
  echo "==> Keeping the existing $ENV_FILE"
fi
chown "$DEPLOY_USER:www-data" "$ENV_FILE"
chmod 640 "$ENV_FILE"

echo "==> Nginx site for $DOMAIN"
if [[ ! -f /etc/nginx/sites-available/tuklas ]]; then
  sed "s|__DOMAIN__|$DOMAIN|g" "$HERE/nginx.conf" > /etc/nginx/sites-available/tuklas
fi
ln -sfn /etc/nginx/sites-available/tuklas /etc/nginx/sites-enabled/tuklas
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Supervisor (queue worker and Reverb; they start working after the first deploy)"
install -m 644 "$HERE/supervisor.conf" /etc/supervisor/conf.d/tuklas.conf
supervisorctl reread >/dev/null
supervisorctl update >/dev/null || true

# deploy.sh needs these without a password prompt (Azure's login user already has full sudo)
# Checked before it's installed: a broken file in sudoers.d would lock everyone out of sudo
sudoers_tmp="$(mktemp)"
cat > "$sudoers_tmp" <<SUDO
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload php8.4-fpm, /usr/bin/supervisorctl restart tuklas\:*
SUDO
if visudo -cf "$sudoers_tmp" >/dev/null; then
  install -m 440 "$sudoers_tmp" /etc/sudoers.d/tuklas-deploy
fi
rm -f "$sudoers_tmp"

if [[ -n "$EMAIL" ]]; then
  echo "==> HTTPS certificate from Let's Encrypt for $DOMAIN"
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
    sed -i -e "s|^APP_URL=http://|APP_URL=https://|" -e "s|^SESSION_SECURE_COOKIE=false|SESSION_SECURE_COOKIE=true|" "$ENV_FILE"
    echo "    HTTPS is on, and HTTP redirects to it. Certbot renews it automatically."
  else
    echo "    The certificate failed (is port 80 open, and does $DOMAIN point at this server?)."
    echo "    The site stays on HTTP; run this script again with --email to retry."
  fi
fi

cat <<EOF

Server ready. Next, as $DEPLOY_USER (log out and back in first, so the www-data group applies):
  bash $HERE/deploy.sh --seed      # first time: also loads the demo data
Then open $(grep '^APP_URL=' "$ENV_FILE" | cut -d= -f2)
EOF
