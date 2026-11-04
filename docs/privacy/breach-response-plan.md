# Breach response plan

> **Draft, 2026-11-04**, for review by the operator's compliance officer and each school's Data
> Protection Officer. It follows NPC Circular 16-03 (Personal Data Breach Management). Not legal
> advice.

A personal data breach is any breach of security that leads to personal data being destroyed, lost,
changed, disclosed or reached without authorisation. Examples for Tuklas: someone signs in to an
admin's account, a backup or the `.env` leaks, a private draft or message becomes public through a
bug, the server is broken into, or a laptop with a database copy is lost.

## The response team

| Role | Who | Does |
|---|---|---|
| Lead | [the operator's compliance officer for privacy] | Decides if it's a breach, who is told, and when it's closed |
| Technical | [a developer with server access] and [a second one] | Contains it, investigates, restores |
| Each school's DPO | Named in that school's data processing agreement | Notifies the NPC and the school's people |

Contacts (phone and email) for everyone above: [kept in the team's password manager, and printed
here when the plan is signed].

## The clock

- **Hour 0:** the moment anyone on the team learns of, or reasonably believes there is, a breach.
- **Within 24 hours:** the operator tells each affected school's DPO (data processing agreement,
  clause 3.6).
- **Within 72 hours:** the school notifies the **National Privacy Commission** and the **people
  affected**, when all of these are true:
  1. the data involved is sensitive personal information (including education records, such as
     works under review and feedback), or could be used for identity fraud (such as passwords or
     sign-in secrets);
  2. it was, or is reasonably believed to have been, obtained by someone without authorisation;
  3. it could cause the people affected serious harm.

  Don't wait for the investigation to finish to notify. Send what is known, and follow up.
- **Every year:** a summary of all security incidents and breaches for the NPC's annual report.

## Steps

### 1. Report it (anyone)
Tell the lead at once, by phone, and in writing with what you saw and when. Don't delete anything
and don't try to investigate alone.

### 2. Contain it (technical, first hours)
Use what fits:
- Put the site in maintenance mode: `php artisan down` in `/var/www/tuklas/current`.
- Lock a hijacked account: delete or deactivate it from the admin page, or reset its password and
  two-factor sign-in.
- Sign everyone out: empty the `sessions` table (sessions are kept in the database).
- If a secret leaked, replace it: database password, mail (Brevo SMTP key), Reverb keys, VAPID keys,
  backup recipient. For `APP_KEY`, put the old key in `APP_PREVIOUS_KEYS` first, or encrypted
  messages and two-factor secrets can't be read any more.
- Remove a wrongly public work or file from the admin page.
- If the server itself is compromised, take a disk snapshot for the investigation, then rebuild from
  the repo and the last good backup (`tuklas/deploy/README.md`, "Backups").

### 3. Assess it (lead and technical, by hour 24)
Write down:
- what happened, when it started and when it was found;
- which schools and how many people are affected;
- which data (use the table in the data processing agreement, clause 2);
- whether it's sensitive personal information, whether someone without authorisation got it, and
  the likely harm;
- what has been done so far.

The audit log (admin page, and the `audit_logs` table), Nginx logs (kept 14 days) and application
logs help here. Copy them out before they expire.

### 4. Notify (each school's DPO, by hour 72)
The notice to the NPC (through its online breach notification system) and to the people affected
says:
- what happened, and when;
- what personal data was involved;
- what has been done, and what will be done, to fix it and limit the harm;
- what people should do themselves (change their password, watch for phishing);
- who to contact: the school's DPO.

Tell people directly, by email from the site or the school, not only with a public post.

### 5. Recover and learn (within 2 weeks)
- Fix the cause, and add a test or a check so it doesn't come back.
- Bring the site back up: `php artisan up`.
- Write a short report: timeline, cause, impact, fixes, and what changes in this plan. Keep it with
  the client's records, not in git if it holds personal data.
- Update the yearly incident summary.

## Not a breach, but log it

Failed sign-in attempts, blocked attacks and bugs that exposed nothing are security incidents. Note
them (date, what, outcome) for the yearly summary.

Review this plan once a year, and after every breach.
