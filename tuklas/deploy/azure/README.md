# Free staging server on Azure for Students

One script creates a small Ubuntu server for public testing, set up so it stays inside the student
credit. It only creates the server; installing Tuklas on it is `chore/deploy-server-config` (see
`docs/TODO.md`). Prices and student benefits change: check the figures in the portal.

## What you get

| Piece | Choice | Cost from the credit (approx.) |
|---|---|---|
| VM | `Standard_B1s` (1 vCPU, 1 GB), Ubuntu 24.04, Southeast Asia (Singapore) | US$0 while the student free hours cover it (750 h/month in the first year), otherwise ~US$8–10/month |
| Disk | 64 GB Premium SSD (P6), the size the free-services allowance covers | US$0 in the allowance, otherwise a few dollars |
| Address | static IP + free `<name>.southeastasia.cloudapp.azure.com` | ~US$3–4/month unless covered |
| Firewall | only SSH (22), HTTP (80), HTTPS (443) | free |
| Swap | 2 GB swap file on first boot (`cloud-init.yaml`) | free |
| Auto-shutdown | every day at **11:00 PM Philippine time**, email 30 minutes before | saves the credit |
| Budget alerts | US$25 and US$50 a month, if the subscription allows budgets | free |

Azure for Students needs no credit card and has a hard spending limit at the credit: when it runs
out, Azure turns the services off instead of billing you.

## 1. Before you start (once)

1. **Activate Azure for Students** with your school email: <https://azure.microsoft.com/free/students>.
2. **Make an SSH key on your own PC**, so only you can log in to the server. In PowerShell:
   ```powershell
   ssh-keygen -t ed25519 -C "tuklas-staging"     # press Enter for the default file; a passphrase is optional
   Get-Content $HOME\.ssh\id_ed25519.pub          # the PUBLIC key: one line starting with ssh-ed25519
   ```
   Copy that one line. The private key (`id_ed25519`, no `.pub`) never leaves your PC.

## 2. Create the server

1. In the Azure portal, open **Cloud Shell** (the `>_` icon in the top bar) and pick **Bash**.
   "No storage account required" is fine.
2. Get these files into Cloud Shell, either:
   - `git clone https://github.com/Uncertaintyxq/SIA-TUKLAS.git && cd SIA-TUKLAS/tuklas/deploy/azure`
     (if the repo is private, use the next option), or
   - **Manage files → Upload** for `create-vm.sh`, `vm.sh` and `cloud-init.yaml`, all into one folder.
3. Run it with your email (it isn't stored anywhere in the repo) and the public key line:
   ```bash
   bash create-vm.sh --email you@example.com --ssh-key "ssh-ed25519 AAAA... tuklas-staging"
   ```
   Optional: `--dns-label tuklas-sia` to choose the address (it must be free in the region).

It prints the address and the SSH command when it's done (a few minutes). Keep the address: Tuklas's
`APP_URL` will use it.

## 3. Day to day

| To | Do |
|---|---|
| Start it before a test session | `bash vm.sh start` in Cloud Shell, or **Start** on the VM in the portal or the Azure phone app |
| Stop it when nobody is testing | `bash vm.sh stop`, or **Stop** in the portal. Shutting down from inside Ubuntu still bills it |
| Check it | `bash vm.sh status` |
| Change the shutdown time or skip it tonight | VM → **Auto-shutdown** in the portal (the warning email also has a postpone link) |
| See the credit left | The **Azure for Students** page in the portal (or Microsoft Azure Sponsorships) |
| Remove everything | `az group delete --name tuklas-staging` (deletes the server and its disk for good) |

## Notes

- The server starts every day stopped after 11 PM; testers will find it down until someone starts it.
- If 1 GB is too tight once Tuklas is installed, resize in the portal to `Standard_B1ms` (2 GB,
  ~US$15–18/month from the credit) while the VM is stopped.
- This is for testing with the demo accounts. Don't put real students' data on it before the Data
  Privacy Act items in `docs/TODO.md` are done, and run it with `APP_ENV=staging` (Tuklas refuses
  demo mode in production).
