---
title: 'Review: Source cache flat naming'
product: platform
feature: source-cache-flat-naming
type: review
status: unread
review_status: done
reviewer: claude (opus 4.7)
reviewed_at: 2026-04-29
target: spec.md
addressed_at: 2026-04-29
addressed_in_commit: pending
---

> All 15 items addressed in spec.md as of 2026-04-29. Audit log:
>
> 1. Per-edition handbook manifest path locked in §1 item 4 ("co-located with the bytes, NOT at the slug level").
> 2. ACS plans emit `edition: null`; manifest records `null` (§A row).
> 3. All ACs flat regardless of revision (§A row rewritten).
> 4. AIM self-description paragraph added after rationale table.
> 5. Migration script: two-commit lifecycle (commit A adds + runs, commit B deletes), interactive operator action, never run by CI (§G).
> 6. Idempotency rules: 4 explicit cases including "both old AND new exist -> prefer new, leave old as orphan, log warning, do NOT delete old" (§G).
> 7. Re-download acceptance softened to "zero PDF body downloads; HEAD requests expected".
> 8. `'current'` checklist tightened to "value of `DownloadPlan.edition` or `PdfTarget.edition`", verified by reading the file not grep.
> 9. ADR 021 created as deliverable (§1 item 10); ADR 018 receives one-line superseded-by pointer, no other rewrites (§E rows).
> 10. Acceptance criterion relaxed from byte-equal to semantic-equal (chapter/section/figure count + section ID stability).
> 11. Per-corpus manifest atomicity: write-to-tmp-then-rename, single-writer-per-corpus assumption documented (§F).
> 12. AVWX example annotated: "no published errata as of 2026-04-29".
> 13. prompts-out risk row resolved: "Decision: dropped" with verification (`rg` returned zero hits).
> 14. File-reference style convention added at top of punch list (single-line for one statement, range for a block).
> 15. TS vs Python path-construction relationship: independent implementations targeting same on-disk shape, no shared lib (§C preamble).

# Review: Source cache flat naming spec

Strong spec overall. The kind of one-shot, no-compat-shim cleanup the project explicitly wants: clear scope, file:line punch list, deletion checklist, risk register that names real failure modes. Spot-checked file:line refs ([scripts/sources/download/plans.ts](../../../scripts/sources/download/plans.ts), [scripts/sources/download/symlink.ts](../../../scripts/sources/download/symlink.ts)) match reality.

**Verdict:** ready to ship after the items below are addressed. Most are tightening, not rework.

## Must fix

### 1. Manifest path inconsistency for handbooks vs flat corpora

§1 specifies a per-edition handbook manifest at `handbooks/<slug>/<edition>/manifest.json`, but §A line 188 says "for handbooks, keep alongside the doc dir." Is "doc dir" `<slug>/` or `<slug>/<edition>/`? Pick one and say it once.

**Recommendation:** per-edition (`<slug>/<edition>/manifest.json`) since it co-locates with the bytes and matches the §F schema. Fix the wording in §A:188 accordingly.

### 2. ACS `edition: null` vs `edition: 'current'` mismatch

§A:178 says "Drop the edition entirely from ACS plans; flat at `acs/<doc-id>.pdf`." But §F's `CorpusManifestEntry` says `edition: string | null` and §H says "`'current'` as a synthesized edition value (the YAML/manifest may still record `null` or omit)."

Are ACS entries `edition: null`, missing entirely, or still present in the plan but dropped at write time? Lock down: the plan emits `edition: null`, the manifest records `null`, and §H is the authority.

### 3. AC handling is half-specified

§A:177 says "AC without revision goes flat at `ac/<doc-id>.pdf` (no edition dir)." But ACs *with* revision (the common case, `ac-61-65-j`) are also flat in §1's example. So all ACs go flat regardless of revision; the doc-id already encodes the revision letter. The table reads as if "no revision" is a special case.

**Recommendation:** rewrite §A:177 as "All ACs go flat at `ac/<doc-id>.pdf`. Drop the synthetic `'current'` edition entirely from `mkAc`."

### 4. AIM filename loses corpus context when moved

`aim/2026-04.pdf` matches the design rule ("filename echoes the edition") but unlike `FAA-H-8083-25C.pdf`, `2026-04.pdf` is not self-describing once moved out of its parent dir. Not broken, but worth a one-line acknowledgment that AIM's self-description comes from its parent dir because AIM has only one doc.

Alternative: rename to `aim-2026-04.pdf` for symmetry. Probably overkill but flag it.

### 5. Migration script lifecycle: "deleted in same PR" needs to specify *how*

§7, §G, and §H all say the migration script lands and is deleted in the same PR. Two adjacent commits is the natural model, but the spec should state it explicitly: "First commit adds and runs the script locally; second commit removes it. Both ride in the PR." Otherwise a reviewer will ask "why was this added and immediately deleted."

