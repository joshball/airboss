---
title: 'Test plan: Hangar registry'
product: hangar
feature: hangar-registry
type: test-plan
status: unread
review_status: pending
---

# Test plan: Hangar registry

## Automated

### Unit

- [ ] `toml-codec` encode/decode round-trip deep-equal for the full fixture
- [ ] `toml-codec` byte-identical on already-sorted input
- [ ] `detect-drift` returns only dirty rows
- [ ] `detect-conflict` aborts when on-disk TOML sha changed since last sync
- [ ] `enqueueJob` inserts row; `getJob` returns it
- [ ] Worker: happy path (queued -> running -> complete)
- [ ] Worker: per-`targetId` serialisation
- [ ] Worker: recovery after simulated crash mid-run
- [ ] Optimistic lock: rev-mismatch write returns 409 with diff

### Integration

- [ ] Full migration flow: read current `aviation.ts` -> emit TOML -> parse -> compare to in-memory original (deep-equal)
- [ ] Study `/glossary` renders identical content before + after migration (snapshot test)
- [ ] Sync service in local-commit mode writes a real commit in a temp repo
- [ ] Sync service in pr mode pushes a branch and calls `gh pr create` (mock the gh binary in test)

## Manual walkthrough

Run in order. Each step has a pass condition.

### Boot + content parity

1. Pull the merged PR, `bun install`, `bun run db migrate`, `bun run dev`. **Pass:** all three apps boot.
2. Visit study `/glossary`. **Pass:** identical reference list to before the migration.
3. Visit hangar `/glossary`. **Pass:** same reference list renders with the admin table.

### Edit + sync (local mode)

4. Click on any reference. **Pass:** edit form renders, markdown preview works.
5. Change the paraphrase, save. **Pass:** row shows dirty badge; detail shows "dirty, last synced at SHA <old>".
6. Click "Sync all pending". **Pass:** `/jobs/<id>` loads, log streams, job finishes in < 5 s.
7. `git log -1` in the repo. **Pass:** commit appears with `hangar: sync 1 references (actor: ...)`.
8. Reopen the same reference. **Pass:** dirty badge cleared; last-synced SHA = new commit.

### Edit + sync (pr mode)

9. Set `HANGAR_SYNC_MODE=pr`, restart hangar. Repeat step 6. **Pass:** job log ends with a PR URL.
10. Open the PR. **Pass:** single commit with the TOML diff; no other files changed.
11. Merge the PR. Return to hangar. **Pass:** next sync reads the merged SHA as the baseline.

### Multi-user

12. Open two browser windows, log in as two different users.
13. User A edits reference X; User B edits reference Y. Both save. **Pass:** both succeed.
14. User A opens reference Z, starts editing. User B opens reference Z, edits, saves. User A saves. **Pass:** User A sees a 409 page with a diff; can retry by reloading.

### Resilience

15. Trigger a sync, kill the hangar process mid-run (`ctrl-c` within 2 s). **Pass:** restart hangar; `/jobs/<id>` shows a `queued` status with a "recovered" log line; job completes on retry.
16. Manually edit `libs/db/seed/glossary.toml` out-of-band, save. Trigger a sync for a dirty reference. **Pass:** job fails with outcome `conflict`, log contains both diffs, DB rows remain dirty.

### Theme invariants

17. Toggle appearance (light/dark) in hangar. **Pass:** every route re-renders without flicker, contrast holds.
18. `curl hangar.airboss.test` with cookies unset. **Pass:** HTML has the pre-hydration theme script; first paint matches stored appearance.
19. Run the token-enforcement lint per [theme-system/03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md). **Pass:** zero violations in `apps/hangar/**`.
20. Run the contrast test suite. **Pass:** every (theme × appearance × role-pair) combination meets WCAG AA.

### Audit completeness

21. For every mutating action above, `select * from audit.event where target_type like 'hangar.%' order by at desc limit 20`. **Pass:** every action has an audit row with actor, target, and metadata.

## Review pass

- [ ] Code review (self + `/ball-review-full`)
- [ ] Spec drift check: does `spec.md` still match the shipped code? Update if not.
- [ ] Work package doc review (`status: done`, `review_status: done`)
