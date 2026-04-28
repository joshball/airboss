---
title: 'Spec: Apply Errata and AFH MOSAIC'
product: study
feature: apply-errata-and-afh-mosaic
type: spec
status: unread
---

# Spec: Apply Errata and AFH MOSAIC

Implement [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md)'s `--apply-errata` flow, build a discovery surface for FAA-published errata across all aviation handbooks, and apply the October 2025 MOSAIC addenda to the two currently-ingested handbooks (AFH and PHAK). Includes per-section diff UI in the reader so learners see *what changed* alongside the corrected text.

## Goals

1. Errata are downloaded, parsed, and applied to handbook section content with full audit trail.
2. The reader surfaces post-errata corrected text and exposes the original-vs-corrected diff with a link to the FAA source.
3. New errata published by the FAA are discovered automatically, surfaced for review, and committable with one command after review.
4. The ingestion engine routes per-handbook quirks through a plugin registry (one file per book), not engine-side branches.

## Non-goals

- CFR / AC / ACS / AIM amendment handling. ADR 020 is handbook-only; this WP follows.
- Cross-edition supersession (errata applying to a no-longer-current edition).
- Auto-apply of newly-discovered errata without human review (gated by parser-coverage criteria; see section below).
- Retroactive learner notification ("a section you read 3 weeks ago has changed"). Future work.
- Onboarding the other 14 handbooks for ingestion. Source-byte download for them is in scope; ingestion is not.

## Data Model

### `study.handbook_section_errata` (new table)

Per-section record of an applied erratum. Backs the diff UI.

| Column            | Type                                | Constraints                                                |
| ----------------- | ----------------------------------- | ---------------------------------------------------------- |
| `id`              | `text`                              | PK; `hbe_<ULID>`                                           |
| `section_id`      | `text`                              | FK -> `study.handbook_section.id`; ON DELETE CASCADE       |
| `errata_id`       | `text`                              | Errata identifier (e.g., `mosaic`); matches manifest entry |
| `source_url`      | `text`                              | NOT NULL                                                   |
| `published_at`    | `date`                              | NOT NULL                                                   |
| `applied_at`      | `timestamptz`                       | NOT NULL DEFAULT NOW()                                     |
| `patch_kind`      | `text`                              | One of: `add_subsection`, `append_paragraph`, `replace_paragraph` |
| `target_anchor`   | `text`                              | NULL allowed; e.g., `Preflight Assessment of the Aircraft` |
| `target_page`     | `text`                              | Printed page format, e.g., `2-4`                           |
| `original_text`   | `text`                              | NULL when `patch_kind = add_subsection`                    |
| `replacement_text`| `text`                              | NOT NULL                                                   |
| `created_at`      | `timestamptz`                       | NOT NULL DEFAULT NOW()                                     |

Index: `(section_id, applied_at DESC)` for "show me the patches on this section, newest first."

### `study.handbook_section.content_md`

Already exists. After errata applied, this column reflects post-errata text. The pre-errata text is recoverable from `handbook_section_errata.original_text` when present.

### `study.reference` (existing)

No new rows for errata. Errata are not independent citation sources per ADR 020.

### `manifest.json` (filesystem; not DB)

The handbook edition manifest gains an `errata` array. Each entry:

```json
{
  "id": "mosaic",
  "source_url": "https://www.faa.gov/...",
  "published_at": "2025-10-20",
  "sha256": "<computed at fetch>",
  "fetched_at": "<ISO timestamp>",
  "applied_at": "<ISO timestamp>",
  "parser": "additive-paragraph",
  "sections_patched": ["02-preflight-assessment", "04-energy-management", ...]
}
```

### Per-handbook YAML config (existing files; one new structured field)

`tools/handbook-ingest/ingest/config/<doc>.yaml` gains an `errata:` list. Replaces the current `# Errata: <url>` comment.

```yaml
errata:
  - id: mosaic
    source_url: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf
    published_at: '2025-10-20'
    parser: additive-paragraph
```

`bun run sources download` reads this and pulls each entry into the cache. `--reapply-errata` iterates the list.

### `<cache>/discovery/handbooks/<doc>.json` (new; cache-side state)

Per-handbook discovery state. Records last successful scrape, candidate errata found but not yet acted on. See [research/errata-discovery.md](research/errata-discovery.md) for layout.