Also: the script is interactive and the user runs it once; no CI ever sees it. State that.

### 6. Idempotency under partial migration (§G line 328)

"If the script encounters a file already in the new layout … it skips that file silently." Good. But what if **both** old and new exist (partial run interrupted mid-rename)? Spec should say: prefer new layout file, leave old as orphan, log a warning, do not delete the old one (user inspects). Otherwise a crash-mid-rename plus re-run could destroy the only good copy.

### 7. Acceptance criterion for re-download is too strict

§Acceptance: "`bun run sources download handbooks` against the renamed cache makes zero network requests (HEAD-cache hit on every entry)."

HEAD-cache requires the manifest to record `etag`/`last-modified` and the server to still return matching values. If the FAA rotates a header in the wild between migration and verification, this test fails for reasons unrelated to the WP.

**Recommendation:** soften to "zero *PDF body* downloads; HEAD requests are expected" or "the download script reports all entries as cache-resolved without re-fetching the body."

## Should fix

### 8. `'current'` in the deletion checklist is ambiguous (§H line 343)

"String: `'current'` as a synthesized edition value." A `git grep 'current'` will hit unrelated noise (`current_user`, `currentMonthEdition`, `Current behavior` table headers in this very spec).

**Recommendation:** tighten to "the literal string `'current'` *as a value of `DownloadPlan.edition` or `PdfTarget.edition`*." A grep checklist that produces false positives degrades into "agent eyeballs the hits and decides," which is the kind of stop-and-ask state the project wants to avoid.

### 9. ADR amendment policy needs to match how this repo treats ADRs

§E:241 says ADR 018 "is amended (add an 'Update YYYY-MM-DD' note at top, do not retroactively rewrite history; **decision text** is updated to reflect the current truth)." This is internally contradictory: "do not rewrite history" but "decision text is updated."

Pick one:

- **(a)** ADR 018 is superseded by a new ADR (e.g. ADR 021, Source cache flat naming), and ADR 018's decision text gets a "superseded by ADR 021" pointer at top.
- **(b)** ADR 018 is amended in place with a clearly-marked update block; the rest of the file stays intact.

In airboss, immutable-once-approved is the rule, so option (a) is more consistent. If chosen, this WP needs to call out "create ADR 021" as a deliverable.

### 10. "byte-equal markdown" acceptance criterion (§Acceptance line 142)

"A handbook section-extraction run against the renamed PHAK PDF produces the same outputs as before the rename (byte-equal markdown, figures, manifest entries)."

Byte-equality assumes the manifest doesn't record the source path anywhere. If the existing extraction manifest writes `source_filename: "source.pdf"` into derivative output, byte-equality is impossible after rename, which is the point.

**Action:** either confirm derivative manifests don't reference the cache filename (Risk row I claims this is true for AC; verify for handbooks too), or relax to "semantic-equal: same chapters, sections, figure counts, and section_id stability."

### 11. Per-corpus manifest write-time ordering

§F doesn't address: when a download adds one new entry to a 12-entry manifest, is the whole file rewritten atomically? Concurrent `sources download ac` runs would race.

**Recommendation:** specify write-to-tmp-then-rename, and serialize per-corpus (one writer at a time per corpus dir). This was implicit with per-doc manifests; per-corpus introduces shared state.

## Nits

### 12. AVWX example missing errata file

The AVWX example in §1 has no errata file but PHAK and AFH do. Either add one or note "AVWX has no published errata as of 2026-04-29."

### 13. §I risk register row about prompts-out violates project rule

"Out of scope, regenerated on next extraction run. Note in tasks.md as a follow-up if the user wants." Per CLAUDE.md ("No undecided 'considerations for future work'"), this needs to be resolved in the same WP: either truly out of scope (drop the "if the user wants") or in tasks.md (say "added to tasks.md, item N"). "Maybe add a follow-up" is the exact pattern the project rule prohibits.

### 14. File reference style inconsistency

Some links use `#L30-L36` ranges, others use bare `#L30`. Both work in GitHub; pick one for consistency.

### 15. Missing: Python ingest's relationship to plans.ts

§C lists Python file changes; §A lists TS plan changes. The spec doesn't address whether [scripts/sources/download/plans.ts](../../../scripts/sources/download/plans.ts) and [tools/handbook-ingest/ingest/paths.py](../../../tools/handbook-ingest/ingest/paths.py) need to share a path-construction contract, or are independently rewriting toward the same flat layout. Independent is fine (they both target the same on-disk shape) but state it.

## Summary

High-fidelity, grounded in real file:line evidence. The plan is correct and matches the project's "kill the half-migrated state in one PR" rule. The fixes above mostly remove ambiguity where a future implementer would have to make a judgment call, especially the manifest-path inconsistency (#1), the ACS `edition` representation (#2), and the ADR 018 amendment vs. supersedure question (#9). #6 (idempotency on crash mid-run) is the only real bug; the rest are tightening.
