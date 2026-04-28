---
title: "Research: FAA Handbook Errata Discovery"
type: research
status: complete
---

# Research: FAA Handbook Errata Discovery

ADR 020 defines how airboss *applies* an errata once we know about it. ADR 020 line 275 explicitly defers the question of how we *find out* about a new errata in the first place. This document closes that gap: it surveys the FAA's actual publishing surfaces for handbook corrections and proposes a discovery design that slots into the existing `bun run sources download` pipeline.

All citations were collected on 2026-04-27. FAA pages 403 against unauthenticated agent fetches; everything documented here was confirmed via web search results and cross-referenced URLs that are publicly indexable. URLs that are 200-direct-fetchable in a normal browser are listed; the FAA's anti-bot posture is itself part of the design constraint.

## Findings

### 1. Discovery surfaces

| Surface                                     | Available?                              | Useful for errata discovery?                                                                                                                         |
| ------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| RSS / Atom for handbooks-manuals            | No                                      | The FAA publishes RSS feeds for ADs, SAIBs, and press releases (FAASafety.gov has a feed list page) but none is scoped to handbook corrections.      |
| "What's new" page for the handbook series   | No dedicated page                       | The aviation-handbooks index page lists handbooks; there is no per-series changelog, no "recent updates" rail, and no dated activity stream.         |
| JSON / data API (data.faa.gov, api.faa.gov) | Yes, but not for handbooks              | data.faa.gov and api.faa.gov publish operational datasets (NOTAMs, aero data, weather). No API exposes handbook publication or errata metadata.     |
| Per-handbook parent page changelog          | Partial, freeform                       | Each handbook landing page (e.g. AFH page, PHAK page) lists the bound PDF plus any addendum/errata/summary-of-changes PDFs as plain links, not as a structured table. The page metadata sometimes shows a "last updated" date but it does not reliably move when a new addendum drops. |
| Federal Register notices                    | Almost never for handbook errata        | A search on federalregister.gov for FAA + "handbook" + "addendum"/"errata" turns up environmental-assessment errata and procedural rulemaking; the MOSAIC handbook addenda from October 2025 do **not** have an FR notice. The MOSAIC final *rule* has FR coverage; the handbook addenda that operationalize it do not. |
| FAA GovDelivery email subscriptions         | Yes (USAFAA + USFAAMMEL accounts)       | The FAA runs GovDelivery accounts for general updates and for FSIMS/MMEL. Topic catalogues are gated behind the subscribe form so we cannot enumerate them without subscribing; community reports indicate handbook-publication topics are not granular enough to use as an errata trigger. |
| Dynamic Regulatory System (DRS)             | Yes, search UI; no documented API       | DRS is the FAA's unified knowledge center (more than 65 document types, more than two million documents). The browse and search surfaces are HTML; there is no documented public JSON endpoint for "documents added since date X". DRS *does* index handbooks and addenda when they are published, so it is the most authoritative single surface, but it is not directly machine-consumable today. |

Conclusion: there is no first-party feed, API, or structured changelog for handbook errata. Discovery is, today, "watch the parent page for the handbook." Everything else either does not cover this content (RSS, FR, data APIs) or covers it without a stable consumption contract (DRS, GovDelivery).

Sources:

