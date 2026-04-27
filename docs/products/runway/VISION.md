---
title: Runway Vision
product: runway
type: vision
status: deferred
date: 2026-04-26
supersedes: ../../.archive/products/runway/VISION.md
---

# Runway Vision

The public-facing surface for airboss. Where someone who isn't logged in can land, learn what the platform is, see free content, and (eventually) sign up.

**Status: deferred.** No `apps/runway/` exists today. The platform is single-user (Joshua, see [user_profile memory entry]) and has no public face. Runway becomes a real surface when:

1. v1 launch milestone is hit and the project goes public, OR
2. Open-source release per [PIVOT.md](../../platform/PIVOT.md)'s open-core posture decides on hosting + landing-page direction, OR
3. A second user joins and we need a "what is this" page.

Until then this doc is a placeholder.

## What runway will do (when it lands)

- **Landing page** -- explain what airboss is to a pilot who isn't logged in.
- **Free content sample** -- a few scenarios, cards, or knowledge-graph nodes accessible without auth.
- **Open-source repo pointers** -- if open-source, links to GitHub, contribution guide.
- **Self-host instructions** -- if open-source, how to run your own instance.
- **Sign-up flow** -- whatever shape that takes per the hosting decision.

## What runway will NOT be

- **A marketing funnel** for a paid course. The pre-pivot runway sold FIRC; airboss is "cover-costs / potentially open-source," not commercial. The FIRC-era marketing surface is archived to [.archive/products/runway/](../../.archive/products/runway/).
- **A learner experience.** Logged-in learners go to study / sim / future surfaces.
- **A blog or content site.** The reference / glossary system already handles authoritative content.

## Trigger to elevate this from "deferred"

When the user decides:

- That airboss has a v1 ready to be shown to others.
- Whether airboss is going open-source, hosted-only, or both.
- What the project name actually is (the working name is "airboss"; per [PIVOT.md](../../platform/PIVOT.md) the final name is TBD).

At that point: write a real PRD, scope a build, and either rebuild from scratch or selectively port pieces from the [archived FIRC-era runway](../../.archive/products/runway/) (auth-infrastructure, marketing-pages had reusable patterns; checkout-enrollment is dead unless monetization comes back).

## References

- [PIVOT.md](../../platform/PIVOT.md) -- business posture
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- runway listed as future surface
- [.archive/products/runway/](../../.archive/products/runway/) -- prior FIRC-era runway docs
