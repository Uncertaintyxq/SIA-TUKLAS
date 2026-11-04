# 1. Introduction

## Purpose

This Software Requirements Specification (SRS) states the software requirements for **Tuklas, release 1.0**. Tuklas is a web-based research and academic engagement hub for universities, presented under the tagline "From Defense to Discovery".

The SRS covers the whole system: the web application that students, educators and administrators use in a browser or install on a phone, the server application behind it, the real-time messaging service, the background jobs that send email and notifications, and the server environment the system runs on. It describes release 1.0 as built and tested in November 2026. Details that are still open are marked TBD and listed in Appendix C.

## Document Conventions

- **Requirement tags.** Each functional requirement has a unique tag made of its feature's code and a number, for example REQ-WORK-3 for the third requirement of the works feature. The feature codes are given in Section 4.
- **Requirement wording.** "Shall" marks a mandatory requirement, "should" a desirable one that release 1.0 may leave out, and "may" an option.
- **Priorities.** Each feature in Section 4 has a priority of High, Medium or Low. Its detailed requirements inherit that priority unless a different one is stated.
- **User classes.** Visitor, Student, Educator, Admin and Super-admin are capitalized when they name a user class (Section 2.3).
- **Screen labels.** Text that appears on a screen is written in double quotes, for example "Submit for approval".
- **Open items.** TBD marks information that is not yet available. Every TBD is numbered in Appendix C.
- **Terms.** Terms and abbreviations are defined in Appendix A.

## Intended Audience and Reading Suggestions

This SRS is written for the following readers:

- **The client and the course instructor or panel**, who confirm that the system meets the agreed requirements. Suggested reading: 1.4, Section 2, the feature descriptions in Section 4, and the business rules in 5.5.
- **Developers**, the project team and anyone who maintains the system later. Suggested reading: every section, especially Sections 3 to 5 and Appendix B.
- **Testers**, who check the system against this document. Suggested reading: Section 4, where every requirement tag can be verified, and Section 5.
- **University administrators** (the research office) who will run the platform. Suggested reading: 2.3, 2.6, 5.3, 5.5 and Section 6.

The rest of the document is organized as follows. Section 2 describes the product as a whole: its context, functions, users, environment and constraints. Section 3 describes its interfaces with users, devices, other software and networks. Section 4 lists the system features with their functional requirements. Section 5 gives the nonfunctional requirements: performance, safety, security, quality and business rules. Section 6 covers the database and legal requirements. The appendices hold the glossary, the analysis models (diagrams) and the list of open items.

Every reader should start with 1.4 and Section 2, then go on to the sections suggested above.

## Product Scope

Tuklas gives a university's research community one place to show, review and discover academic work. It combines the two things the client asked for at the project kickoff on 31 August 2026: **public academic portfolios**, and a **social-style hub for research discovery**. It is deliberately not general social media: its content is limited to academic work, academic events and academic opportunities.

The client's objectives for the platform are:

- **Host professional portfolios.** Each member has a public portfolio that shows research and literary works first, then academic background (diplomas and degrees), then honors and awards.
- **Share knowledge.** The platform is a free, accessible place for approved research and literary works, academic events and new discoveries.
- **Support student researchers.** Students submit their works to their research adviser, who reviews them and approves them before they become public. Advisers also run research groups, where students talk with each other and hand in their deliverables.
- **Foster academic engagement.** Members comment on, react to, save and share works, follow people, mention each other, chat, and receive notifications.

Four rules shape the product. A student's work becomes public only after a research adviser or academic panel approves it, and the server enforces this. Advertisements and events are limited to academic content, such as research colloquiums, school innovations and the C.P. Garcia event, and an administrator approves each one. Personal data is protected under the Philippine Data Privacy Act of 2012 (RA 10173). Several schools can share one site, each managed by its own administrators.

These rules support a university research office's goals: to make the research that students defend visible beyond the classroom, and to keep publishing standards high through adviser approval.

Outside the scope of release 1.0 are general-purpose social posts, commercial advertising, searching inside chat messages (which are stored encrypted), sign-in with passkeys, and native app-store apps. Tuklas installs from the browser as a progressive web app instead.

## References

| No. | Title | Author or source | Version or date | Location |
|---|---|---|---|---|
| 1 | Kickoff meeting notes and written Q&A | The client, Dumangas, B. A. Limbadan, J. M. Manla, T. A. V. Rollon | 31 August 2026 | tuklas/reference/August_31_2026.pdf |
| 2 | System UI design progress: login screen and color palette | Project team | 1 October 2026 | tuklas/reference/October_1_2026.pdf |
| 3 | Feature review: features by role, comparison with similar sites | Project team | 2 November 2026 | tuklas/reference/FEATURES.md |
| 4 | Working prototype: feature specification, copy and demo data | Project team | Before the Laravel conversion | tuklas/reference/prototype.html |
| 5 | System architecture | Project team | November 2026 | docs/ARCHITECTURE.md |
| 6 | Deployment plan and security checklist | Project team | November 2026 | docs/DEPLOYMENT.md |
| 7 | Production server runbook | Project team | 4 November 2026 | docs/PRODUCTION_SERVER.md |
| 8 | Architecture decision records | Project team | 0001 to 0002 | docs/decisions/ |
| 9 | Source code repository | Project team | Branch main | https://github.com/Uncertaintyxq/SIA-TUKLAS |
| 10 | Software Requirements Specification template (course template) | Based on K. E. Wiegers, Process Impact | 1999 | docs/SRS Template.docx |
| 11 | Application Security Verification Standard (ASVS) | OWASP Foundation | 4.0.3, October 2021 | https://owasp.org/www-project-application-security-verification-standard/ |
| 12 | OWASP Top 10 | OWASP Foundation | 2021 | https://owasp.org/Top10/ |
| 13 | SP 800-63B-4, Digital Identity Guidelines: Authentication and Authenticator Management | National Institute of Standards and Technology | August 2025 | https://doi.org/10.6028/NIST.SP.800-63B-4 |
| 14 | Republic Act No. 10173, Data Privacy Act of 2012 | Congress of the Philippines | 15 August 2012 | https://privacy.gov.ph/data-privacy-act/ |
| 15 | Laravel documentation | Laravel | Version 13 | https://laravel.com/docs |
