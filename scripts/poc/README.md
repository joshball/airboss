# PDF extraction POC

Working example of `@ab/sources/pdf` extracting a real cached FAA PDF. Run by:

```bash
bun scripts/poc/pdf-extract.ts
```

Or read the captured output directly:

```bash
less scripts/poc/pdf-extract-output.txt
```

## What it shows

Demonstrates every public function of `@ab/sources/pdf` against a real-world AC PDF (`AC 61-65J`, 57 pages, ~684 KB):

- `extractPdf(path)` — full extraction with metadata
- `findAcSlug(pages)` — cover-page slug detection (returns `AC 61-65J`)
- `findAnyEditionSlug(pages)` — type-tagged slug detection
- `findEffectiveDate(pages)` — date detection (returns `2024-10-30`)
- `mode: 'raw'` vs default `'layout'` — comparison of extraction modes

## Real-world findings

| Finding | Detail |
| --- | --- |
| Performance | 57-page AC extracts in ~100 ms |
| Metadata | `pdfinfo` returns title, author, creator, producer, subject, creation/mod dates |
| Cover-page detection | Both AC slug + effective date detected from page 1 |
| Layout mode | Preserves the 2-column header (`Subject:` left, `Date:` / `AC No:` right) |
| Raw mode | Reading-order, single-column flow — better for body text |
| AC date convention | AC headers use `Date: 10/30/24`, NOT `Effective:`. The `findEffectiveDate` helper handles both via the AC-context heuristic |

## How downstream phases consume this

For the AC corpus ingestion (Phase 8):

```typescript
import { extractPdf, findAcSlug, findEffectiveDate } from '@ab/sources/pdf';

const doc = extractPdf(absolutePath);
const slug = findAcSlug(doc.pages.slice(0, 3)); // cover-page only
const effectiveDate = findEffectiveDate(doc.pages.slice(0, 3));

// Per-section extraction: walk doc.pages with regex against
// '\n\\d+\\s+([A-Z][^.]+\\.)\\s+' for AC numbered paragraphs.
// Body text per page is in doc.pages[i].text.
```

For the ACS corpus (Phase 10 slice):

```typescript
import { extractPdf, findAcsEditionSlug, findEffectiveDate } from '@ab/sources/pdf';

const doc = extractPdf(absolutePath);
const slug = findAcsEditionSlug(doc.pages.slice(0, 3)); // FAA-S-ACS-25
const effectiveDate = findEffectiveDate(doc.pages.slice(0, 3));

// ACS-specific: walk doc.pages for "Area of Operation N" / "Task X" / "Element"
// markers to populate per-task SourceEntries.
```

For the AIM corpus (Phase 7 follow-up):

```typescript
import { extractPdf } from '@ab/sources/pdf';

const doc = extractPdf(absolutePath);
// AIM has thousands of paragraphs. Walk pages for the "5-1-7" style
// chapter-section-paragraph numbering convention. Build a manifest
// the existing libs/sources/src/aim/derivative-reader.ts can read.
```

## Why this exists

The downloader (PR #255) caches source PDFs locally. Phases 7, 8, 10 each need to extract those PDFs into structured manifests. Without a shared extractor, each phase would pick a different PDF lib (or a different subprocess strategy) and we'd accumulate three incompatible implementations. `@ab/sources/pdf` is the single canonical extractor; this POC is the working proof that it produces useful real-world output.

## Limits to know about

- `pdftotext`'s `-layout` mode column-detection isn't perfect on heavily-tabular pages (ACS Area-of-Operation tables). Expect to use `-raw` mode or post-process layout output for cell-level extraction.
- Effective dates appear in 4+ formats across FAA documents. The current `findEffectiveDate` handles ACS / handbook / AC patterns; new corpora may need extensions.
- `pdftotext` is required on PATH (`brew install poppler` / `apt-get install poppler-utils`). Not currently in CI; ingestion is operator-side.
