# Ingestion-pipeline tooling

The tools, libraries, and conventions the ingestion pipeline depends on. For *what* each step does, see [pipeline.md](pipeline.md). This doc is *what each tool is, why it exists, and how we leverage it*.

## PDF extraction tools

This is the layer that's caused the most confusion in conversation. Three names show up — `pdftotext`, Poppler, PyMuPDF/`fitz` — that look interchangeable but aren't.

### pdftotext (the CLI)

A single binary that takes a PDF and prints text to stdout. Ships with **Poppler** (the rendering library — see below). Used in the TypeScript pipeline at [libs/sources/src/pdf/extract.ts](../../libs/sources/src/pdf/extract.ts).

```bash
pdftotext -enc UTF-8 -f 1 -l 18 input.pdf -      # pages 1..18 to stdout
pdftotext -layout input.pdf -                    # preserve column/spacing
pdftotext -raw input.pdf -                       # follow PDF text-object order
```

We invoke it via `spawnSync` from [extract.ts:170](../../libs/sources/src/pdf/extract.ts#L170):

```typescript
const args = ['-enc', 'UTF-8', '-f', String(firstPage), '-l', String(lastPage), source, '-'];
const result = spawnSync(binary, args, { encoding: 'utf-8' });
```

**What it does well:** fast, deterministic, zero npm dependencies. Output is splittable on form-feed (`\f`) for per-page text.

**What it can't do:** recover heading hierarchy, font weight, color, font size, or any semantic structure. PDF is rendering instructions — "draw glyph G at coordinates (x, y) at size S in font F" — and `pdftotext` outputs the glyphs in (mostly) reading order. Bold heading text comes out as plain prose with whatever indentation the PDF used. There is no way to ask `pdftotext` "is this a heading?" because the PDF itself doesn't have that concept.

### Poppler (the library)

The C++ rendering and parsing library that ships `pdftotext`, plus `pdfinfo` (metadata), `pdftoppm` (PDF→image), `pdftohtml` (PDF→HTML), and others. Originally forked from Xpdf in 2005. We use it through `pdftotext` as a subprocess; we don't link it as a library.

**Install:** `brew install poppler` on macOS. Poppler-utils is preinstalled on most Linux distros.

**Why we use the CLI not the library:** zero npm dependencies. Bun shells out, parses stdout, done. No bindings to maintain, no native build step, works in any CI environment with Poppler installed.

### PyMuPDF and fitz

These are the same thing. **PyMuPDF** is the package name on PyPI; **`fitz`** is the import name in Python:

```python
import fitz  # this is PyMuPDF
doc = fitz.open("input.pdf")
page = doc[0]
text_dict = page.get_text("dict")  # full structure with coordinates, fonts, sizes
```

The `fitz` import name is historical — PyMuPDF wraps **MuPDF**, a separate C library from Artifex (the same company behind Ghostscript). MuPDF's predecessor was Sumatra/Fitz. The name stuck. **There is no separate "fitz" tool**; whenever you see `import fitz` in this repo, it's PyMuPDF.

Used in the Python pipeline at [tools/handbook-ingest/](../../tools/handbook-ingest/), specifically in [tools/handbook-ingest/ingest/sections_via_toc.py](../../tools/handbook-ingest/ingest/sections_via_toc.py) and [figures.py](../../tools/handbook-ingest/ingest/figures.py).

**What PyMuPDF gives us that `pdftotext` doesn't:**

- **Coordinate-aware text.** Every text span has `bbox`, font name, font size. This is what makes TOC parsing possible — the TOC entries have visual structure ("title at left, dotted leader, page number at right") that you can recover from coordinates.
- **PDF outline / bookmarks** via `doc.get_toc()`. When the publisher embeds outline metadata, this returns it directly. Most FAA handbooks DO NOT embed outlines, which is why we fall back to parsing the visible TOC pages.
- **Page rendering** to PNG for figure extraction.
- **Annotations, links, form fields.**

**Why we use both `pdftotext` and PyMuPDF:**

- `pdftotext` for pure text concatenation (fast, deterministic, no dependencies on the calling side beyond a binary)
- PyMuPDF for structure-aware extraction (TOC parsing, figure cropping, coordinate-driven heading detection)

The TypeScript pipeline can't use PyMuPDF directly — wrong runtime. So the architecture is: TypeScript orchestrates, shells out to Python for structure-aware work, consumes the Python output as JSON manifests.

### "Is the TOC registered formally in the PDF?"

This came up directly. A PDF can carry structure in three independent layers:

1. **Visible text on TOC pages.** What a human sees when they look at the printed TOC. This is *prose* — `pdftotext` recovers it, but only as text. Reconstructing structure means parsing things like dotted-leader patterns, indentation, page-number columns.
2. **Document outline / bookmarks.** A separate metadata structure inside the PDF that maps "Chapter 1: Introduction" → page 1-1. Visible in Acrobat/Preview as the sidebar tree. PyMuPDF surfaces it via `doc.get_toc()`. **Most FAA handbooks DO NOT embed this.** Some publishers do, most don't.
3. **Tagged PDF / structure tree.** A full semantic outline (every paragraph, heading, list, table) embedded as PDF tags. Required for accessibility-compliant PDFs. **Almost no FAA handbook has this** — it's a separate authoring effort the publisher would have to do.

So when you saw `https://.../FAA-H-8083-16B_Table_of_Contents.pdf` as a separate PDF on the FAA site, that's a layer-1 artifact (visible TOC). Useful for parsing, but it doesn't mean the *main* PDF has its TOC formally registered (layer 2). It usually doesn't.

**Practical consequence:** the TOC strategy at [tools/handbook-ingest/ingest/sections_via_toc.py](../../tools/handbook-ingest/ingest/sections_via_toc.py) opens the main PDF with PyMuPDF, finds the TOC pages by content heuristics, parses the visible layout (coordinates, font sizes), and emits a `sections[]` array. The standalone TOC PDFs the FAA publishes aren't currently used — the heuristic operates on the main document.

## XML and HTML parsing

### fast-xml-parser

Used by the CFR (regulations) extractor at [libs/sources/src/regs/](../../libs/sources/src/regs/). The eCFR publishes Title 14 and Title 49 as XML; we parse it into JSON for storage at `regulations/cfr-14/<date>/sections.json`.

Why fast-xml-parser over alternatives: zero native dependencies, deterministic output, well-documented schema for repeated-element handling.

### cheerio

Used by the AIM extractor at [libs/sources/src/aim/](../../libs/sources/src/aim/). The AIM publishes as HTML pages; cheerio gives us jQuery-style traversal to walk chapter/section/paragraph structure.

Why cheerio over `node:html-parser` or domparser: cheerio handles malformed HTML gracefully (which the AIM frequently is), and the jQuery-style API makes traversal readable.

## Database tooling

### Drizzle ORM

Strict project rule: **Drizzle ORM only, no raw SQL** ([CLAUDE.md](../../CLAUDE.md)). Used everywhere the registry talks to PostgreSQL.

Schema namespaces:

- `identity.*` — auth, sessions, users
- `audit.*` — cross-cutting audit log
- `study.*` — cards, reviews, plans, scenarios
- `sources_registry.*` — `sources`, `editions`, `promotion_batches`

The registry tables are defined at [libs/sources/src/db/schema.ts](../../libs/sources/src/db/schema.ts). The lifecycle state machine lives at [libs/sources/src/registry/lifecycle.ts](../../libs/sources/src/registry/lifecycle.ts).

### IDs are `prefix_ULID`

Per CLAUDE.md and the [@ab/utils](../../libs/utils/) convention. Never call `nanoid()` or `ulid()` directly — use `createId('prefix')` from `@ab/utils`. Promotion batch IDs, source entry IDs, edition IDs all flow through this.

## Lifecycle and promotion

A small but high-leverage tool: the **atomic batch promotion** at [libs/sources/src/registry/lifecycle.ts](../../libs/sources/src/registry/lifecycle.ts).

```typescript
const result = await recordPromotion({
    corpus: 'handbooks',
    reviewerId: 'handbooks-extras-ingestion',
    scope: entriesToPromote,
    inputSource: cacheRoot,
    targetLifecycle: 'accepted',
});
```

States: `draft → pending → accepted` (or `→ retired / superseded`). The promotion is *batch-atomic*: the entire batch transitions or nothing does. Partial promotions are impossible by construction.

This matters because:

- A failed extraction mid-run doesn't leave half a handbook in `accepted`.
- Re-running an ingestion script with no upstream change is a no-op.
- The audit trail (`promotion_batches` table) records every transition with `reviewerId`, `inputSource`, `previousBatchId`, and timestamps.

[ADR 019 §2.4](../decisions/019-reference-identifier-system/decision.md) is the binding contract.

## The locator vocabulary

Source IDs and edition IDs are not random — they follow a strict scheme:

```text
airboss-ref:<corpus>/<slug>/<edition-slug>
airboss-ref:handbooks/risk-management/8083-2A
airboss-ref:handbooks/phak/FAA-H-8083-25C
airboss-ref:handbooks/tips-mountain-flying/MTN-2003
```

Defined in [ADR 019 §1](../decisions/019-reference-identifier-system/decision.md). The `<corpus>` segment is one of `{handbooks, ac, acs, aim, regulations, tcds, plates, ...}`. The `<slug>` is corpus-specific (handbook short slug, AC number, AIM edition, etc.). The `<edition-slug>` is the publisher's revision marker.

**Why the family-vs-edition split.** A handbook like RMH has `doc_id: faa-h-8083-2` (the *family*) and `edition: 2A` (the *revision*). New revisions ship under the same `doc_id` with a new `edition`. Citations resolve to the family ID; the resolver picks the most recent `accepted` edition unless a citation pins a specific edition.

**Where the validator lives:** [libs/sources/src/check.ts](../../libs/sources/src/check.ts). Run as part of `bun run check`.

## CLI dispatcher conventions

All scripts that touch source corpora go through a single dispatcher: `bun run sources <command>`. This is enforced by:

- A single executable script at [scripts/sources.ts](../../scripts/sources.ts).
- Per-command modules at [scripts/sources/](../../scripts/sources/).
- Lazy loading — the `download` command does not pull in `@ab/sources` (and its transitive deps like `fast-xml-parser`) just to fetch a PDF.

```text
bun run sources                                           help index
bun run sources help <command>                            detailed help
bun run sources download                                  fetch
bun run sources download --include-handbooks-extras       opt-in extras
bun run sources extract handbooks <doc> --edition <ed>    structure recovery
bun run sources extract handbooks <doc> --strategy prompt  fallback strategy
bun run sources extract handbooks <doc> --strategy compare diff strategies
bun run sources register <corpus>                         load to db
```

Why one dispatcher: matches the project's `bun run db <command>` and `bun run references <command>` pattern. Discoverable via `bun run sources` with no args.

## Testing tooling

- **Vitest** — unit tests for BC/lib logic. Runner at the repo root: `bun run test`. Per-lib runs: `bun run test --filter @ab/sources`.
- **Playwright** — e2e tests for user flows. Lives at [tests/](../../tests/). Run with `bun run test:e2e`.

The ingestion pipeline has both:

- Unit tests for ingestors and parsers (e.g. [libs/sources/src/handbooks-extras/ingest.test.ts](../../libs/sources/src/handbooks-extras/ingest.test.ts)) — fast, deterministic, fixture-driven.
- E2E tests for the resolver path — render a citation, expect the rendered chunk to contain expected provenance.

**Project rule:** tests against the database hit a real database (per memory `feedback_dont_mock_db`). No mocking the registry; spin up a test DB.

## Configuration tooling

### YAML configs

[scripts/sources/config/](../../scripts/sources/config/). One file per corpus. Schema validation lives at [scripts/sources/config/schemas.ts](../../scripts/sources/config/schemas.ts) and [scripts/sources/config/loader.ts](../../scripts/sources/config/loader.ts) — both Zod-typed.

Adding a new doc to an existing corpus: edit the YAML, add a `DOC_ID_TO_FRIENDLY` entry in [libs/sources/src/handbooks-extras/ingest.ts](../../libs/sources/src/handbooks-extras/ingest.ts) (for whole-doc) or the equivalent locator in [libs/sources/src/handbooks/locator.ts](../../libs/sources/src/handbooks/locator.ts) (for chapter-aware).

### Cache root

`$AIRBOSS_HANDBOOK_CACHE` env var. Default `~/Documents/airboss-handbook-cache/`. Resolved by [libs/constants/](../../libs/constants/) `resolveCacheRoot()`.

### Constants

All literals live in [libs/constants/](../../libs/constants/). Routes through `ROUTES` in [libs/constants/src/routes.ts](../../libs/constants/src/routes.ts). Cache paths through `resolveCacheRoot()`. No magic strings, anywhere — strict rule.

## Operator runbook

[scripts/README.sources.md](../../scripts/README.sources.md) is the operator-facing runbook. CLAUDE.md links to this for "I need to add a new doc" workflows. This doc complements it — runbook is what to type, this doc is what's happening when you type it.

## Anchors

- [ADR 018 — Source artifact storage policy](../decisions/018-source-artifact-storage-policy/decision.md)
- [ADR 019 — Reference identifier system](../decisions/019-reference-identifier-system/decision.md)
- [ADR 021 — Source cache flat naming](../decisions/021-source-cache-flat-naming/decision.md)
- [ADR 022 — Chapter source ingestion](../decisions/022-chapter-source-ingestion/decision.md)
- [pipeline.md](pipeline.md) — process walkthrough
- [section-extraction-strategies.md](section-extraction-strategies.md) — TOC vs prompt vs compare
- [handbook-onboarding-checklist.md](handbook-onboarding-checklist.md) — operational steps to add a doc
