---
pr: 128
date: 2026-04-24
title: "feat(study): review-sessions Resume + public card page + cross-refs panel (Bundle B)"
wp_id: review-sessions-url
bugs_fixed: []
summary: |
  ## What **review-sessions-url layer (a) Resume**: new study.memory_review_session table; /memory/review/<sessionId> route owns the review chrome. /memory/review now creates a session and redirects. /memory grows a Resume-your-last-run tile. **card-page-and-cross-references**: new public /cards/<id> route (outside the (app) auth group); Cross-References panel on /memory/<id> with four rows (Sessions populated; Reps, Plans, Scenarios show honest "coming soon" empty states); Share button copies the public URL with a toast.
---