### `<cache>/discovery/_last_run.json` (new)

Top-level freshness file:

```json
{
  "ran_at": "2026-04-28T14:00:00Z",
  "handbooks_scanned": 17,
  "candidates_found": 0
}
```

Backstop for the dev-server "run if older than 7 days" check.

## Behavior

### Errata application

When `bun run sources extract handbooks <doc> --apply-errata <url>` runs:

1. Resolves `<url>` against the YAML `errata:` list. If absent, refuses (errata must be declaratively recorded first).
2. Downloads the errata PDF to `<cache>/handbooks/<doc>/<edition>/_errata/<id>.pdf` using the standard cache fetch (HEAD-cached, SHA-256 computed).
3. Records SHA + `fetched_at` in `manifest.json -> errata[].sha256`, `fetched_at`.
4. Dispatches to the handbook plugin's `parse_errata(pdf_path, errata_entry)` method. The plugin returns `list[ErrataPatch]` (typed dataclass: `kind`, `chapter`, `section_anchor`, `target_page`, `original_text`, `replacement_text`).
5. For each patch:
   - Locates the affected `handbook_section` row by `(chapter, section_anchor, target_page)`.
   - Applies the patch to the section's source markdown (`<edition>/<chapter>/<section>.md`).
   - Writes a per-section errata note: `<edition>/<chapter>/<section>.errata.md` containing patch metadata + source URL.
   - Re-renders the section, recomputes `content_md` and `content_hash`.
   - Inserts a `handbook_section_errata` row with the original/replacement text and patch metadata.
6. Updates `manifest.json -> errata[]` with `applied_at`, `sections_patched`, `parser`.
7. Commits nothing automatically. The user reviews the diff and commits.

`--reapply-errata` iterates the YAML `errata:` list, applying each in `published_at` order. Idempotent: skips errata whose `applied_at` matches the manifest entry. Re-running after a parser change forces a re-apply.

### Discovery

`bun run sources discover-errata` (new dispatcher subcommand):

1. For each handbook in the configured catalogue (all ~17, not just ingested), the registered plugin's `discovery_url()` returns its FAA parent page.
2. Scrapes the page; extracts links matching the per-handbook addendum/errata patterns (the patterns are regex returned by each plugin to avoid filename-convention drift).
3. Diffs against `<cache>/discovery/handbooks/<doc>.json` last-known state. New URLs become *candidates*.
4. For each candidate, classifies as `actionable` (handbook is ingested) or `signal-only` (handbook is not ingested) using the plugin registry membership.
5. Writes the report to `<cache>/discovery/_pending.md` (markdown, one section per candidate). Updates `<cache>/discovery/_last_run.json`.
6. If `GH_TOKEN` is set and there are new candidates, opens a GitHub issue against the airboss repo titled `errata: <N> new candidate(s) detected`. Issue body links to `_pending.md` content. Idempotent: existing issue with the same set of candidate URLs gets updated, not duplicated.

Triggers (any one fires it; freshness-gated by `_last_run.json`):

- **Weekly launchd cron** (Sundays, 09:00 local).
- **On `bun run sources download`** as a side effect (free piggyback).
- **Dev-server startup hook** in `apps/study/`: if `_last_run.json` is missing or older than 7 days, fork a background process to run discovery. Server proceeds; failure is logged not fatal.

### Reader UI: amendment badge + diff panel

In `apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.svelte`:

- If the section has any `handbook_section_errata` rows, render an amendment badge near the section title: `Amended` (subtle pill, themed color).
- The badge is a button. Click expands a panel below the section title:
  - One entry per errata row, newest first.
  - Each entry shows: erratum id, published date, source URL (clickable to FAA PDF), patch kind, original text (when present) and replacement text in a side-by-side diff.
  - Diff rendering uses the existing diff library if one is in `libs/ui/`; otherwise a minimal `<del>` / `<ins>` inline format.
- Panel state: `$state` local, no persistence. Default closed.

### Per-handbook plugin architecture

`tools/handbook-ingest/ingest/handbooks/`:

- `base.py`: `class HandbookPlugin(ABC)` with abstract methods:
  - `parse_errata(self, pdf_path: Path, errata_entry: ErrataConfig) -> list[ErrataPatch]`
  - `discovery_url(self) -> str`
  - `discovery_link_patterns(self) -> list[re.Pattern]`
  - `body_quirks_pre(self, ...) -> ...` (default: passthrough)
  - `body_quirks_post(self, ...) -> ...` (default: passthrough)
