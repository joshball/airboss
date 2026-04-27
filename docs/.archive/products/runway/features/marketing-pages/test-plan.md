---
title: "Test Plan: marketing-pages"
product: runway
feature: marketing-pages
type: test-plan
status: done
---

# Test Plan: marketing-pages

## Setup

Start the runway dev server (`bun run dev` in `apps/runway`). No auth or database required -- all pages are static public content.

---

## MKT-001: Landing page renders

1. Navigate to `/`
2. **Expected:** Hero section with headline "Renew Your CFI the Way You Actually Learn", "Get Started" button linking to `/register`
3. Scroll down -- 4-step "How It Works" grid, 6-card "Why FIRC Boss" grid, bottom CTA

## MKT-002: About page renders

1. Navigate to `/about`
2. **Expected:** Four prose sections (What Is FIRC Boss, Scenario-Based Approach, FAA Compliance, Our Mission) with alternating subtle/default backgrounds

## MKT-003: Pricing page renders

1. Navigate to `/pricing`
2. **Expected:** Pricing card showing price derived from `COURSE_PRICE_CENTS`, feature list with 7 items, "Get Started" button
3. Scroll down -- 4 FAQ items visible, bottom CTA section

## MKT-004: Pricing CTA links to register with redirect

1. On `/pricing`, click pricing card "Get Started" button
2. **Expected:** Navigates to `/register?redirectTo=/checkout` (register with checkout redirect)

## MKT-005: Navigation links work

1. From any page, verify nav shows: Home, Catalog, Pricing, About, Log In, Get Started
2. Click each nav link
3. **Expected:** Each navigates to correct route. "Get Started" goes to `/register`, "Log In" goes to `/login`

## MKT-006: Mobile hamburger menu

1. Resize browser to < 768px width
2. **Expected:** Nav links hidden, hamburger icon visible
3. Tap hamburger -- nav links appear in stacked layout
4. Tap hamburger again -- menu closes
5. Tap a nav link -- menu closes and page navigates

## MKT-007: Footer links

1. Scroll to bottom of any public page
2. **Expected:** Footer with About and Pricing links, copyright with current year
3. Click each footer link -- navigates correctly

## MKT-008: Responsive grids

1. On landing page at full desktop width
2. **Expected:** Steps in 4-column grid, features in 3-column grid
3. Resize to 768px -- steps become 2 columns, features become 1 column
4. Resize to 480px -- steps become 1 column

## MKT-009: SEO meta tags

1. View page source on `/`, `/about`, `/pricing`
2. **Expected:** Each page has unique `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:type="website"`
