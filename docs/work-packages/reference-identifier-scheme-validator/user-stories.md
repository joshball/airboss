---
title: 'User stories: Reference identifier scheme validator'
product: cross-cutting
feature: reference-identifier-scheme-validator
type: user-stories
status: unread
review_status: pending
---

# User stories: Reference identifier scheme validator

Author-side and platform-side. The validator is platform infrastructure; the people it serves are lesson authors, content stewards, CI, and the future engineers who will extend it during Phases 2+.

## Personas

- **Author**: a lesson writer adding canonical-corpus references (CFR, AIM, AC, etc.) to a lesson. Today: writing prose with plain eCFR URLs. Tomorrow (Phase 9 migration): writing `airboss-ref:` URIs that auto-stamp pins via `--fix`.
- **Reviewer**: PR reviewer reading a lesson's diff. Wants to see at a glance whether references are well-formed without running the build locally.
- **CI**: the unattended `bun run check` that runs on every PR. Must fail on ERROR-tier findings; must report WARNING and NOTICE without failing.
- **Phase-2 engineer**: the implementer of the registry. Imports `RegistryReader` and the type set from `@ab/sources` and fills the stub.

## US-1: Author writes an identifier; CI catches a typo

**As** an author,
**I want** the build to fail when I write an identifier that doesn't resolve,
**so that** I can't merge a lesson that links to nothing.

### Acceptance criteria

- I add `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` to a lesson.
- I run `bun run check`.
- Phase 1 result: ERROR row 2 ("identifier does not resolve to an accepted entry") because the registry stub returns nothing today. Check exits non-zero.
- Phase 2 result (after registry-core lands and CFR is ingested): clean exit. Identifier resolves; no findings.
- The error message tells me which rule fired and where in the source.

### Out of scope

- Auto-fixing the typo. The validator points at the problem; the author fixes it.

## US-2: Author uses the `unknown:` escape hatch during a transition

**As** an author,
**I want** to mark a reference as "transitional" while I wait for the corpus to be ingested,
**so that** I can keep writing the lesson without leaving a placeholder URL that pretends to be real.

### Acceptance criteria

- I add `[Mangiamele letter (2009)](airboss-ref:unknown/mangiamele-cost-sharing)` to a lesson.
- I run `bun run check` locally.
- Result: ERROR row 0 with the message "Transitional reference; cannot publish. Replace with a real identifier or wait for ingestion of the relevant corpus."
- I can keep editing the lesson and committing locally; the lesson cannot merge until I replace the `unknown:` references.
- A grep over the lesson set shows me every `unknown:` placeholder so I can prioritise corpus ingestion.

### Out of scope

- Automatic rewrite of `unknown:` placeholders when the corpus lands. That tool ships in Phase 9.

## US-3: Author writes an identifier with a path-absolute form by accident

**As** an author,
**I want** the validator to tell me clearly when my identifier is shaped wrong,
**so that** I don't spend time guessing why my link "looks fine" but doesn't resolve.

### Acceptance criteria

- I write `[@cite](airboss-ref:/regs/cfr-14/91/103?at=2026)` (extra leading slash).
- `bun run check` exits non-zero with ERROR row 1 and the specific message: "path-absolute form is not canonical; use path-rootless `airboss-ref:<corpus>/...`".
- The error includes file, line, and column.
- Same behavior for `airboss-ref://...` (authority-based form), with its own specific message.

### Out of scope

- Suggesting the corrected URL automatically (the message is precise enough; auto-fix is Phase 2 territory).

## US-4: Author writes a frontmatter acknowledgment for a superseded letter

**As** an author,
**I want** to acknowledge that a Chief Counsel letter has been superseded but my lesson's claim still holds,
**so that** the WARNING goes away and the renderer adds the proper "(acknowledged supersession)" annotation in Phase 4.

### Acceptance criteria

- I add an `acknowledgments` entry to lesson frontmatter:

  ```yaml
  acknowledgments:
    - target: airboss-ref:interp/chief-counsel/walker-2017
      superseder: airboss-ref:interp/chief-counsel/smith-2027
      reason: original-intact
      note: "Smith narrows but does not overturn the active-investigation standard cited here."
  ```

- The lesson body links the Walker letter.
- `bun run check`: ack shape valid; no orphan-ack warning; no malformed-YAML error.
- (Phase 2+) Once the registry has both letters and the supersession chain is populated, the row-13 WARNING ("reference to superseded entry without `acknowledgments` entry") is suppressed for this lesson.

### Out of scope

- The renderer's "(acknowledged supersession)" annotation. Phase 4.

## US-5: Author has two acknowledgments for the same target with different reasons

**As** an author,
**I want** to have two different acknowledgments for the same Chief Counsel letter (different facets), with different reasons,
**so that** the renderer can attach the right ack to the right specific reference.

### Acceptance criteria

