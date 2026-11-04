# 6. Other Requirements

## Other Requirements

**Database requirements**

- **DB-1.** The database shall be MySQL 8.4 LTS, with the utf8mb4 character set and the utf8mb4_unicode_ci collation, so that text in any language, including Filipino and Hiligaynon, and emoji, is stored correctly.
- **DB-2.** The structure of the database shall change only through migrations kept in the source code. A migration that has been released shall never be edited; a change shall always be a new migration. Release 1.0 has 27 migrations.
- **DB-3.** Tables and columns shall be named in snake_case; the API shall present them in camelCase (Section 3.3). Relations shall be enforced by foreign keys.
- **DB-4.** The columns listed in SEC-9 shall hold encrypted text only.
- **DB-5.** The application shall reach the database as a user with rights on the Tuklas database only, from the server itself only. The database shall not listen on any outside network address.
- **DB-6.** A deleted account shall keep its row, anonymised as "Former member", so that the records of others that refer to it stay whole (REQ-ACC-11).
- **DB-7.** The main records are people and their profiles; schools and departments; works with their versions, reviews, revision items, comments, reactions and defense stages; publications; research groups with members, files, deadlines and deliverables; conversations and messages; announcements; events, ads and opportunities; notifications; reports; and the audit log. Appendix B shows how they relate.

**Data retention**

- **RET-1.** Personal data shall be kept while the account exists, and erased when it is deleted, except what REQ-ACC-11 keeps under "Former member".
- **RET-2.** Application logs shall be kept for 14 days, and backups for 30 days (SAFE-1).
- **RET-3.** To count each reader once a day (REQ-DISC-6), the system shall keep only a keyed one-way hash of the day and the reader, never the address or browser itself, and shall delete it the next day.

**Internationalization**

- **I18N-1.** The user interface shall be in English. Members may write their works, comments and messages in any language.
- **I18N-2.** Dates and times shall be stored in Coordinated Universal Time (UTC) and shown in the time zone of the member's device. Scheduled work for people, such as the weekly digest, shall follow Philippine time (Asia/Manila).
- **I18N-3.** Release 1.0 does not translate the interface into other languages.

**Legal requirements**

- **LEG-1, Data Privacy Act of 2012 (RA 10173).** Each school is the personal information controller for its own people, and whoever runs the site is their personal information processor. Before a school's real data goes in, the school shall name a Data Protection Officer, and sign a data processing agreement with the site's operator (TBD-6).
- **LEG-2, National Privacy Commission.** The university shall check whether Tuklas must be registered with the National Privacy Commission, and the operators shall have a breach plan: who decides, and how the Commission and the people affected are told within 72 hours of learning of a breach (TBD-6).
- **LEG-3, privacy notice.** The approved privacy notice shall be shown at sign-up and available to everyone at /privacy, with the Data Protection Officer's contact details (TBD-5). Members' rights under the Act are met by SEC-13 and SEC-14.
- **LEG-4, data outside the Philippines.** If the server or its backups are hosted outside the Philippines, the hosting region and provider shall be agreed with the university, with the safeguards the Act requires. Release 1.0's server is in Japan (Section 2.4), so this applies until the production host is chosen (TBD-1).
- **LEG-5, cookies.** Tuklas shall set only the cookies it needs to work: the session and its CSRF token. It shall not use advertising or tracking cookies.
- **LEG-6, authors' rights.** Tuklas displays works and publications that their authors submit; the terms of use, including who keeps the rights to uploaded work and how it may be reused, are TBD-9. Release 1.0 offers no licence or embargo options for works.
- **LEG-7, academic integrity.** Members shall be able to report plagiarism (REQ-MOD-1), and Admins shall be able to remove a work found to be plagiarised (REQ-MOD-4).

**Reuse**

- **REU-1.** Tuklas reuses open-source software, chiefly Laravel and React (Section 3.3), and adds no paid services.
- **REU-2.** The server setup, release, backup and restore scripts in the repository (tuklas/deploy/) shall work for any new server, so that staging, production or a later host can be set up the same way.
- **REU-3.** Several schools share one site (decision record 0002, Reference 8), so a new school is added with its name, email domains and first Admin, without new software.
