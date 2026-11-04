# Data protection paperwork (TBD-6)

What Tuklas needs under the Data Privacy Act of 2012 (RA 10173) before real students' data goes in,
and drafts of the papers. **These are drafts written by the team, not legal advice.** Each school's
Data Protection Officer (or legal office) should review them before anyone signs.

## Who is who

| Role under the Act | Who | Why |
|---|---|---|
| Personal information controller (PIC) | **Each school** | It decides that its students and educators use Tuklas, and why (SRS LEG-1). |
| Personal information processor (PIP) | **The operator**: whoever runs the site. Suggested: Sir Bamie Bucog, the client, so it doesn't end when the team graduates. | It stores and processes the data on the schools' behalf. |
| Sub-processors | Microsoft Azure (the server, Japan East), Brevo (sends email), Cloudflare (DNS, forwards admin mail), Google Drive (encrypted off-server backups) | Each one handles some of the data for the operator. |
| Data Protection Officer (DPO) | One per school (most schools already have one), plus a **compliance officer for privacy** for the operator | The Act requires a DPO for every PIC and PIP. |

## The papers

| Paper | Who signs | Draft |
|---|---|---|
| Data processing agreement, one per school | The school (as PIC) and the operator (as PIP) | [data-processing-agreement.md](data-processing-agreement.md) |
| DPO designation | The operator names its compliance officer for privacy; each school confirms its DPO | [dpo-designation.md](dpo-designation.md) |
| Breach response plan | The operator, shared with each school's DPO | [breach-response-plan.md](breach-response-plan.md) |
| Privacy notice (TBD-5) | Approved by each school's DPO | The draft in `tuklas/client/src/components/account/PrivacyNotice.tsx`; add the DPO contact and the points below |

## Things to settle with the schools

1. **Most senior high school students are minors.** Tuklas has no age check, and a student under
   18 can't give valid consent by themselves. Suggested: each school covers Tuklas in the consent
   its parents or guardians already sign at enrolment, or in a research consent form, and the data
   processing agreement says so (clause 4.3). The app could also ask "I am 18 or older, or my parent
   or guardian has agreed" at sign-up. That's a small change and isn't built yet.
2. **Education records are sensitive personal information.** Section 3(l)(2) of the Act counts
   information about a person's education as sensitive. Grades aren't stored, but reviews, revision
   requests and adviser feedback on a student's research are about their education, so handle them
   as sensitive.
3. **NPC registration.** NPC Circular 2022-04 requires registration of the DPO and the data
   processing systems when an organisation processes sensitive personal information of **1,000 or
   more people**, employs 250 or more, or uses automated decision-making or profiling (Tuklas does
   none). Most schools are already registered; each adds Tuklas to its registered data processing
   systems once its users near 1,000. The operator registers once all the schools together pass
   1,000. Below that, file a sworn declaration of exemption, or register voluntarily.
4. **The data leaves the Philippines.** The server is in Japan (Azure Japan East, SRS LEG-4).
   That's allowed, but the school stays accountable (Section 21), so the agreement names the region
   and the safeguards, and the privacy notice says where the data is kept.
5. **Retention.** As the SRS states: personal data is kept while the account exists, and erased when
   the account is deleted (works keep a "Former member" author). Logs are kept 14 days and backups
   30 days (RET-1, RET-2). Each school decides what happens to its people's accounts when they
   graduate.

## Order of work

1. The client agrees to be the operator (or names who will).
2. The operator names its compliance officer for privacy ([dpo-designation.md](dpo-designation.md)).
3. Send each school the draft agreement, the breach plan and the privacy notice. Their DPO reviews
   them, and fills in the school's own details and any changes.
4. Sign one agreement per school. Keep the signed copies with the client, not in git.
5. Put the DPO contact in the privacy notice (runbook step 8), then tick the Data Privacy Act boxes
   in [DEPLOYMENT.md](../DEPLOYMENT.md#data-privacy-act-ra-10173).