- I add two `acknowledgments` entries with the same `target` but different `id` values:

  ```yaml
  acknowledgments:
    - id: mangiamele-cost-sharing
      target: airboss-ref:interp/chief-counsel/mangiamele-2009
      ...
    - id: mangiamele-compensation
      target: airboss-ref:interp/chief-counsel/mangiamele-2009
      ...
  ```

- In the body, I use Markdown reference-style links to bind:

  ```markdown
  The [Mangiamele letter (2009)][mangiamele-cost-sharing] established the limit on cost-sharing.

  [mangiamele-cost-sharing]: airboss-ref:interp/chief-counsel/mangiamele-2009
  ```

- `bun run check`: bindings resolve; no errors.
- If I forget to use a reference label and have two acks for the same target, the validator emits ERROR ("when one lesson has multiple acks for the same target, every binding link must have an explicit reference label").

### Out of scope

- The renderer's per-binding annotation. Phase 4.

## US-6: Reviewer reads a lesson PR; sees clear validation output in CI

**As** a reviewer,
**I want** the CI log to clearly separate ERRORs from WARNINGs and NOTICEs,
**so that** I know what blocks the merge and what doesn't.

### Acceptance criteria

- The CI log has a "Reference identifier validation" section.
- ERROR findings print with `error:` prefix, full file path with line:column, the rule number, and the message.
- WARNING findings print with `warn:` prefix similarly.
- NOTICE findings print with `notice:` prefix similarly.
- The summary line names counts per tier: "25 lessons checked, 47 identifiers found, 0 errors, 3 warnings, 5 notices".
- ERROR exits the step non-zero; WARNING and NOTICE do not.

### Out of scope

- Inline annotations on the PR file diff. Possible future GitHub-app integration; not Phase 1.

## US-7: CI runs on a PR branch that's gone stale

**As** CI,
**I want** to re-run on a stale PR branch (opened weeks ago, main has advanced) and produce useful output,
**so that** the PR can still merge if its references are still well-formed, or fail clearly if they're not.

### Acceptance criteria

- A PR opened with `?at=2026` references sits unreviewed for 60 days. Main advances; the registry now has `2027` as `accepted` for the relevant corpus.
- `bun run check` re-runs on the stale PR branch.
- Result: row-6 WARNING for any pin > 1 edition stale (e.g. if `2025` was the pin and `2027` is now current, > 1 distance fires). WARNING does NOT block; PR can still merge.
- If the pin is `2026` and current is `2027`, the distance is 1 -- no WARNING. Clean.
- The author can run `--fix` locally (Phase 2 deliverable) to advance pins.

### Out of scope

- The `--fix` mode itself. Phase 2.

## US-8: Phase-2 engineer extends the validator with the real registry

**As** a Phase-2 engineer building `reference-source-registry-core`,
**I want** to drop in a real `RegistryReader` implementation without touching the validator,
**so that** the seam holds and Phase 1's tests remain valid.

### Acceptance criteria

- I import `RegistryReader` from `@ab/sources/types`.
- I implement it against the constants table I'm building in `@ab/sources/registry.ts`.
- I export a `productionRegistry` instance from `@ab/sources`.
- `scripts/check.ts` switches from `NULL_REGISTRY` to `productionRegistry` -- one line change.
- The validator's behavior changes: identifiers that resolve no longer fire row 2; identifiers with valid pins no longer fire row 3; etc. The Phase 1 tests that injected fixture readers still pass; new tests cover the production-registry-backed cases.

### Out of scope

- The `--fix` mode (also Phase 2; separate WP item).
- Per-corpus resolvers (each ships with its own ingestion phase).

## US-9: Author writes a bare URL in prose

**As** an author,
**I want** a gentle nudge if I write a bare `airboss-ref:` URL outside a Markdown link,
**so that** I'm reminded to wrap it in `[text](url)` for proper rendering.

### Acceptance criteria

- I write `See airboss-ref:regs/cfr-14/91/103?at=2026 for the rule.` (no Markdown link wrapping).
- `bun run check`: NOTICE row 8 printed. Check does not fail on this notice alone.
- (After Phase 2 lands and the registry has the entry, the only finding is the NOTICE; no ERROR.)
- I see the NOTICE in CI; I can fix it before merge or leave it (NOTICE is not blocking by design -- some lessons may legitimately mention an identifier without linking).

### Out of scope

- IDE-side surfacing of NOTICE. Future enhancement; Phase 1 prints to stdout.

## US-10: Lesson author writes lazy link text

**As** the platform,
**I want** to nudge authors away from "lazy" link text that just echoes the section number,
**so that** the rendered output uses substituted tokens (richer, more readable).

### Acceptance criteria

- An author writes `[91.103](airboss-ref:regs/cfr-14/91/103?at=2026)` -- the link text is just the section number.
- `bun run check`: NOTICE row 9 with a hint to use `@cite` or `@short`.
- The NOTICE doesn't fail the build; the author can keep the lazy text or fix it.

### Out of scope

- Auto-rewriting lazy text. Authors decide whether the lazy form is intentional in their context.