- One file per book: `phak.py`, `afh.py`, `avwx.py`. Each subclasses `HandbookPlugin`, owning that book's quirks.
- `__init__.py`: registry. `get_handbook(slug) -> HandbookPlugin` raises `UnknownHandbookError` for unregistered slugs.

The engine (`cli.py`, `normalize.py`, `sections.py`) calls through the plugin. No `if slug == "phak"` branches anywhere.

### Errata parser layouts

`tools/handbook-ingest/ingest/errata_parsers/`:

- `base.py`: `class ErrataParser(ABC)` with `parse(pdf_path, errata_entry) -> list[ErrataPatch]`.
- One file per *layout*, not per handbook: `additive_paragraph.py` (covers MOSAIC), future `replacement_triplet.py`, `summary_of_changes_table.py`, etc.
- The handbook plugin picks which parser by reading the YAML `errata[].parser` field.

This separation matters: the AFH MOSAIC and PHAK MOSAIC addenda use the *same* additive-paragraph layout; one parser handles both. PHAK 25B's earlier addenda use a different layout and would get their own parser when ingested.

### MOSAIC application (concrete v1 deliverable)

Apply both addenda end-to-end:

- AFH MOSAIC: `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf`. 4 pages, additive patches across ~6 chapters.
- PHAK MOSAIC: `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf`. Verify chapters touched against the cached PDF during pre-flight.

Wide source coverage, narrow apply scope. The other three Oct 2025 MOSAIC addenda (Weight & Balance HB, WSC HB, PPC HB) are downloaded into the cache (per the byte-coverage phase below) and surface in discovery as `signal-only` until those handbooks are ingested.

### Source-byte coverage expansion

`bun run sources download` extends to fetch source PDFs for all 17 FAA aviation handbooks into the cache, plus their currently-published errata where known. Each download is HEAD-cached (no re-fetch if SHA matches). The bytes sit available for future ingestion; no parsing happens until a `<doc>.yaml` config is authored.

### ADR 020 amendment

ADR 020 line 44 currently says errata are "cumulative across the lifespan of an edition." Research found PHAK 25B's three sequential addenda (A, B, C) were incremental, not cumulative — addendum B does not re-state addendum A's contents. Update the ADR with a Revisions section dated 2026-04-28:

> 2026-04-28: clarify that errata may be **incremental** (each new sheet adds different content; addendum B does not re-state addendum A) or **cumulative** (the latest sheet supersedes earlier ones for the same edition). Both observed in FAA practice. The model handles both: `errata` is an ordered list keyed by `id`, applied in `published_at` order; `--reapply-errata` reapplies the full list.

## Validation

| Field                                | Rule                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `errata[].id`                        | Required, unique per `(doc, edition)`, kebab-case, 3-32 chars                              |
| `errata[].source_url`                | Required, must be HTTPS, must resolve (HEAD check at download time)                        |
| `errata[].published_at`              | Required, ISO 8601 date                                                                    |
| `errata[].parser`                    | Required, must match a registered parser name                                              |
| `handbook_section_errata.patch_kind` | Required, one of: `add_subsection`, `append_paragraph`, `replace_paragraph`                |
| `handbook_section_errata.target_page`| Required, printed-page format (e.g., `2-4`); rejected if PDF page integer                  |
| `handbook_section_errata.replacement_text` | Required, non-empty                                                                  |
| Discovery candidate URL              | Must be HTTPS, must match at least one plugin's `discovery_link_patterns`                  |
| Plugin registry slug                 | Must be lowercase, must match a YAML config filename                                       |

## Edge cases

