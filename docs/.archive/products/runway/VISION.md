# Archived: FIRC-era Runway Vision (2026-04-26)

> **Archived 2026-04-26.** This describes the marketing site for FIRC Boss (course catalog, signup, payment, enrollment, SSR, FAA-credit messaging). Per [PIVOT.md](../../../platform/PIVOT.md), airboss is a "cover-costs / potentially open-source" pilot performance platform, not a paid FIRC course. The runway concept may someday return as a public landing page for the open-source project; the FIRC-era marketing surface won't.
>
> **Current source of truth:** [docs/products/runway/VISION.md](../../../products/runway/VISION.md) (thin placeholder until v1 launch).
>
> Kept for historical context only.

---

## Original document

The pre-pivot runway vision -- a public marketing site for FIRC Boss with paid course signup, payment, and enrollment.

## Purpose

Runway is the public-facing site for FIRC Boss. It serves three audiences:

| Audience                | Need                          | Runway delivers                   |
| ----------------------- | ----------------------------- | --------------------------------- |
| Prospective learner     | "What is this? Is it for me?" | Marketing pages, course catalog   |
| Ready-to-enroll learner | "I want to sign up and start" | Registration, payment, enrollment |
| Returning learner       | "Take me to my course"        | Login, redirect to sim            |

## Principles

- **Public first.** Browsing requires no account. The catalog, pricing, and marketing are open.
- **SSR for SEO.** Runway is the only app with server-side rendering. Search engines must index it.
- **Fast to launch.** Signup-to-first-scenario should feel frictionless. Minimal steps.
- **Two Systems, Layered.** Public copy says "scenario-based interactive instruction." Never "game." Never expose engine internals, scoring formulas, or adaptive algorithms.
- **Never a Trick.** Pricing is clear. No hidden fees, no dark patterns, no surprise charges.

## What Runway Is Not

- Not a learner dashboard (that's sim)
- Not account management (that's sim)
- Not user administration (that's ops)
- Not content authoring (that's hangar)

Once a learner is enrolled, runway's job is done. Hand off to sim.

## Domain

- Production: `fircboss.com` (apex)
- Development: `runway.firc.test:7640`

## Data Access

| Schema      | Access | Purpose                                           |
| ----------- | ------ | ------------------------------------------------- |
| `published` | read   | Course catalog (modules, scenarios, competencies) |
| `identity`  | write  | Account creation (signup)                         |
| `audit`     | write  | Action logging                                    |

Runway never reads raw authoring data (`course` schema). Only published snapshots.
