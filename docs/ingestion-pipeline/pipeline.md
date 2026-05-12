# Reference ingestion pipeline

How FAA reference material — handbooks, regulations, advisory circulars, the AIM, ACS standards, and assorted pamphlets — flows from a publisher URL into queryable, citable in-app content.

This is a process doc. For the tools used at each step, see [tooling.md](tooling.md). For the inventory of what's ingested, see [inventory.md](inventory.md). For the current strategy menu (TOC parse vs prompt extraction vs whole-doc), see [section-extraction-strategies.md](section-extraction-strategies.md).

## The five steps

```text
1. Discover  →  2. Download  →  3. Extract  →  4. Register  →  5. Resolve & cite
   (yaml)        (cache)         (handbooks/)    (db tables)     (in-app)
```

Each step has a clear input, output, and command. Each is idempotent — running it twice produces the same artifacts. Each can fail in characteristic ways that are documented per-step below.

| Step              | Command                                   | Input                 | Output                                    |
| ----------------- | ----------------------------------------- | --------------------- | ----------------------------------------- |
| 1. Discover       | `bun run sources` (no args)               | (none)                | corpus catalogue                          |
| 2. Download       | `bun run sources download`                | YAML configs          | `~/Documents/airboss-handbook-cache/`     |
| 3. Extract        | `bun run sources extract handbooks <doc>` | cached PDF            | `handbooks/<slug>/<edition>/...` markdown |
| 4. Register       | `bun run sources register <corpus>`       | extracted derivatives | `sources_registry.*` tables               |
| 5. Resolve & cite | (in-app via `@ab/sources`)                | citation locator      | rendered chunk with provenance            |

## Step 1 — Discover

**Goal:** know what corpora exist and what command operates on each.

The `bun run sources` dispatcher prints a help index. Each subcommand has `--help` for details. The corpus list is defined by the YAML configs at [scripts/sources/config/](../../scripts/sources/config/) — one file per corpus type:

- [scripts/sources/config/regs.yaml](../../scripts/sources/config/regs.yaml) — CFR Title 14, Title 49
- [scripts/sources/config/aim.yaml](../../scripts/sources/config/aim.yaml) — Aeronautical Information Manual
- [scripts/sources/config/ac.yaml](../../scripts/sources/config/ac.yaml) — Advisory Circulars
- [scripts/sources/config/acs.yaml](../../scripts/sources/config/acs.yaml) — Airman Certification Standards
- [scripts/sources/config/handbooks/](../../scripts/sources/config/handbooks/) — chapter-aware handbooks (PHAK, AFH, AVWX)
- [scripts/sources/config/handbooks-extras.yaml](../../scripts/sources/config/handbooks-extras.yaml) — whole-doc handbooks (RMH, AIH, IFH, IPH, mtn-tips)

**Why two YAML conventions for handbooks.** Chapter-aware handbooks have per-chapter PDFs from the publisher and get the full TOC-driven section pipeline (Strategy A in [section-extraction-strategies.md](section-extraction-strategies.md)). Whole-doc handbooks ship as a single monolithic PDF with no per-chapter download — the chapter-aware pipeline can't ingest them, so they fall through to a simpler whole-doc loader.

**Anchors:** [ADR 019 §1.2](../decisions/019-reference-identifier-system/decision.md) defines the corpus catalogue. [scripts/README.sources.md](../../scripts/README.sources.md) is the operator runbook.

## Step 2 — Download

**Goal:** fetch source bytes from publishers into the developer-local cache. Never store source bytes in git.

```bash
bun run sources download                              # everything except handbook extras
bun run sources download --include-handbooks-extras   # also fetch RMH/AIH/IFH/IPH/mtn-tips
bun run sources download --only handbooks             # one corpus only
bun run sources download --dry-run                    # show plan, fetch nothing
```

