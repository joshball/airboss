---
title: "Test Plan: Reference Library & Regulatory Monitoring"
product: hangar
feature: reference-library
type: test-plan
status: done
---

# Test Plan: Reference Library & Regulatory Monitoring

## Setup

```bash
bun scripts/db/seed.ts
bun scripts/dev.ts hangar
```

---

## REF-1: Create a reference document

1. Navigate to `/references/new`
2. Fill in: title "AC 61-83K", type "AC", source "FAA", version "2024-01-15"
3. Add tags: "FIRC", "advisory circular"
4. Submit
5. **Expected:** Redirect to document detail page
6. **Expected:** All fields visible and correct

## REF-2: Edit a reference document

1. From document detail, click Edit
2. Change title, add notes
3. Submit
4. **Expected:** Changes persisted, visible on detail page

## REF-3: Search and filter

1. Navigate to `/references`
2. **Expected:** All documents listed
3. Filter by type "AC"
4. **Expected:** Only ACs shown
5. Search for "61-83"
6. **Expected:** AC 61-83K appears in results

## REF-4: Delete (soft) a reference document

1. From edit page, click Delete
2. **Expected:** Document no longer in list view
3. **Expected:** Links to this doc show "(archived)" on content item pages

---

## LINK-1: Link a reference to a scenario

1. Navigate to a scenario edit page
2. In the "References" section, click "Add Reference"
3. Select "AC 61-83K" from dropdown
4. **Expected:** Link appears in the references section
5. Navigate to the reference document detail page
6. **Expected:** The scenario appears in the "Linked Content" section

## LINK-2: Remove a reference link

1. On scenario edit page, click remove on a reference link
2. **Expected:** Link removed
3. **Expected:** Reference doc detail no longer shows this scenario

## LINK-3: Duplicate link prevented

1. Try to link the same reference to the same scenario twice
2. **Expected:** Error or "already linked" message. No duplicate created.

## LINK-4: View links from reference detail

1. Link a reference to 2 scenarios and 1 module
2. Navigate to reference detail page
3. **Expected:** "Linked Content" section shows 2 scenarios and 1 module, grouped by type

---

## SUPER-1: Mark document as superseded

1. Create a second reference doc (e.g., "AC 61-83K Rev 2")
2. Edit the original, mark as superseded, select the new doc as replacement
3. **Expected:** Original marked with "(superseded)" in list
4. **Expected:** Detail page shows "Superseded by: AC 61-83K Rev 2"

## SUPER-2: Auto-task creation on supersede

1. Link original doc to 2 scenarios before marking superseded
2. Mark as superseded
3. **Expected:** 2 tasks auto-created on the task board
4. **Expected:** Tasks are type "compliance", priority "high"
5. **Expected:** Task titles reference the affected scenarios and the updated document

---

## REG-1: Perform a regulatory check (no changes)

1. Navigate to `/compliance/regulatory-checks/new`
2. Check all 3 boxes (visited FIRC page, reviewed ACs, checked CFRs)
3. Set "Changes found" to No
4. Submit
5. **Expected:** Check recorded. Redirect to check history.
6. **Expected:** No tasks created.

## REG-2: Perform a regulatory check (changes found)

1. Navigate to `/compliance/regulatory-checks/new`
2. Check all 3 boxes
3. Set "Changes found" to Yes
4. Enter findings: "AC 61-83L released, replaces AC 61-83K"
5. Submit
6. **Expected:** Check recorded with findings
7. **Expected:** Task auto-created on task board with findings text
8. **Expected:** Task IDs stored in the check record

## REG-3: Check history

1. Perform 2 regulatory checks
2. Navigate to `/compliance/regulatory-checks`
3. **Expected:** Both checks listed, most recent first
4. **Expected:** Each shows date, who checked, and whether changes were found

## REG-4: Compliance dashboard warning

1. Ensure last regulatory check is > 90 days ago (or no checks exist)
2. Navigate to `/compliance/dashboard`
3. **Expected:** Warning shown: "Regulatory check overdue"
4. **Expected:** Link to `/compliance/regulatory-checks/new`

## REG-5: Dashboard shows days since last check

1. Perform a regulatory check today
2. Navigate to `/compliance/dashboard`
3. **Expected:** Shows "0 days since last check" (or "Today")
4. **Expected:** No warning (within 90-day window)
