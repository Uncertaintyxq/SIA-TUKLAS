#!/usr/bin/env bash
# Creates the Tuklas staging server on Azure for Students, set up so it doesn't drain the credit.
# Run it in Azure Cloud Shell (Bash), which is already signed in as you. Steps: deploy/azure/README.md
#
#   bash create-vm.sh --email you@example.com --ssh-key "ssh-ed25519 AAAA... you@pc"
#
# What it creates, and nothing else (no managed databases, App Service, load balancers or Bastion):
#   - resource group  tuklas-staging           in Southeast Asia (Singapore)
#   - VM              tuklas-vm                Ubuntu 24.04, Standard_B1s (1 vCPU, 1 GB)
#   - OS disk         64 GB Premium SSD (P6)   the size the free-services allowance covers
#   - public IP       tuklas-ip                static, with a free <label>.southeastasia.cloudapp.azure.com name
#   - firewall        tuklas-nsg               only SSH (22), HTTP (80), HTTPS (443) in
#   - auto-shutdown   every day 11:00 PM Philippine time (15:00 UTC), email 30 minutes before
#   - budget alerts   at US$25 and US$50 a month, if the subscription type allows budgets
# A swap file is made on first boot (cloud-init.yaml).

set -euo pipefail

LOCATION="southeastasia"
GROUP="tuklas-staging"
VM="tuklas-vm"
IP="tuklas-ip"
NSG="tuklas-nsg"
SIZE="Standard_B1s"
ADMIN="tuklas"
SHUTDOWN_UTC="1500"            # 11:00 PM in the Philippines (UTC+8)
EMAIL=""
SSH_KEY=""
DNS_LABEL="tuklas-$(printf '%04x%02x' "$RANDOM" "$((RANDOM % 256))")"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: bash create-vm.sh --email <address> --ssh-key <public key text or path to .pub file>
                         [--dns-label <name>] [--size <vm size>]

  --email      gets the auto-shutdown warning and budget alerts (not stored in the repo)
  --ssh-key    your PUBLIC key, made on your own PC with: ssh-keygen -t ed25519
  --dns-label  the start of the site address (default: tuklas-<random>)
  --size       Standard_B1s (default, inside the student free hours) or Standard_B1ms (2 GB, paid)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email) EMAIL="${2:-}"; shift 2 ;;
    --ssh-key) SSH_KEY="${2:-}"; shift 2 ;;
    --dns-label) DNS_LABEL="${2:-}"; shift 2 ;;
    --size) SIZE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$EMAIL" || -z "$SSH_KEY" ]]; then
  echo "Both --email and --ssh-key are required." >&2
  usage >&2
  exit 1
fi
if [[ -f "$SSH_KEY" ]]; then
  SSH_KEY="$(cat "$SSH_KEY")"
fi
if [[ "$SSH_KEY" != ssh-* ]]; then
  echo "--ssh-key must be a PUBLIC key (it starts with ssh-ed25519 or ssh-rsa). Never paste the private key." >&2
  exit 1
fi
if [[ ! "$DNS_LABEL" =~ ^[a-z][a-z0-9-]{2,61}[a-z0-9]$ ]]; then
  echo "--dns-label must be lowercase letters, numbers and dashes, 4-63 characters, starting with a letter." >&2
  exit 1
fi
if [[ ! -f "$HERE/cloud-init.yaml" ]]; then
  echo "cloud-init.yaml must be in the same folder as this script ($HERE)." >&2
  exit 1
fi

az account show --query "{subscription:name, user:user.name}" -o table
if [[ "$(az group exists --name "$GROUP")" == "true" ]]; then
  echo "The resource group '$GROUP' already exists, so the server was probably created before." >&2
  echo "Use vm.sh status, or delete the group in the portal first if you really want to start over." >&2
  exit 1
fi

echo "==> Resource group $GROUP in $LOCATION"
az group create --name "$GROUP" --location "$LOCATION" --output none

echo "==> Firewall $NSG (SSH, HTTP, HTTPS only)"
az network nsg create --resource-group "$GROUP" --name "$NSG" --output none
priority=1000
for port in 22 80 443; do
  az network nsg rule create --resource-group "$GROUP" --nsg-name "$NSG" --name "allow-$port" \
    --priority "$priority" --direction Inbound --access Allow --protocol Tcp \
    --destination-port-ranges "$port" --output none
  priority=$((priority + 10))
done

echo "==> Static IP $IP with the name $DNS_LABEL"
az network public-ip create --resource-group "$GROUP" --name "$IP" --sku Standard \
  --allocation-method Static --dns-name "$DNS_LABEL" --output none

echo "==> VM $VM ($SIZE, Ubuntu 24.04). This takes a few minutes."
az vm create --resource-group "$GROUP" --name "$VM" --location "$LOCATION" \
  --image Ubuntu2404 --size "$SIZE" \
  --admin-username "$ADMIN" --ssh-key-values "$SSH_KEY" --authentication-type ssh \
  --public-ip-address "$IP" --nsg "$NSG" \
  --storage-sku Premium_LRS --os-disk-size-gb 64 \
  --custom-data "$HERE/cloud-init.yaml" --output none

echo "==> Auto-shutdown every day at 11:00 PM Philippine time, warning to $EMAIL"
az vm auto-shutdown --resource-group "$GROUP" --name "$VM" --time "$SHUTDOWN_UTC" --email "$EMAIL" --output none

echo "==> Budget alerts at US\$25 and US\$50 a month"
SUBSCRIPTION="$(az account show --query id -o tsv)"
START="$(date -u +%Y-%m-01T00:00:00Z)"
BUDGET_BODY=$(cat <<JSON
{
  "properties": {
    "category": "Cost",
    "amount": 50,
    "timeGrain": "Monthly",
    "timePeriod": { "startDate": "$START" },
    "notifications": {
      "half": { "enabled": true, "operator": "GreaterThan", "threshold": 50, "contactEmails": ["$EMAIL"] },
      "all": { "enabled": true, "operator": "GreaterThan", "threshold": 100, "contactEmails": ["$EMAIL"] }
    }
  }
}
JSON
)
if az rest --method put \
  --url "https://management.azure.com/subscriptions/$SUBSCRIPTION/providers/Microsoft.Consumption/budgets/tuklas-staging?api-version=2023-05-01" \
  --body "$BUDGET_BODY" --output none 2>/dev/null; then
  echo "    Budget alerts created."
else
  echo "    This subscription type doesn't allow budgets (common for Azure for Students)."
  echo "    It has a hard spending limit at the credit instead: you can't be billed. Watch the credit"
  echo "    on the 'Azure for Students' page in the portal."
fi

HOST="$(az network public-ip show --resource-group "$GROUP" --name "$IP" --query dnsSettings.fqdn -o tsv)"
ADDRESS="$(az network public-ip show --resource-group "$GROUP" --name "$IP" --query ipAddress -o tsv)"
cat <<EOF

Done. Your staging server:
  Address:   $HOST  ($ADDRESS)
  SSH:       ssh $ADMIN@$HOST     (from the PC that has the private key)
  Shutdown:  every day 11:00 PM Philippine time; start it again with: bash vm.sh start

The swap file and updates finish a few minutes after first boot. Next: installing Tuklas
(chore/deploy-server-config). Keep the address above; Tuklas's APP_URL will use it.
EOF