- [Aviation Handbooks & Manuals index](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation)
- [Airplane Flying Handbook page](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook)
- [PHAK page](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak)
- [FAASafety.gov RSS feed list](https://www.faasafety.gov/RSS/Feed_List.aspx)
- [FAA GovDelivery (USAFAA)](https://public.govdelivery.com/accounts/USAFAA/subscriber/new)
- [FAA Flight Standards GovDelivery (USFAAMMEL)](https://service.govdelivery.com/accounts/USFAAMMEL/subscriber/new)
- [FAA Data Portal](https://www.faa.gov/data)
- [FAA API Portal](https://api.faa.gov/s/)
- [Dynamic Regulatory System (DRS)](https://drs.faa.gov/)

### 2. Naming conventions

Real published examples (URLs verified via web search 2026-04-27):

| Document                                          | URL filename                                   | URL prefix                                                          |
| ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| AFH (8083-3C) MOSAIC addendum (Oct 2025)          | `AFH_Addendum_(MOSAIC).pdf`                    | `/regulations_policies/handbooks_manuals/aviation/`                 |
| PHAK (8083-25C) MOSAIC addendum (Oct 2025)        | `PHAK_Addendum_(MOSAIC).pdf`                   | `/regulations_policies/handbooks_manuals/aviation/`                 |
| Weight & Balance HB (8083-1B) MOSAIC addendum     | `Weight_Balance_HB_Addendum_(MOSAIC).pdf`      | `/regulations_policies/handbooks_manuals/aviation/`                 |
| Weight-Shift Control HB MOSAIC addendum           | `WSC_HB_Addendum_(MOSAIC).pdf`                 | `/regulations_policies/handbooks_manuals/aviation/`                 |
| Powered Parachute HB MOSAIC addendum              | `PPC_HB_Addendum_(MOSAIC).pdf`                 | `/regulations_policies/handbooks_manuals/aviation/`                 |
| PHAK 25B Addendum A (Feb 2021)                    | `phak_addendum_a.pdf`                          | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/` |
| PHAK 25B Addendum B (Jan 2022)                    | `phak_addendum_b.pdf`                          | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/` |
| IFH (8083-15B) Errata (Oct 2014)                  | `ifh_errata.pdf`                               | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/` |
| IFH (8083-15B) AOA Indicators Addendum            | `ifh_addendum.pdf`                             | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/` |
| Glider Flying HB Errata Sheet                     | `glider_flying_handbook_errata_13a.pdf`        | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/` |
| Balloon Flying HB Addendum (SPAR, 2016)           | `balloon_flying_hb_addendum.pdf`               | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/` |
| WSC HB Addendum (older)                           | `wsc_hb_addendum.pdf`                          | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/` |
| IPH (8083-16B) Summary of Changes                 | `FAA-H-8083-16B-3_Summary_of_Changes.pdf`      | `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/` |

Three observations:

1. **The naming is famously inconsistent.** The 2025 MOSAIC cohort uses Title-Case with parenthesised slug (`AFH_Addendum_(MOSAIC).pdf`). The pre-2025 cohort uses lowercase snake (`phak_addendum_a.pdf`, `ifh_errata.pdf`, `wsc_hb_addendum.pdf`). The Glider example embeds an edition+sequence (`glider_flying_handbook_errata_13a.pdf`). The IPH uses a fully qualified document ID (`FAA-H-8083-16B-3_Summary_of_Changes.pdf`). There is no enforced convention.
2. **The URL prefix changed.** Older artifacts live under `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/`. The October 2025 MOSAIC cohort lives under `/regulations_policies/handbooks_manuals/aviation/` (no `/sites/faa.gov/files`). Both prefixes are currently active. Future addenda may use either.
3. **The vocabulary varies.** `Addendum`, `Errata`, `Summary_of_Changes`, `Update`, and `Change` all appear. They are not used consistently: the 2025 MOSAIC cohort calls itself an addendum even though it is functionally an errata in airboss's ADR-020 sense (small-scope corrections to specific paragraphs in an existing edition). The IFH 2014 sheet and the Glider sheet call themselves errata. The IPH uses "Summary of Changes" for what is actually a per-section change log.

Practical consequence: pattern-matching alone is not sufficient. Discovery cannot rely on a regex over PDF filenames; it must crawl the per-handbook parent page and treat any new PDF link near the bound edition as a candidate for review.

### 3. URL stability

Older addenda **are still live at their original URLs** in 2026-04. `phak_addendum_a.pdf` and `phak_addendum_b.pdf` from the 25B era still resolve, even though their content has been folded into the 25C bound edition (per the 2023 PHAK 25C release notes -- "minor revision that simply incorporates Addenda A, B, and C"). The Glider 13a errata sheet is also still reachable.

Errata URLs do not appear to rotate when a new edition supersedes them. They are also not removed when their content is folded into the new bound edition. They linger as historical artifacts. This is the opposite behaviour from the bound PDFs themselves (per ADR 020 §"What an FAA errata looks like in practice", the bound PDF is replaced edition-to-edition).

What this means for airboss: when an older errata gets folded into a new bound edition, the errata URL keeps resolving but its content is now stale relative to the canonical bound PDF. The discovery design must be edition-aware, not just URL-aware.

### 4. Cumulative vs incremental

Mixed. Both patterns are documented in real FAA practice:

- **Incremental.** PHAK 25B accumulated three separate addenda over two years (Addendum A in Feb 2021, B in Jan 2022, C in Mar 2023). Each addendum was a distinct PDF with a single-letter suffix. None superseded the prior; they were additive. When 25C dropped in July 2023, it merged all three into the bound edition.
- **Cumulative-by-replacement (less observed but possible).** The IFH 2014 errata (`ifh_errata.pdf`) is a single sheet, no suffix. If a second errata had been published for 15B, it would either have replaced this file at the same URL (true cumulative) or used a new filename (incremental). We cannot confirm which without the FAA actually doing it; the 15B edition has not had a second errata in the 12 years since.
- **Single-event addenda tied to a rule change.** The October 2025 MOSAIC cohort (AFH, PHAK, W&B, WSC, PPC) was published as a coordinated batch tied to the MOSAIC final-rule effective date. There is no expectation of a second MOSAIC addendum; if more handbook updates are needed for MOSAIC, they would land in the next bound edition.

ADR 020 line 44 currently reads "cumulative across the lifespan of an edition." This is one observed pattern but not the only one. The PHAK 25B Addendum A/B/C history is unambiguously incremental, not cumulative. The ADR's text should be softened to "the FAA may publish either a single sheet that is replaced in place, or a sequence of incremental sheets; airboss must handle both." The pipeline already does the right thing (apply each erratum in chronological order; the most recent wins per affected paragraph) so this is a documentation fix, not a code fix.

### 5. Cadence

Ad hoc. There is no schedule. Real-world data:

- PHAK 25B: three addenda in two years (Feb 2021, Jan 2022, Mar 2023), driven by a mix of medical-policy updates, nontowered-airport guidance, and instrument-related corrections.
- AFH 8083-3C: one addendum in four years of edition lifetime (Oct 2025, MOSAIC).
- IFH 8083-15B: one errata in twelve years of edition lifetime (Oct 2014).
- Glider Flying HB: at least one errata sheet (versioned `13a`).

Triggers observed: regulatory rule changes (MOSAIC), medical-guidance policy updates (drug-use coverage in 2021), reader-reported figure-caption corrections (IFH 2014). Cadence is therefore "event-driven, episodic, weeks-to-years between events." A weekly check is enough; a daily check is overkill.

## Discovery design

### A. Recommended discovery mechanism

**Primary mechanism: page scraping of each handbook's parent page, with HTML diffing as the change signal.**

The FAA does not publish a feed and does not expose a structured API for this content. The handbook parent page is the only surface where new errata reliably appear close to publication time. Scrape it.

The mechanism:

1. For each handbook airboss has onboarded, fetch the parent page (e.g. `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook`) with a browser-class User-Agent (the `download` pipeline already does this for the FAA's anti-bot posture).
2. Extract every `<a>` whose `href` points to a PDF under either `/regulations_policies/handbooks_manuals/aviation/` or `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/`.
3. Compare against the last-known set of PDF links for that handbook (stored in state -- see section C). Any URL that wasn't there before is a discovery candidate.
4. For each new candidate: HEAD-fetch it (capture content-length, last-modified, etag), classify by filename heuristics into `addendum | errata | summary_of_changes | other`, and emit a record into the discovery report.

Layered fallbacks (only if primary breaks):

- **Filename probing for known patterns.** If a new bound edition has just shipped (e.g. PHAK 25D) and we want to opportunistically check whether the prior edition's addenda are still up, probe the known historical URLs (`phak_addendum_a.pdf` etc.) with HEAD requests. Cheap, no new state.
- **DRS browse fallback.** If the parent page reorganises and the scrape stops finding PDFs, drop to a DRS query for the document ID. This is a manual step, not automatic; we surface it in the discovery report ("parent page yielded zero PDF links, expected at least one -- check DRS at <link>").
- **Federal Register watch.** Out of scope for v1. The FR rarely announces handbook errata, and when it does (as part of a rule package) the rule itself is a louder signal than the handbook patch. If we ever build a rule-tracker for `cert-syllabus`, FR coverage of handbook addenda comes along for free; it does not pay for its own discovery layer here.

Why scraping over RSS / API: there is no RSS or API. Why scraping over GovDelivery: GovDelivery is human-targeted email; subscribing it produces a noisy stream where handbook addenda are not a separate topic. Why scraping over manual: the user does not want to manually check pages; the entire point of this work is to automate that.

### B. Integration with `bun run sources download`

Airboss has a unified dispatcher in `scripts/sources.ts` and a per-corpus download module in `scripts/sources/download/`. The discovery surface should slot in as a peer command, not as a side effect of `download`:

```text
bun run sources download                    # existing: fetch source bytes (idempotent HEAD-check)
bun run sources discover-errata             # new: scan handbook parent pages, diff, report
bun run sources discover-errata --apply     # new: same, plus pipe accepted candidates into --apply-errata
```

Why a separate command, not a side effect of `download`:

- `download` is fast, idempotent, and HEAD-only on the happy path. Adding a parent-page scrape per corpus would slow it down and conflate two responsibilities.
- `discover-errata` has a different output shape: it is a *report* (here is what changed), not a fetch (here is what is now on disk). Mixing the two muddies exit codes and the operator runbook.
- A separate command makes a future cron job explicit. Cron runs `discover-errata`, posts the report, exits. It does not run `download` against every corpus weekly.

CLI surface for `discover-errata`:

```text
bun run sources discover-errata [--corpus=handbooks] [--doc=phak,afh,...] [--json] [--apply]

  --corpus     Restrict to a corpus. Currently only `handbooks` is meaningful;
               extend when AC and ACS pages add comparable scrape support.
  --doc        Comma-separated handbook slugs (phak, afh, avwx, ifh, iph, ...).
               Default: all onboarded handbooks (read from the per-handbook
               YAML configs under `tools/handbook-ingest/ingest/config/`).
  --json       Emit machine-readable JSON to stdout instead of human report.
  --apply      For each new candidate, prompt y/N. On y, invoke `--apply-errata`
               on the Python pipeline (per ADR 020). Default: report-only.
```

Exit codes:

- `0` -- ran successfully, no new errata candidates.
- `2` -- ran successfully, found new candidates (informational, not an error). Operator-friendly: `if grep -q changes; then notify`.
- `1` -- network or parse failure. The scrape is best-effort and tolerant: a single 403 should not kill the whole run; per-handbook failures are reported as `status: error` rows in the report and the command still exits non-zero only if every handbook failed.

Side effects:

- Updates the state file (section C) with the latest known PDF set per handbook.
- Writes a discovery log entry (`<cache>/discovery/<YYYY-MM-DD>.json`) for the audit trail.
- Without `--apply`, never touches the cache PDFs and never triggers extraction.

Cron / scheduling: out of scope for the implementation, but the design supports it. `discover-errata --json` produces machine-readable output that a launchd / cron / GitHub Actions job can post to a notification channel. We can ship the cron piece in a follow-up once the scrape itself is proven.

### C. State storage

**Recommendation: cache-side state file per handbook**, at `<cache>/discovery/handbooks/<doc>.json`. Not in the repo, not in the DB.

Shape:

```json
{
  "doc": "afh",
  "edition": "FAA-H-8083-3C",
  "parent_url": "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook",
  "last_scanned_at": "2026-04-27T14:22:00Z",
  "known_pdfs": [
    {
      "url": "https://www.faa.gov/.../00_afh_full.pdf",
      "filename": "00_afh_full.pdf",
      "first_seen_at": "2026-04-27T14:22:00Z",
      "classification": "bound_edition",
      "etag": "\"...\"",
      "last_modified": "2021-...",
      "content_length": 27348123
    },
    {
      "url": "https://www.faa.gov/.../AFH_Addendum_(MOSAIC).pdf",
      "filename": "AFH_Addendum_(MOSAIC).pdf",
      "first_seen_at": "2026-04-27T14:22:00Z",
      "classification": "addendum",
      "etag": "\"...\"",
      "last_modified": "2025-10-20T...",
      "content_length": 542100
    }
  ]
}
```

Rejected alternatives:

- **Per-handbook YAML config in the repo (current pattern, e.g. `afh.yaml`).** The YAML config is for declarative ingestion knobs (TOC page range, heading-style fingerprint, etc.) -- things a human curates once per edition. A discovery state file changes weekly; committing it pollutes the repo, generates noisy diffs, and conflates curated config with machine-maintained state. The config file *should* keep listing the canonical errata URLs the user has accepted (the YAML's `Errata:` comment is the right shape) -- that is curated. The discovery state is not.
- **Postgres table.** Overkill. The discovery process is a developer-tool, not a runtime system. Putting it in the DB couples ingestion-tooling state to schema migrations and seeding.
- **A single global state file (not per-handbook).** Possible but worse: a single file means concurrent `discover-errata --doc=phak` and `--doc=afh` runs collide. Per-handbook files are independent.

### D. Trigger from discovery to apply

**Manual review for v1.** Auto-apply is unsafe.

The flow:

1. `bun run sources discover-errata` reports new candidates.
2. The user (or a future agent) reads the report. For each candidate, they decide:
   a. Yes, apply -- add the URL to the per-handbook YAML's `Errata:` block (or equivalent declarative list), then run `bun run sources extract handbooks <doc> --edition <edition> --apply-errata <url>`.
   b. No, suppress -- mark the candidate as `ignored` in the state file (the next `discover-errata` will not re-flag it).
   c. Defer -- leave it in the report; it will be flagged again on the next run.
3. The `--apply` flag on `discover-errata` is convenience for case (a): it prompts y/N per candidate, and on y, mutates the YAML config + invokes the extract pipeline. Even with `--apply`, the human still confirms each candidate.

Why not auto-apply:

- The errata-extraction pipeline parses page references and replacement-text triplets out of an unstructured PDF. The naming heuristics in section A classify into `addendum | errata | summary_of_changes | other`, but the *parsing strategy* depends on internal layout, which is not knowable from the URL. An MOSAIC addendum is mostly prose ("The terms 'special light-sport aircraft' should be replaced with..."); an IFH errata is figure-caption corrections; a Summary of Changes is a chapter-by-chapter delta narrative. The parser for each is different.
- The FAA could publish a PDF that *looks* like an errata by URL but is actually a different artifact (a press release, a fact sheet, a notice of intent). A human glance at the first page disambiguates instantly; a script cannot.
- ADR 020 §"Errata SHA-256 mismatches" already requires explicit human action when an errata URL changes content. Auto-apply contradicts that policy.

When auto-apply could be safe (future, deferred): once the parser has succeeded against ten or more real errata of the same shape and the URL pattern is locked (e.g., `*_Addendum_(*).pdf` with a confirmed text-replacement layout), `discover-errata --apply --auto` becomes an option. Trigger to revisit: tenth successful errata application, no parser regressions in the prior nine.

### E. Edge cases

- **New errata for an edition we no longer ingest.** The user has moved to a new bound edition; the FAA publishes a late errata for the old one. `discover-errata` still flags it (the parent page may still link it). State file records it under the old edition's row. Default action: ignore. Phase-2 (per ADR 020) supports applying late errata to a superseded edition since the old reader still works; v1 of `discover-errata` reports it and lets the user decide.
- **Errata for a handbook we haven't onboarded yet.** `discover-errata` only scans onboarded handbooks (driven by the YAML config list). Unonboarded handbooks are invisible to discovery by design; they get attention when their YAML config is authored. This avoids spamming reports with twenty handbooks the user is not actively ingesting.
- **Errata that supersedes a prior errata mid-edition.** The state file records both URLs. The first one is marked `superseded_by_url: <new>` once the user applies the new one. Discovery does not auto-detect supersession (FAA does not signal it); the user marks it during apply. ADR 020's "most recent erratum wins per affected paragraph" still holds.
- **The FAA changes the URL or naming convention.** The next scrape sees a "missing" PDF (the bound edition link disappeared) and a "new" PDF (the renamed link appeared). Both are flagged. The report is honest about uncertainty: "PHAK bound edition link not found at expected path; possible candidate: `<new-url>`. Verify before continuing."
- **The FAA pulls an erratum.** Rare but documented (FAA has rescinded ACs in the past). If a previously-known PDF disappears from the parent page, `discover-errata` flags it as `status: removed`. State file marks the entry `removed_at: <timestamp>`. ADR 020's apply pipeline does NOT auto-revert; a removed erratum that has already been applied stays applied until the user explicitly re-runs extract with the erratum dropped from the YAML config.
- **The parent page's HTML layout changes.** The scrape extracts every PDF anchor under the relevant URL prefixes. As long as the parent page remains an HTML page with anchor tags, the scrape survives a layout reshuffle. If the FAA migrates to a JS-rendered SPA (it has not, as of 2026-04-27), the scrape breaks and we fall back to DRS browse. Trigger: the scrape returns zero PDF links for a handbook that should have at least one.
- **Multiple handbooks share an addendum (like the MOSAIC cohort).** Each handbook's parent page links its own copy. `discover-errata` finds AFH's MOSAIC addendum on the AFH page, PHAK's on the PHAK page, etc. They are tracked independently in their respective state files. No deduplication needed -- they are functionally per-handbook artifacts even when the underlying rule change is shared.

### F. What's required from the user (Joshua) for v1

Open questions, framed as decisions to make before this becomes a work-package phase:

1. **Schedule.** Should `discover-errata` run via cron / launchd, or stay opt-in (user runs it manually before a study session)? My read: opt-in for v1, automate later. Confirm?
2. **Notification surface.** When automation lands, where does a discovery report go? Options: file in `~/Documents/airboss-handbook-cache/discovery/`, GitHub issue auto-opened against the airboss repo, GovDelivery-style email to your address, no surface (tail the file manually). What fits your workflow?
3. **Onboarded handbooks list.** v1 covers PHAK / AFH / AvWX (the three with YAML configs). Do you want IFH, IPH, AIM, AIH, RFH, RM-HB, AMT-G, AMT-A, AMT-P, Sport Pilot, GLH, Balloon, Helicopter, WSC, PPC also covered for discovery (even before they're ingested)? Tradeoff: more handbooks scanned = more candidates to triage; less = errata for unonboarded handbooks goes unnoticed.
4. **Per-handbook YAML config: should accepted errata URLs be captured there?** Today the YAML has comments like `# Errata: <url>`. To make `discover-errata --apply` close the loop, those should become a structured `errata:` list (or equivalent). Want me to spec the YAML extension as part of the work package?
5. **ADR 020 amendment.** Section 4 of this report shows ADR 020 line 44's "cumulative across the lifespan of an edition" is incomplete. Want me to draft a tightening of that line as a separate small ADR or as an inline edit to ADR 020 in the same work package?
6. **DRS as a layered fallback: in or out?** The DRS browse surface is more authoritative than the parent page but has no documented API. We could add a manual "open DRS for this handbook" link to the discovery report (cheap), or invest in scraping DRS too (costly, brittle). v1 default: link to DRS in the report, do not scrape it. Confirm?
7. **Auto-apply trigger condition.** Section D above proposes "after ten successful errata applications, revisit auto-apply." Is that the right gate, or do you want a different trigger (e.g. after the parser is unit-tested against three distinct errata layouts)?

## Summary

There is no machine-readable surface for FAA handbook errata discovery. The handbook parent page is the only signal. The October 2025 MOSAIC addenda (AFH, PHAK, W&B, WSC, PPC), the 2021-2023 PHAK 25B addenda A/B/C, and the 2014 IFH errata together establish the relevant patterns: filenames are inconsistent, URLs are stable, cadence is event-driven, and both incremental and single-sheet patterns coexist. The recommended design is a per-handbook page scrape with cache-side state, exposed as `bun run sources discover-errata` with a manual review step before the existing `--apply-errata` pipeline is invoked. Auto-apply is unsafe for v1 and should not be reconsidered until the errata parser has a real track record.

The seven questions in section F are the gating decisions before this can be specced as a work package.

## References

Airboss internal:

- `docs/decisions/018-source-artifact-storage-policy/decision.md` -- where source bytes (and now errata bytes) live in the cache.
- `docs/decisions/020-handbook-edition-and-amendment-policy.md` -- the apply-errata model this discovery work feeds.
- `tools/handbook-ingest/ingest/config/afh.yaml` -- example of the per-handbook YAML config that will gain a structured `errata:` list.
- `tools/handbook-ingest/ingest/config/phak.yaml` -- ditto.
- `tools/handbook-ingest/ingest/config/avwx.yaml` -- ditto.
- `scripts/sources.ts` -- dispatcher where `discover-errata` slots in.
- `scripts/sources/download/index.ts` -- existing downloader; `discover-errata` reuses its HTTP and User-Agent plumbing.

External, fetched 2026-04-27:

- [Aviation Handbooks & Manuals index](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation)
- [Airplane Flying Handbook page](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook)
- [PHAK page](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak)
- [AFH MOSAIC Addendum (Oct 2025)](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_(MOSAIC).pdf)
- [PHAK MOSAIC Addendum (Oct 2025)](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf)
- [Weight & Balance HB MOSAIC Addendum](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/Weight_Balance_HB_Addendum_(MOSAIC).pdf)
- [WSC HB MOSAIC Addendum](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/WSC_HB_Addendum_(MOSAIC).pdf)
- [PPC HB MOSAIC Addendum](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PPC_HB_Addendum_(MOSAIC).pdf)
- [PHAK 25B Addendum A (Feb 2021)](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/phak_addendum_a.pdf)
- [PHAK 25B Addendum B (Jan 2022)](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/phak_addendum_b.pdf)
- [PHAK Addendum C (Mar 2023)](https://www.faa.gov/regulationspolicies/handbooksmanuals/aviation/phak-addendum-c)
- [IFH Errata (Oct 2014)](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/ifh_errata.pdf)
- [IFH AOA Indicators Addendum](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/ifh_addendum.pdf)
- [Glider Flying HB Errata](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/glider_flying_handbook_errata_13a.pdf)
- [Balloon Flying HB Addendum](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/balloon_flying_hb_addendum.pdf)
- [WSC HB Addendum (older)](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/wsc_hb_addendum.pdf)
- [IPH 16B Summary of Changes](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/FAA-H-8083-16B-3_Summary_of_Changes.pdf)
- [FAASafety.gov RSS feed list](https://www.faasafety.gov/RSS/Feed_List.aspx)
- [FAA GovDelivery (USAFAA)](https://public.govdelivery.com/accounts/USAFAA/subscriber/new)
- [FAA Flight Standards GovDelivery (USFAAMMEL)](https://service.govdelivery.com/accounts/USFAAMMEL/subscriber/new)
- [FAA Data Portal](https://www.faa.gov/data)
- [FAA API Portal](https://api.faa.gov/s/)
- [Dynamic Regulatory System (DRS)](https://drs.faa.gov/)
