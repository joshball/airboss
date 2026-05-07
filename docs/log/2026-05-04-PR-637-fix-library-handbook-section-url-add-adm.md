---
pr: 637
date: 2026-05-04
title: "fix(library): handbook section URL + add ADM/SRM/Va skeleton refs"
wp_id: null
bugs_fixed: []
summary: |
  Fix /library/handbook/[slug]/[chapter]/[section] 404 from the lens chapter page. The chapter page was passing the full dotted section code (e.g. "1.1") where LIBRARY_HANDBOOK_SECTION expects the trailing piece only (e.g. "1"). The loader rebuilds full code as ${chapter}.${section}, so the full-form section produced "1.1.1" and missed the row. Add three skeleton aviation references so dev validate stops failing: adm-safety (Aeronautical Decision-Making), srm-safety (Single-Pilot Resource Management), va-aircraft (Va / design maneuvering speed). All authored kind, marked as skeleton entries...
---
