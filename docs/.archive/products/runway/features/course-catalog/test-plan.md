---
title: "Test Plan: course-catalog"
product: runway
feature: course-catalog
type: test-plan
status: done
---

# Test Plan: course-catalog

## Setup

- Published release with at least 4 scenarios and 2 modules in the database
- At least one scenario must have a slug, one must not (to test fallback)
- At least one module must reference multiple scenarios

---

## CAT-001: Catalog landing with published content

1. Navigate to `/catalog`
2. **Expected:** Page loads with "Course Catalog" title. Up to 3 scenario cards and up to 3 module cards visible. "View all" links present for both sections.

## CAT-002: Catalog landing with no release

1. Ensure no published release exists in the database
2. Navigate to `/catalog`
3. **Expected:** `EmptyCatalog` component displayed. No errors.

## CAT-003: Scenario list page

1. Navigate to `/catalog/scenarios`
2. **Expected:** All published scenarios displayed in a card grid. Each card shows title, briefing excerpt, duration, and up to 2 FAA topics. "Back to catalog" link works.

## CAT-004: Scenario detail by slug

1. Navigate to `/catalog/scenario/{valid-slug}`
2. **Expected:** Full scenario detail with title, briefing, difficulty, duration, FAA topics, and mapped competencies. "Register to start training" CTA links to registration.

## CAT-005: Scenario detail -- invalid slug

1. Navigate to `/catalog/scenario/nonexistent-slug`
2. **Expected:** 404 page returned.

## CAT-006: Module list page

1. Navigate to `/catalog/modules`
2. **Expected:** All published modules displayed. Each card shows title, scenario count, and time allocation. "Back to catalog" link works.

## CAT-007: Module detail with scenarios

1. Navigate to `/catalog/module/{valid-id}` for a module with multiple scenarios
2. **Expected:** Module title, scenario count badge, time allocation badge. Scenario cards listed below. Each card links to the scenario detail page.

## CAT-008: Module detail -- invalid ID

1. Navigate to `/catalog/module/nonexistent-id`
2. **Expected:** 404 page returned.

## CAT-009: Scenario slug fallback

1. Find a scenario without a slug in the database
2. Navigate to catalog landing or scenario list
3. Click that scenario's card
4. **Expected:** URL uses the scenario ID instead of a slug. Page loads correctly.

## CAT-010: SEO metadata

1. View page source on each catalog page
2. **Expected:** Each page has unique `<title>`, `<meta name="description">`, `og:title`, and `og:description` tags with relevant content.
