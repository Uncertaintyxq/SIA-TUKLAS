#!/usr/bin/env bash
# Start, stop or check the Tuklas staging VM from Azure Cloud Shell.
#
#   bash vm.sh start     # before a test session
#   bash vm.sh stop      # deallocates: compute stops costing (only the disk and IP still count)
#   bash vm.sh status    # running / deallocated, address, next auto-shutdown
#
# Shutting the server down from inside Ubuntu does NOT deallocate it and keeps billing; use this
# script, the portal's Stop button, or the daily 11 PM auto-shutdown.

set -euo pipefail

GROUP="tuklas-staging"
VM="tuklas-vm"
IP="tuklas-ip"

case "${1:-status}" in
  start)
    az vm start --resource-group "$GROUP" --name "$VM" --output none
    echo "Started. It may take a minute before the site answers."
    ;;
  stop)
    az vm deallocate --resource-group "$GROUP" --name "$VM" --output none
    echo "Stopped (deallocated)."
    ;;
  status)
    az vm get-instance-view --resource-group "$GROUP" --name "$VM" \
      --query "instanceView.statuses[?starts_with(code, 'PowerState/')].displayStatus | [0]" -o tsv
    az network public-ip show --resource-group "$GROUP" --name "$IP" --query "{address: dnsSettings.fqdn, ip: ipAddress}" -o table
    az resource show --resource-group "$GROUP" --resource-type Microsoft.DevTestLab/schedules \
      --name "shutdown-computevm-$VM" --query "{autoShutdownUtc: properties.dailyRecurrence.time, status: properties.status}" -o table \
      2>/dev/null || echo "No auto-shutdown schedule found."
    ;;
  *)
    echo "Usage: bash vm.sh start|stop|status" >&2
    exit 1
    ;;
esac
