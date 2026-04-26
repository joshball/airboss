---
title: Published Viewer -- Manual Test Plan
product: hangar
feature: published-viewer
type: test-plan
status: done
---

# Published Viewer -- Manual Test Plan

## Prerequisites

- Hangar running locally (`bun dev` in `apps/hangar/`)
- Database running with schema pushed
- At least one of each content type created (scenario, module, question, micro-lesson, student model, competency)
- Logged in as a hangar user

## Test: Publish and view

1. Navigate to `/publish`.
2. Enter a version (e.g., "1.0.0") and optional changelog.
3. Click "Publish" and confirm.
4. **Expected:** Success message with counts of all published content types.
5. Click "View release" link next to the release info.
6. **Expected:** Navigates to `/publish/{releaseId}`.
7. **Expected:** Release header shows version "1.0.0", published date, FAA status badge.

## Test: Content accuracy

8. On the viewer page, check each content section:
   - **Scenarios:** All created scenarios appear. Title, difficulty, duration visible.
   - **Modules:** All modules appear. Title, time allocation visible.
   - **Questions:** All questions appear. Text, type, option count visible. `correctAnswer` is NOT shown.
   - **Micro-lessons:** All micro-lessons appear. Title, trigger context visible.
   - **Student models:** All student models appear. Name, parameter summary visible.
   - **Competencies:** All competencies appear. ID, domain, skill visible.
9. **Expected:** Counts match the publish success message.

## Test: Read-only

10. On the viewer page, verify there are no edit buttons, delete buttons, or form actions.
11. **Expected:** Page is purely informational.

## Test: Invalid release

12. Navigate to `/publish/nonexistent-id`.
13. **Expected:** 404 error page.

## Test: No release

14. If no content has been published, navigate to `/publish`.
15. **Expected:** No "View release" link shown. Publish form available.

## Test: Multiple publishes

16. Create additional content (e.g., new scenario).
17. Publish again with version "1.1.0".
18. **Expected:** `/publish` shows version "1.1.0" as the latest release.
19. Navigate to the new release viewer.
20. **Expected:** New content appears. Old content still present (additive).
