---
title: 'Out of Scope: WP-FLIGHTBAG-CONTENT'
product: flightbag
feature: wp-flightbag-content-rendering
type: out-of-scope
status: unread
---

# Out of Scope: WP-FLIGHTBAG-CONTENT

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

## Summary

| Item                                            | Status       | Trigger to revisit                                                        |
| ----------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| Search inside flightbag                         | Follow-on WP | After content rendering ships and learners need to find sections by query |
| Auth on flightbag                               | Rejected     | Never -- see detail below                                                 |
| Public web deployment (`flightbag.airboss.dev`) | Deferred     | When Joshua reopens the public-hosting / license question                 |
| Migrating study's `/library/...` routes         | Follow-on WP | Tracked by `wp-citation-chips-to-flightbag/`; runs after this WP ships    |

## Search inside flightbag

Status: Follow-on WP

What was deferred:

A full-text / structured search surface inside the flightbag app that lets a reader type a query (e.g. "stall recovery", "91.103") and jump to matching sections across handbooks, AIM, CFR, AC, and ACS. Per the spec, that includes "index from manifests; ranking; query UI" -- index build, ranking model, and the in-app query input + results list.

Why:

This WP is scoped to wiring the existing scaffolded routes to real `@ab/sources` resolvers and rendering the resulting `reference_section` content. Adding a search corpus, ranking pipeline, and query UI is its own surface with its own data layer, and bundling it would balloon the WP past the per-phase shipping plan (9 phases already). Spec narrative explicitly calls it out as a separate WP.

Trigger to revisit (Follow-on WP):

After this WP ships and the flightbag app is rendering real content across all corpora (handbooks, AIM, CFR, AC, ACS). At that point, the manifests in `handbooks/`, `aim/`, `regulations/`, `ac/`, `acs/` are the natural index source, and authoring the WP that indexes them + builds the query UI becomes the next reasonable surface investment.

Implementation pattern when triggered:

Author a new WP via `/ball-wp-spec` at `docs/work-packages/wp-flightbag-search/` (or similar slug). Index source = the per-corpus manifests already present in repo. Render surface = a `/flightbag/search` route in `apps/flightbag/`. Use the same `urlForReference()` bridge that this WP uses to link search hits back to the right section page.

References:

- [spec.md](./spec.md) -- "Out of scope" section listing search as separate WP
- [docs/products/flightbag/VISION.md](../../products/flightbag/VISION.md) -- read-only reader scope
- [libs/sources/](../../../libs/sources/) -- existing resolver layer; the search index would build on top

## Auth on flightbag

Status: Rejected

What was rejected:

Putting any authentication or session gate on flightbag routes. The app stays open / public-equivalent within the deployed environment, with no login required to read any section.

Why:

Flightbag's product framing in `docs/products/flightbag/VISION.md` is explicit: "Read-only. No authoring. No admin." All content rendered is FAA-published reference material (handbooks, CFR, AIM, AC, ACS); none of it is private user data or anything that benefits from gating. Adding auth would:

1. Block citation chips from working without a session round-trip (study, sim, FIRC all link in).
2. Add friction to the cross-app citation flow that justifies flightbag's existence.
3. Conflict with the "eventually public" framing in VISION.md (when the platform goes external, flightbag is the public-facing surface).

The rejection is not "we forgot to add auth"; it's "auth is the wrong shape for this surface." A re-decision would require a concrete reason to gate FAA-published material, which is unlikely to ever exist.

References:

- [docs/products/flightbag/VISION.md](../../products/flightbag/VISION.md) -- "Read-only" and "Eventually public" sections
- [spec.md](./spec.md) -- "Out of scope" section confirming auth-free posture

## Public web deployment

Status: Deferred

What was deferred:

Standing up flightbag at a public URL (e.g. `flightbag.airboss.dev`), with DNS, TLS, CDN, and public-facing hosting. VISION.md describes this as a future surface; this WP ships only the rendering layer that would make a public deployment viable.

Why:

Two reasons:

1. **Hosting / license posture is currently private.** Per the standing project decision (2026-04-30): no public repo, hosted-only by Joshua. Public web deployment of any airboss surface is paused until that question is reopened.
2. **Scope discipline.** This WP is the rendering wiring. Deployment is an infra concern with its own pipeline, DNS, monitoring, and security review surface. Bundling them would block content work on infra work.

The rendering layer this WP delivers is deployment-neutral: it works the same whether the app is reachable only at `localhost`, on Joshua's hosted environment, or on a future public URL.

Trigger to revisit:

When Joshua reopens the public-hosting / license question. At that point, flightbag is the natural first public surface (FAA-published content, no private data, deep-link-friendly URLs).

Implementation pattern when triggered:

Stand up a deployment target for `apps/flightbag/` mirroring whatever hosting pattern the other apps use at that point (`apps/study/`, `apps/hangar/` deployment configs). Add a `flightbag.airboss.dev` (or chosen subdomain) DNS record + TLS cert. No code changes required in `apps/flightbag/` itself if this WP's rendering is environment-neutral.

References:

- [docs/products/flightbag/VISION.md](../../products/flightbag/VISION.md) -- "Future surfaces" section, "Public web at flightbag.airboss.dev (or similar)"
- Project memory: license + hosting -- private / all-rights-reserved (2026-04-30); no public repo, hosted-only by Joshua

## Migrating study's `/library/...` routes

Status: Follow-on WP

What was deferred:

Cutting study's existing `/library/...` reference rendering routes over to flightbag URLs (so all reference reading happens in the flightbag app, and study's citation chips point at flightbag instead of study-local pages). The migration touches study's citation rendering, route table, and link targets.

Why:

This WP wires flightbag's own routes to real content. The migration step is a separate concern: it touches study's surface, not flightbag's, and depends on flightbag actually rendering content correctly first. Spec narrative explicitly points at the dedicated follow-on WP that owns the migration.

Trigger to revisit (Follow-on WP):

Already tracked by `wp-citation-chips-to-flightbag/`. The follow-on WP runs after this one ships -- once flightbag is rendering content, study's `/library/...` routes have a real target to redirect / link to.

Implementation pattern when triggered:

Follow `docs/work-packages/wp-citation-chips-to-flightbag/spec.md`. Use the `urlForReference()` bridge in `libs/sources/src/url-for-reference.ts` to translate study's existing reference identifiers to flightbag URLs; update study's `<CitationChip>` callsites; retire / redirect the `/library/...` routes per that WP's plan.

References:

- [spec.md](./spec.md) -- "Out of scope" + Anchors section pointing at the follow-on WP
- [docs/work-packages/wp-citation-chips-to-flightbag/](../wp-citation-chips-to-flightbag/) -- the follow-on WP that owns the migration
- [libs/sources/src/url-for-reference.ts](../../../libs/sources/src/url-for-reference.ts) -- the URI -> URL bridge both WPs depend on
