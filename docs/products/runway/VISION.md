# Runway -- Vision

The entry point. Where visitors arrive, learn what FIRC Boss is, and launch into training.

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
