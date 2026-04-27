---
title: "Code Review: Published Viewer"
product: hangar
feature: published-viewer
type: review
date: 2026-03-28
status: done
review_status: done
---

# Code Review: Published Viewer

## UX Review

### [MEDIUM] Release page is very long with no navigation

**File:** apps/hangar/src/routes/(app)/publish/[releaseId]/+page.svelte:12-200
**Issue:** 7 data tables stacked vertically (scenarios, modules, questions, micro-lessons, student models, competencies, release info). Several screens long with no jump links.
**Recommendation:** Add anchor links at top or use TabBar component for one content type at a time.

### [LOW] Questions table shows option count but no way to see actual options

**File:** apps/hangar/src/routes/(app)/publish/[releaseId]/+page.svelte:108
**Issue:** Shows `q.options.length` but not the option text. For content review, seeing options matters.
**Recommendation:** Add expandable row or tooltip.

### [LOW] Publish form has no version format guidance

**File:** apps/hangar/src/routes/(app)/publish/+page.svelte:54
**Issue:** Version field has `placeholder="0.1.0"` but no validation hint.
**Recommendation:** Add hint text: "Use semantic versioning (e.g. 1.0.0)".

## Engineering Review

### [MEDIUM] Published viewer load function has no explicit role guard

**File:** apps/hangar/src/routes/(app)/publish/[releaseId]/+page.server.ts
**Issue:** Relies on layout guard only. Shows full published content. Should have defense-in-depth.
**Recommendation:** Add `requireRole(event, ROLES.AUTHOR, ROLES.ADMIN)`.

### [LOW] All content loaded in single request

**File:** apps/hangar/src/routes/(app)/publish/[releaseId]/+page.server.ts:9-16
**Issue:** `Promise.all` fetches all 6 content types. Fine now, may not scale.
**Recommendation:** Consider lazy loading per tab as content grows.

## Fix Log (2026-03-28)

### UX

- [MEDIUM] Release page is very long with no navigation -- verified fixed (pre-existing)
- [LOW] Questions table shows option count but no way to see actual options -- fixed in 090e7f7
- [LOW] Publish form has no version format guidance -- verified fixed (pre-existing)

### Engineering

- [MEDIUM] Published viewer load function has no explicit role guard -- fixed in 60f45df
- [LOW] All content loaded in single request -- accepted, Phase 2 appropriate (scaling, fine now)
