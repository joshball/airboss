---
title: "Ops Vision"
product: ops
type: vision
---

# Ops Vision

**The Island** -- operations, compliance, and people management for FIRC Boss.

## What Ops Is

Ops is where operators and admins manage the human side of the platform: who's enrolled, how they're progressing, whether they've met FAA requirements, and what certificates to issue. It's the command deck that sits above the training environment (sim) and content workshop (hangar).

## Who Uses Ops

| Role         | What they do in ops                                                             |
| ------------ | ------------------------------------------------------------------------------- |
| **Operator** | Manage enrollments, view learner progress, issue certificates, pull FAA records |
| **Admin**    | Everything operators do, plus user management (invite, ban, role assignment)    |

Learners and authors never see ops. Their worlds are sim and hangar.

## Core Responsibilities

1. **User management** -- accounts, roles, invitations, bans
2. **Enrollment management** -- create/manage enrollments, assign content releases
3. **Learner oversight** -- view progress, time logs, evidence, scenario runs
4. **Certificate issuance** -- graduation vs completion, PDF generation
5. **FAA records** -- 24-month retention queries, evidence packet assembly, audit trail
6. **Analytics** -- completion rates, struggle points, time distribution
7. **Compliance** -- traceability matrix viewer, regulatory check tracking

## Design Philosophy

- **Everything auditable.** Every action in ops is logged. Every record is traceable.
- **FAA compliance is the primary constraint.** Features are shaped by what the FAA requires, not what's convenient.
- **Read-heavy.** Ops mostly reads data written by sim and hangar. It writes enrollment records, certificates, and user management actions.
- **No training content.** Ops never edits scenarios, questions, or curriculum. That's hangar's job.
