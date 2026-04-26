# Hangar Vision

## What It Is

The command center for FIRC Boss. One app where you build the course, manage FAA compliance, organize reference documents, and track all product work.

## Who It's For

- **Content authors** -- writing scenarios, modules, questions
- **Course managers** -- structuring the curriculum, mapping to FAA requirements
- **Compliance officers** -- maintaining traceability, generating FAA packages, tracking regulatory changes
- **Product leads** -- prioritizing work across all apps, tracking progress

Today these are the same person. The system should work for one person doing everything and scale to a team with distinct roles.

## What It Does

Five things:

1. **Course content management** -- Create and edit scenarios, modules, competencies, questions. Full content lifecycle: draft, review, validate, approve, publish. Every edit versioned and auditable.

2. **FAA compliance management** -- Traceability matrix, TCO, FAA package generation. Automated compliance checks. Submission tracking. Regulatory change monitoring.

3. **Reference document library** -- Store FAA documents, ACs, CFRs, handbooks, NTSB reports. Link them to course content. Track which versions we're building against.

4. **Product & task management** -- Boards, backlogs, task tracking across all apps (sim, hangar, ops, engine, content). Content tasks link directly to content items.

5. **Content analytics** -- Coverage dashboards, scenario inventory, question bank depth, time allocation projections.

## What It's NOT

- Not the learner experience (that's sim)
- Not user/enrollment management (that's ops)
- Not a general-purpose project management tool -- just enough task tracking to know what's next
- Not a flight simulator editor -- scenarios are defined as data (tick scripts, student models, parameters), not visual simulations

## Design Principles

- **Audit everything.** Every content change is tracked, timestamped, and attributable. This is a regulated product.
- **Validate continuously.** Don't wait for submission time to find out you're missing TSA coverage. Show compliance state in real time.
- **Link everything.** A scenario links to competencies, which link to FAA topics, which link to the traceability matrix. Navigate in any direction.
- **One place for what's next.** Tasks, content work, compliance work -- all visible from one dashboard.
- **Simple until proven otherwise.** Task boards are kanban columns, not workflow engines. Content editing is forms and fields, not a CMS. Add complexity only when the simple version fails.
