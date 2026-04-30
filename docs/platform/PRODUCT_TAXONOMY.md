---
title: Product Taxonomy
date: 2026-04-30
status: living
parent: ./PIVOT.md
related:
  - ./MULTI_PRODUCT_ARCHITECTURE.md
  - ../vision/INDEX.md
---

# Product Taxonomy

**The word "product" was overloaded.** This doc defines what counts as a product, what counts as a feature, and what counts as a surface. Read it before calling something a "product" in any other doc.

## TL;DR

| Term | Definition | Example |
| ---- | ---------- | ------- |
| **Product** | A full user-facing system with its own mode of engagement and conceptual model. The thing a pilot says they're "using." | Ground school, Sim, Avionics |
| **Feature** | A piece of a product. Has UI, has a route, but isn't standalone -- depends on the product's data and context. | Lens, goals, cert dashboard, handbook reader, spaced rep |
| **Surface app** | A code-organization unit in `apps/`. Groups features by *how they render*, not by what they teach. May host one product or be shared across products. | `apps/study/`, `apps/sim/`, `apps/avionics/` |

A pilot **opens a product**. A pilot **uses a feature within a product**. A pilot **never sees a surface app** -- that's an internal directory name.

## The shape of airboss today

Working hypothesis: **~3 real products.** Not committed yet. Could collapse to 1 or expand to 5 as we figure out what airboss is. Numbers don't matter; the principle does.

### Product 1: Ground school

The core asynchronous-study product. A pilot uses it to learn aviation knowledge -- regulations, aerodynamics, weather, systems, procedures -- and to be tested on what they've learned. One product, many features.

| Feature | Internal name | What the user sees | Relationship |
| ------- | ------------- | ------------------- | ------------ |
| Knowledge graph | `knowledge` | (invisible -- data model) | The substrate every feature reads from |
| Handbook reader | `handbooks/...` | "the handbook," "PHAK ch. 4" | Entry point: read the source |
| Spaced rep / quiz | `study/...` | "my reps," "the cards" | Active recall over the graph |
| Weakness lens | `lens/weakness` | "what to study next" | Filtered view by performance |
| Handbook lens | `lens/handbook` | "what to study from this chapter" | Filtered view by source |
| Goal composer | `goals/...` | "my checkride goals" | Cert/syllabus-driven targets |
| Cert dashboard | `credentials/...` | "my CFI progress" | Progress against ACS/PTS |
| Reference resolver | `references/...` | (invisible -- citation rendering) | Substrate for cross-doc links |

**One product, seven features.** A pilot navigates between them in a single session and doesn't think of them as separate things.

Lives on `apps/study/` (the surface app). Could grow into multiple surface apps later (e.g. an `audio/` surface for narrated drills) without the product itself fragmenting -- it stays one product with the same goals, same graph, same cert dashboard.

### Product 2: Sim

The real-time scenario product. Distinct mode of engagement: live decisions, tick loop, scoring -- not async recall. Feeds from the same knowledge graph and the same goals as ground school, but the pilot's mental model is different ("I'm flying a scenario" vs "I'm studying").

Lives on `apps/sim/` (the surface app). May grow features (cockpit panel, dual page, horizon view, debrief) but stays one product.

### Product 3: Avionics

The PFD/MFD trainer product. Distinct because the user is learning *interface manipulation* (knobs, modes, scan patterns) rather than *aviation knowledge* or *real-time scenarios*. Could plausibly fold into Sim later; for now it's far enough apart in interaction model to be its own product.

Lives on `apps/avionics/` (the surface app).

### Things that are NOT products today

These all exist in the codebase or in vision docs and were sometimes called "products." They are not.

| Thing | What it actually is |
| ----- | ------------------- |
| Lens | Feature of ground school |
| Goals | Feature of ground school |
| Cert dashboard | Feature of ground school |
| Spaced Memory Items | Feature of ground school (the spaced rep system) |
| Decision Reps | Feature of sim (or ground school -- depends how it's built) |
| Calibration Tracker | Feature, cuts across ground school and sim |
| Route Walkthrough | Feature, would create a `spatial/` surface |
| Ten-Minute Ticker | Feature pattern (10-min daily session) |
| NTSB Story | Feature, narrated audio mode |
| ATC Comms Drill | Feature, audio mode |

**The 53 entries in [vision/INDEX.md](../vision/INDEX.md)** are mostly features (or feature *patterns*) of one of the three products above. The INDEX is still useful as an idea bank -- *what could we build* -- but the term "product" in there is overloaded with what we'd now call "features." Reclassification of the INDEX is deferred (low priority, no public face yet).

## Why this matters

Three concrete consequences:

1. **No more route-as-product.** `/lens/weakness` is a route in the ground-school product. Calling it "the lens product" implies it stands alone. It doesn't -- it depends on the knowledge graph, the spaced-rep history, and the cert goals. Talking about it as a product creates a false discreteness that distorts roadmap thinking and product copy.
2. **Naming pressure lives at the product layer, not the feature layer.** A feature gets a clear *interface label* ("Weak areas," "My goals," "Handbook"). A product eventually gets a *brand* (TBD -- ground school has none yet). Don't waste naming cycles trying to brand features.
3. **Architecture stays clean.** The Option 7 surface-typed architecture in [MULTI_PRODUCT_ARCHITECTURE.md](MULTI_PRODUCT_ARCHITECTURE.md) is right -- `apps/` are organized by rendering surface, not by product. A surface app like `apps/study/` hosts one product (ground school). A surface app like `apps/audio/` (when it exists) might host features of *multiple* products (ground school's narrated drills, sim's NTSB stories). That's fine -- surfaces and products don't have to map 1:1.

## How to use this doc

When you write a new doc, vision entry, or PRD, ask:

1. **Is this a full user-facing system with its own engagement mode?** -> Product. Capitalize it. Eventually brand it.
2. **Is this a piece of an existing product -- a route, a view, a tool?** -> Feature. Lowercase. Use a clear interface label, not a brand.
3. **Is this a code-organization unit in `apps/`?** -> Surface. Internal name only; user never sees it.

When you read an existing doc that calls something a product, check it against the three definitions. If it's actually a feature, fix the language as you go (don't batch -- fix in passing).

When in doubt: a pilot should be able to say "I'm using \[product\]" or "I'm doing \[feature\] in \[product\]." If the sentence doesn't work, the categorization is wrong.

## Open questions

- **Is ground school really one product, or two?** Self-directed study (free-form, no goal) vs cert-driven study (toward a goal) feel different in practice but share all the same data. Probably one product with two modes; revisit if the modes drift apart.
- **Does avionics belong with sim?** Both are real-time, both involve manipulating an aircraft model. They split today on knowledge-vs-interface emphasis. Could collapse later.
- **What is FIRC?** When `apps/firc/` migrates from airboss-firc, is it a fourth product or a packaged-content variant of ground school? Defer until the migration is real.

## What this doc does NOT do

- Name any of the products. Working description "ground school" is a placeholder, not a brand. Naming happens when there's a public face.
- Rename any code or routes. `apps/study/`, `/lens/...`, `/goals/...` all keep their current names. This is a doc-clarity pass, not a refactor.
- Reclassify [vision/INDEX.md](../vision/INDEX.md). Deferred.

## References

- [PIVOT.md](PIVOT.md) -- what airboss is and isn't (the broader framing)
- [MULTI_PRODUCT_ARCHITECTURE.md](MULTI_PRODUCT_ARCHITECTURE.md) -- the surface-typed architecture (code organization)
- [vision/INDEX.md](../vision/INDEX.md) -- the idea bank (mostly features, despite what it says today)
