# Study -- Roadmap

Deferred items and upcoming work for the `apps/study` surface.

## Recently shipped

- **study-app-ia-cleanup (2026-05-05)** -- four-phase IA reset. Top nav locked to five sections (Home / Learn / Program / Insights / Reference). Daily-CTA Home, consolidated `/program` surface (Quals + Goal + Plan + Coverage tabs), `/dashboard` -> `/insights` with 301 redirects, `/knowledge` + `/glossary` -> `/reference/*`, dropdowns retired in favour of section-index sub-nav (`LearnTabs` for the Learn family). Page-anchor static guard now CI-enforced. See [docs/work-packages/study-app-ia-cleanup/](../../work-packages/study-app-ia-cleanup/).

## Deferred

- **Password recovery (forgot password flow)** -- currently single-user (Joshua as user zero); password reset will be built out when multi-user lands. Dependencies: Resend (already in deps), token TTL, rate limiting, reset-flow UX. Trigger to revisit: first additional user added.