| Case                                                            | Handling                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Errata for a handbook we haven't onboarded                      | Discovery flags as `signal-only`; no apply path. Logged in `_pending.md`.                                                             |
| Errata for an edition we no longer ingest (older edition)       | `--apply-errata` refuses with clear error. User must check out an older codebase or accept missing application.                       |
| Errata supersedes a prior errata mid-edition                    | The `--reapply-errata` flow re-applies in `published_at` order. If parser logic produces different patches, last write wins (intentional). |
| Errata PDF format the parser doesn't recognize                  | Parser raises `UnknownErrataLayoutError`. CLI exits non-zero, logs the unrecognized markers, no DB writes.                            |
| FAA pulls an erratum URL                                        | Discovery scrape returns 404 for a known URL. Mark candidate as `withdrawn` in state file; existing applied errata remain in DB.       |
| Discovery scrape fails (network, FAA outage)                    | Logged warning; `_last_run.json` not updated. Next trigger retries. Server startup proceeds.                                          |
| Multiple errata patch the same section                          | One `handbook_section_errata` row per erratum; section content reflects all patches in `published_at` order.                          |
| Section added by an erratum (entirely new subsection)           | Insert as a new `handbook_section` row plus a `handbook_section_errata` row marking it as errata-introduced.                          |
| User runs `--apply-errata` twice without `--force`              | Second run is a no-op (manifest `applied_at` matches). With `--force`, re-applies; old `handbook_section_errata` rows deleted, new ones inserted. |
| Reader requested for a section while errata is being applied    | Reader serves whatever is currently in the DB. Apply runs in a transaction; readers see pre-apply or post-apply state, not partial.    |
| Discovery finds a candidate matching no plugin's patterns       | Surfaced in `_pending.md` as `unmatched` with the URL. User can either teach a plugin the new pattern or dismiss.                     |
| `GH_TOKEN` is unset and discovery has new candidates            | GitHub issue creation skipped silently; `_pending.md` still written. Dispatcher banner still fires.                                   |

## Out of Scope

- Auto-apply of newly-discovered errata without human review. Gated on parser coverage (≥3 distinct addendum layouts proven via unit tests + dry-run zero-diff against human-applied output). Until then, every apply requires explicit user invocation.
- Errata for any handbook other than AFH and PHAK in v1. Discovery surfaces them; application waits until those handbooks are ingested.
- Hangar UI for discovery and apply. The hangar app does not exist yet. CLI surfaces are designed to be wrappable later — every CLI command is structured so a future hangar route can call it via dispatcher or HTTP wrapper.
- DRS portal scraping. Discovery report includes a manual DRS search link only.
- Section-level "what changed since I last read this?" notification to learners. Stored data supports it; UI is future work.
- Email notifications. Cache file + GitHub issue + dispatcher banner cover the v1 needs.
- Cross-edition errata (errata that apply to multiple editions). FAA practice is one-erratum-per-edition; if that ever changes, revisit.

## Open questions resolved during scoping

These were explicit decisions made by the user in scoping conversation; recording here for future reference:

1. **Both phases included** (corrected text + diff UI). ADR 020 originally deferred the diff UI; here it ships in v1 because "what changed?" is the actual learning question for MOSAIC.
2. **Discovery scope: all ~17 handbooks, with `actionable` vs `signal-only` flag, default-on.** Cheap signal; tells us when to onboard a new handbook.
3. **Schedule: weekly launchd cron + on `bun run sources download` + dev-server startup freshness check.** All three triggers, freshness-gated.
4. **Notification: cache file + dispatcher banner + auto-open GitHub issue (when `GH_TOKEN` set).**
5. **Auto-apply gate: format-coverage based.** ≥3 distinct addendum layouts proven via unit tests + dry-run zero-diff. Not a count-of-applies gate.
6. **DRS: link-only.** No scraping.
7. **YAML extension: structured `errata:` list, in this WP.**
8. **PHAK MOSAIC included alongside AFH MOSAIC in v1.**
9. **Per-handbook plugin architecture: one file per book.** Refactor existing PHAK/AFH/AvWX into the registry as Phase R1, before any new errata logic lands.

## Open questions for the user (post-scoping)

These need answers before `/ball-wp-build` runs but did not block authoring:

- **Q1.** Diff badge label: `Amended` (recommended), `Updated`, `Errata`, or `Changed`? Question is brand voice.
- **Q2.** GitHub issue label name: `errata` (recommended), `errata-discovered`, or use existing label?
- **Q3.** Where does the dispatcher banner ("3 unreviewed discovery results") render? Top of every `bun run sources …` output, or only on `download` and `extract`?
- **Q4.** When an erratum supersedes a prior erratum on the same section, do we keep both `handbook_section_errata` rows for audit, or replace? Recommendation: keep both.