The downloader walks each YAML config, expands per-doc URLs, HEAD-checks them, and skips files where `content-length` matches the cached size AND (`etag` matches OR `last-modified` hasn't advanced). Modified or new files get fetched and their `manifest.json` updated.

**Output layout** (per [ADR 021 — flat naming](../decisions/021-source-cache-flat-naming/decision.md)):

```text
~/Documents/airboss-handbook-cache/
├── ac/
│   ├── manifest.json
│   └── ac-61-65j.pdf
├── acs/
├── aim/
├── handbooks/
│   ├── faa-h-8083-25c/
│   │   ├── manifest.json
│   │   ├── faa-h-8083-25c.pdf      ← whole PDF (some publishers)
│   │   └── 01.pdf, 02.pdf, ...     ← per-chapter PDFs (chapter-aware)
│   └── faa-mtn-tips/
│       ├── manifest.json
│       └── faa-mtn-tips.pdf
└── regulations/
    └── ...
```

**Configurable cache root:** `$AIRBOSS_HANDBOOK_CACHE` env var. Default is `~/Documents/airboss-handbook-cache/`.

**Why source bytes are NOT in git:** [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md). Three-tier storage rule — cache (developer-local, gitignored), inline derivatives (in-repo markdown/JSON), generated artifacts (DB rows, gitignored). PDFs and audio masters belong in tier 1 only.

**Failure modes:**

- **HEAD returns 404.** Publisher URL changed. Update the YAML; surface the new URL.
- **HEAD says unchanged but local file is corrupted.** Force re-download with `--force` or delete the cache file.
- **Publisher rate-limits.** Re-run; the script's HEAD-first design means a re-run is cheap.

## Step 3 — Extract

**Goal:** turn cached PDF/HTML bytes into structured markdown derivatives in the repo.

There are three different extractors, picked by corpus shape.

### 3a. Chapter-aware handbooks (PHAK, AFH, AVWX)

```bash
bun run sources extract handbooks <slug> --edition <ed>
bun run sources extract handbooks phak --edition FAA-H-8083-25C
```

Driven by Python tooling at [tools/handbook-ingest/](../../tools/handbook-ingest/). Strategy menu in [section-extraction-strategies.md](section-extraction-strategies.md):

- **`toc`** (default) — parse the handbook's printed Table of Contents page using PyMuPDF (`fitz`) to get coordinates of TOC entries, deduce chapter/section/paragraph hierarchy, then map onto the body.
- **`prompt`** — fallback for when the TOC is unreliable. Emits a self-contained prompt set; the operator pastes it into a fresh Claude Code session; sub-agents fan out one-per-chapter and write JSON. See [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md). No API key needed — this is a manual paste-flow, not an SDK integration.
- **`compare`** — diffs `toc` vs `prompt` results and surfaces disagreements. Used to validate one strategy against the other.

**Output** (today's shape — the rename was performed in PR #490; spike artifacts archived at [docs/.archive/spikes/rename-generic-content-files/](../.archive/spikes/rename-generic-content-files/)):

```text
handbooks/phak/FAA-H-8083-25C/
├── manifest.json                              ← 850 sections[] entries
├── 01/
│   ├── index.md                               ← chapter overview
│   ├── 01-introduction.md                     ← section
│   ├── 02-history-of-flight.md
│   ├── 02-01-transcontinental-air-mail-route.md
│   └── ...60 more files
├── figures/
└── tables/
```

Each section file has YAML frontmatter:

```yaml
---
handbook: phak
edition: FAA-H-8083-25C
chapter_number: 1
section_title: Introduction To Flying
faa_pages: 1-1..1-24
source_url: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf
---
```

### 3b. Whole-doc handbooks (RMH, AIH, IFH, IPH, mtn-tips)

```bash
bun run sources register handbooks-extras
```

Extraction and registration are the same step here — `pdftotext` shells out, page text gets concatenated, written to `handbooks/<slug>/<edition>/document.md`. No section tree. The pipeline lives at [libs/sources/src/handbooks-extras/ingest.ts](../../libs/sources/src/handbooks-extras/ingest.ts).

**This is the weakest link in the pipeline today.** No heading recovery, no structure, just flat OCR-quality prose. See `tooling.md` for why `pdftotext` can't recover headings (PDF is rendering instructions, not structured text).

The proposed `body_override` mechanism (capture in [docs/platform/IDEAS.md](../platform/IDEAS.md)) lets us point the loader at a hand-curated markdown file instead of the raw `pdftotext` output. `mount-flying-select-all-text.md` at the repo root is the prototype override.

### 3c. AIM (HTML-driven)

```bash
bun run sources register aim
```

The AIM publishes as HTML, not PDF. The extractor at [libs/sources/src/aim/](../../libs/sources/src/aim/) parses the HTML structure directly into chapter/section/paragraph markdown. Output:

```text
aim/2026-04/
├── chapter-7/
│   ├── index.md
│   ├── section-1/
│   │   ├── index.md
│   │   ├── paragraph-1.md
│   │   └── ...
```

850+ `index.md` files — flagged for the same rename WP.

### 3d. CFR (XML-driven)

```bash
bun run sources register cfr
```

The eCFR publishes XML. The extractor parses Title 14 and Title 49 into `regulations/cfr-14/<date>/sections.json` (see [libs/sources/src/regs/](../../libs/sources/src/regs/)). Pure JSON, no markdown — the regulations are queried structurally rather than rendered as prose.

**Failure modes across all extractors:**

- **OCR garbage in `pdftotext` output.** Broken hyphens, glyph errors, lost heading hierarchy. Mitigated by per-doc overrides for whole-doc handbooks.
- **TOC parse fails because the publisher's TOC doesn't follow the expected layout.** Fall back to the prompt strategy.
- **Errata pairs go unrecognized.** Solved by the `apply-errata` Python module at [tools/handbook-ingest/ingest/apply_errata.py](../../tools/handbook-ingest/ingest/apply_errata.py). Errata files land alongside the primary as `<NN>-<slug>.errata.md`.
- **Cross-edition rename** (FAA renames a chapter between editions). Edition-scoped paths (`FAA-H-8083-25C` vs `FAA-H-8083-25D`) isolate the impact.

## Step 4 — Register

**Goal:** record source documents and editions in the database, attach them to a lifecycle state machine, and audit-log every promotion.

Each corpus has its own register command:

```bash
bun run sources register handbooks
bun run sources register handbooks-extras
bun run sources register aim
bun run sources register cfr
bun run sources register ac
bun run sources register acs
```

Under the hood ([libs/sources/src/registry/](../../libs/sources/src/registry/)):

1. Walk the extracted derivatives (or, for whole-doc, walk the cache + extract in one step).
2. Build a `SourceEntry` per (corpus, slug, edition) — id format `airboss-ref:<corpus>/<slug>/<edition>`.
3. Build an `Edition` record with `published_date`, `source_url`, `id`.
4. Write to the `sources_registry.sources` and `sources_registry.editions` tables (Drizzle ORM, no raw SQL).
5. Atomic batch promotion: every entry in the run goes from `pending` → `accepted` together, or none do. Recorded in `sources_registry.promotion_batches`. See [libs/sources/src/registry/lifecycle.ts](../../libs/sources/src/registry/lifecycle.ts) and [ADR 019 §2.4](../decisions/019-reference-identifier-system/decision.md).

**Lifecycle states:** `draft` → `pending` → `accepted`; or → `retired` / `superseded`. Defined in `PROMOTION_STATES` at [libs/constants/](../../libs/constants/).

**Idempotent.** Re-running `register` with no upstream change is a no-op — `getEntryLifecycle()` reports `accepted` and the run skips.

**Why the batch model matters.** A failed promotion (e.g. one chapter manifest is malformed) doesn't leave half a handbook in the database. The atomic boundary is the invariant downstream consumers rely on.

**Failure modes:**

- **Schema mismatch between extractor output and registry expectation.** Surfaces as a typed parse error from `readCacheManifest` or the per-corpus loader. Fix the extractor; re-run.
- **Half-promoted state from a crashed run.** Promotion batches are atomic, so crashes don't leave half-state. The next run picks up cleanly.
- **Already-accepted re-promotion.** Skipped by `getEntryLifecycle()`.

## Step 5 — Resolve and cite

**Goal:** in-app, take a citation locator and return rendered prose with provenance.

A citation locator is a string like `PHAK Ch 2 (2-1..2-32)` — the `canonical_short` of a source plus a sub-document range. The resolver at [libs/sources/src/handbooks/resolver.ts](../../libs/sources/src/handbooks/resolver.ts) turns that into:

1. The `SourceId` for the `SourceEntry`.
2. The `Edition` to render (defaults to most recent `accepted`).
3. The path to the markdown body (`body_path` in the manifest).
4. A rendered chunk with frontmatter context.

This is what powers:

- **Card-page citation chips** ([libs/bc/study/](../../libs/bc/study/) calls into `@ab/sources`)
- **Citation picker** in the hangar app
- **Cited-by panels** that show every card referencing a particular regulation/handbook section

Citation patterns are documented in [reference-citations-pattern.md](reference-citations-pattern.md).

**Why this step matters for the rest of the pipeline.** Every prior step's output shape is constrained by what the resolver consumes. Change the path layout, and the resolver changes. Change the `SourceEntry` id format, and every persisted citation breaks. ADR 019 freezes the id contract; ADR 021 freezes the cache layout; ADR 022 freezes the chapter-source ingestion shape.

**Failure modes:**

- **Locator references a `pending` source.** Resolver returns null; UI shows "citation pending review."
- **Locator references a sub-document that doesn't exist** (chapter 99 in a 17-chapter book). Resolver returns null; we log it as a citation drift signal.
- **Source was retired but cards still reference it.** The retirement is durable; the cards are surfaced in a hangar audit view to be re-cited or dropped.

## End-to-end example: adding a new handbook

Say the FAA publishes a new edition: `FAA-H-8083-3D` (AFH, 4th letter revision).

1. **Discover.** Add an entry to [scripts/sources/config/handbooks/afh.yaml](../../scripts/sources/config/handbooks/) with `edition: FAA-H-8083-3D` and the new URL.
2. **Download.** `bun run sources download --only handbooks` fetches the per-chapter PDFs.
3. **Extract.** `bun run sources extract handbooks afh --edition FAA-H-8083-3D` runs the TOC strategy. If the TOC layout changed in the new edition, fall back to `--strategy prompt` and a fresh-session paste-flow.
4. **Register.** `bun run sources register handbooks` creates `SourceEntry`/`Edition` rows, runs the atomic promotion to `accepted`.
5. **Resolve.** Citations of the form `AFH Ch 2 (2-1..)` automatically pick the most recent accepted edition (`3D`) without any code change. Old citations to `3C` still work; the registry keeps both.

## End-to-end example: a whole-doc pamphlet

Tips on Mountain Flying (`FAA-P-8740-60`, 1999, 18 pages, no chapter-PDFs).

1. **Discover.** Already in [scripts/sources/config/handbooks-extras.yaml](../../scripts/sources/config/handbooks-extras.yaml) under `doc_id: faa-mtn-tips`.
2. **Download.** `bun run sources download --include-handbooks-extras` fetches the single PDF.
3. **Extract + Register** (one step). `bun run sources register handbooks-extras` shells out to `pdftotext`, writes `handbooks/tips-mountain-flying/MTN-2003/document.md`, registers the source.
4. **Resolve.** Citations look like `MTN (whole-doc)` — there's no sub-document locator because the source has no section tree.

Today this means OCR-quality prose with no headings. The pending `body_override` mechanism (see Step 3b) replaces the body with a hand-cleaned markdown file while keeping the rest of the pipeline unchanged.

## Where each step's source-of-truth lives

| Step                    | Code                                                                                   | ADR                                                                                                                              | Tooling                 |
| ----------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Discover                | [scripts/sources/config/](../../scripts/sources/config/)                               | [019](../decisions/019-reference-identifier-system/decision.md)                                                                  | YAML + `loader.ts`      |
| Download                | [scripts/sources/download/](../../scripts/sources/download/)                           | [018](../decisions/018-source-artifact-storage-policy/decision.md), [021](../decisions/021-source-cache-flat-naming/decision.md) | bun + http HEAD/GET     |
| Extract — chapter-aware | [tools/handbook-ingest/](../../tools/handbook-ingest/)                                 | [022](../decisions/022-chapter-source-ingestion/decision.md)                                                                     | Python + PyMuPDF        |
| Extract — whole-doc     | [libs/sources/src/handbooks-extras/](../../libs/sources/src/handbooks-extras/)         | [019 §1.2](../decisions/019-reference-identifier-system/decision.md)                                                             | TS + `pdftotext`        |
| Extract — AIM           | [libs/sources/src/aim/](../../libs/sources/src/aim/)                                   | —                                                                                                                                | TS + cheerio HTML parse |
| Extract — CFR           | [libs/sources/src/regs/](../../libs/sources/src/regs/)                                 | —                                                                                                                                | TS + fast-xml-parser    |
| Register                | [libs/sources/src/registry/](../../libs/sources/src/registry/)                         | [019 §2.4](../decisions/019-reference-identifier-system/decision.md)                                                             | Drizzle ORM             |
| Resolve & cite          | [libs/sources/src/handbooks/resolver.ts](../../libs/sources/src/handbooks/resolver.ts) | [019](../decisions/019-reference-identifier-system/decision.md)                                                                  | TS in-process           |

## Onboarding a new doc — checklist

See [handbook-onboarding-checklist.md](handbook-onboarding-checklist.md) for the operational checklist when adding a new doc. The checklist enforces:

- Add YAML entry → download → verify cache → extract → spot-check headings → register → confirm registry rows → write a citation test → ship.

If you skip the spot-check, you find structural bugs in production. The cost of running the checklist is small; the cost of skipping it is hours of citation-drift triage.
