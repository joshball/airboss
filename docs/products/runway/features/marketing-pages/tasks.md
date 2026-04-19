---
title: "Tasks: marketing-pages"
product: runway
feature: marketing-pages
type: tasks
status: done
---

# Tasks: marketing-pages

All tasks completed in Phase 4a, work package B.

## Layout

- [x] Create `(public)/+layout.svelte` with flex column, min-height viewport
- [x] Create `MarketingNav.svelte` -- brand link, nav links from `ROUTES`, Log In / Get Started buttons
- [x] Add hamburger menu with animated bars, toggle state via `$state`
- [x] Add mobile breakpoint (768px) -- stacked nav, full-width links
- [x] Create `MarketingFooter.svelte` -- About/Pricing links, copyright with dynamic year
- [x] Add mobile breakpoint (768px) -- stacked footer

## Landing Page

- [x] Create `(public)/+page.svelte` as landing page
- [x] Create `Hero` component -- headline, subheadline, CTA linking to register
- [x] Create `Section` component -- heading, optional `variant="subtle"` for alternating backgrounds
- [x] Create `StepCard` component -- numbered step with label and detail
- [x] Build "How It Works" section with 4-step grid (sign up, fly, debrief, earn)
- [x] Create `FeatureCard` component -- title and description
- [x] Build "Why FIRC Boss" section with 6 feature cards in 3-column grid
- [x] Create `CallToAction` component -- heading, subtext, CTA button
- [x] Add responsive grid breakpoints (4 -> 2 -> 1 for steps, 3 -> 1 for features)
- [x] Add SEO meta tags and Open Graph tags

## About Page

- [x] Create `(public)/about/+page.svelte`
- [x] Create `Prose` component for long-form text
- [x] Write four sections: What Is FIRC Boss, Scenario-Based Approach, FAA Compliance, Our Mission
- [x] Alternate section variants (default/subtle) for visual rhythm
- [x] Add SEO meta tags and Open Graph tags

## Pricing Page

- [x] Create `(public)/pricing/+page.svelte`
- [x] Create `PricingCard` component -- price from `COURSE_PRICE_CENTS`, feature list, CTA
- [x] Create `FaqItem` component -- question/answer pairs
- [x] Write 4 FAQ items (what is a FIRC, completion time, FAA acceptance, renewal timing)
- [x] Add CTA section at bottom
- [x] CTA links to register with `?redirectTo` to checkout
- [x] Add SEO meta tags and Open Graph tags
