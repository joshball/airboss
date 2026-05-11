# wp-notes-primitive -- test plan

Manual walkthrough the user runs before flipping `human_review_status: signed-off`. Phase-1 only; later phases get an addendum here when they ship.

## Setup

- Reseed dev DB: `bun run db reset`.
- Sign in as Abby (`abby@airboss.test`).
- Open `/notes` in study.

## Walk -- Phase 1

### Create a freestanding note

1. Click "+ Note" in the study app header.
2. Land on `/notes/new`. Form is empty; context picker shows all dropdowns blank.
3. Type a title ("Stall recovery") and a body ("Power, pitch, roll"). Add a tag "stalls."
4. Click Save.
5. Land on `/notes/[id]`. Note rendered with title + body + tag chip + "freestanding" badge (no context chips).

### Create a context-attached note

1. From `/notes/new`, type a title and body.
2. In the context picker, set `referenceId` = "PHAK," `referenceSectionId` = "PHAK §4.2."
3. Save.
4. Detail view shows context chips: 🟠 PHAK / 🟠 §4.2.
5. Hovering a chip shows "jump to source" affordance (link, no click required to verify).

### Filter and search

1. Navigate to `/notes`.
2. Two notes visible. Filter chip "tag: stalls" -> only the freestanding note remains.
3. Clear filter. Type "PHAK" in search box -> only the context note remains.
4. Filter chip "has-followup" -> empty list, "No notes match these filters" empty state.

### Follow-ups

1. Edit the freestanding note. Add a follow-up: "Look up Vno for 172."
2. Save. Detail shows the follow-up block with an open badge.
3. Navigate to `/notes?view=follow-ups`. Note appears in the inbox.
4. Click "Mark done." Badge flips to done; the note no longer appears in the inbox view but does appear in "All."

### Archive and restore

1. From the freestanding note's detail, click Archive.
2. Confirmed -- the note no longer appears in `/notes` (default filter excludes archived).
3. Filter chip "archived" -> note appears.
4. Click Restore. Note returns to the default view.

### Edit-in-place

1. From the context note, click the title. Editable input appears with current value.
2. Edit -> blur -> change persists.
3. Repeat for body (markdown editor opens inline).
4. Add a tag in-place via the chip input.

### Delete (hard)

1. From the freestanding note, click Delete (red).
2. Confirm dialog. Confirm.
3. Note gone. `/notes` doesn't show it. Hitting `/notes/<id>` returns 404.

### Migration check (on a DB seeded with legacy `notes_md` blobs)

1. Reseed with the legacy fixture: `bun run db reset --legacy-notes-fixture`.
2. Open `/notes`. Confirm one note per legacy `(user, section)` blob has been created with tag `migrated-from-blob`.
3. Confirm the source section in flightbag no longer reads `notes_md` from `referenceSectionReadState` (column is dropped).

### Surfaced gaps to verify before signoff

- [ ] Notes render markdown safely (no XSS).
- [ ] Tag chips deduplicate (typing "stalls" twice doesn't add it twice).
- [ ] Context picker handles empty FK lists gracefully (no goals -> "No goals yet" placeholder).
- [ ] Mobile layout on `/notes` viewer is usable (filter chips wrap, list is single-column).
- [ ] Cmd-Enter from the body textarea submits the form (mirror existing `/memory/new` shortcut).
- [ ] An archived note's edit page shows a banner "This note is archived; restore to edit" and disables form fields.
- [ ] Audit log shows one entry per create / update / archive / restore / delete with correct user attribution.

## Walk -- Phase 2 (when shipped)

Addendum lands here when Phase 2 ships. Outline:

- From `/program/goals/[id]`, see the "Notes for this goal (N)" panel.
- "+ Note" pre-fills `goalId`; saved note appears in the panel and in `/notes` filtered by that goal.
- Same flow on `/courses/[id]` and `/study/learn/<knowledge-node>`.

## Walk -- Phase 3 (when shipped)

Addendum lands here when Phase 3 ships.
