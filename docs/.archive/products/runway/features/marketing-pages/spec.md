---
title: "Spec: marketing-pages"
product: runway
feature: marketing-pages
type: spec
status: done
---

# Spec: marketing-pages

Public-facing marketing pages for runway: landing, about, and pricing. Includes shared marketing layout with sticky nav and footer.

## Pages

| Route      | File                            | Purpose                                                       |
| ---------- | ------------------------------- | ------------------------------------------------------------- |
| `/`        | `(public)/+page.svelte`         | Landing page -- hero, how-it-works steps, feature cards, CTA  |
| `/about`   | `(public)/about/+page.svelte`   | What FIRC Boss is, scenario approach, FAA compliance, mission |
| `/pricing` | `(public)/pricing/+page.svelte` | Single pricing card, FAQ accordion, CTA                       |

## Layout

The `(public)/+layout.svelte` wraps all public routes (marketing + auth + catalog) with:

- **MarketingNav** -- sticky top nav with brand, page links (Home, Catalog, Pricing, About), Log In / Get Started buttons. Hamburger menu on mobile (768px breakpoint).
- **MarketingFooter** -- About and Pricing links, copyright line. Stacks vertically on mobile.
- Flex column layout, `min-height: 100vh`, footer pushed to bottom via `flex: 1` on main.

## Components

| Component      | Used On          | Purpose                                                              |
| -------------- | ---------------- | -------------------------------------------------------------------- |
| `Hero`         | Landing          | Headline, subheadline, primary CTA button                            |
| `Section`      | All pages        | Consistent section wrapper with heading, optional `variant="subtle"` |
| `StepCard`     | Landing          | Numbered step (1-4 how-it-works flow)                                |
| `FeatureCard`  | Landing          | Title + description card in 3-column grid                            |
| `CallToAction` | Landing, Pricing | Full-width CTA banner with heading, subtext, button                  |
| `PricingCard`  | Pricing          | Price display, feature list, CTA button                              |
| `FaqItem`      | Pricing          | Question/answer pair                                                 |
| `Prose`        | About            | Wrapper for long-form text content                                   |

## Data Model

No data model changes. All content is static, defined inline in page components.

## SEO

Each page sets `<svelte:head>` with `<title>`, `<meta name="description">`, and Open Graph tags (`og:title`, `og:description`, `og:type`).

## Routing

All navigation uses `ROUTES` constants from `@firc/constants`. CTAs link to `ROUTES.REGISTER`. Pricing CTA includes `?redirectTo={ROUTES.RUNWAY_CHECKOUT}` query param.

## Responsive

- Landing steps grid: 4 columns -> 2 columns (768px) -> 1 column (480px)
- Landing features grid: 3 columns -> 1 column (768px)
- Nav: inline links -> hamburger menu (768px)
- Footer: row -> stacked column (768px)
- Pricing FAQ: max-width 42rem, single column

## Out of Scope

- CMS or dynamic content -- all marketing copy is hardcoded
- Analytics or conversion tracking
- A/B testing
- Blog or content marketing pages
