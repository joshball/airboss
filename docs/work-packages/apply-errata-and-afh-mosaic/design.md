---
title: 'Design: Apply Errata and AFH MOSAIC'
product: study
feature: apply-errata-and-afh-mosaic
type: design
status: unread
---

# Design: Apply Errata and AFH MOSAIC

## Key technical decision: per-handbook plugin registry

Today's ingest engine drives most variability through YAML configs (page offsets, heading style, chapter overrides). Errata parsing breaks that model: addendum layouts are *executable rules* — regex over PDF text spans, anchor extraction, paragraph segmentation — not declarative knobs. Stuffing them into YAML produces a megaswitch in disguise.

The chosen architecture: a `HandbookPlugin` ABC with one subclass per book (`PhakHandbook`, `AfhHandbook`, `AvwxHandbook`), each owning that book's quirks. Engine code calls plugin methods by slug; new books = new file + registry line.

**Alternatives considered:**

- **All-YAML, even for parsing.** Rejected. Embeds Python regex strings as YAML values; loses type safety and IDE support; debug story is awful.
- **Per-handbook conditional in engine modules.** Rejected. Today the engine has zero such conditionals; introducing them for errata reverses years of clean separation.
- **One module per concern (e.g., one `errata_parsers.py` with handbook-keyed functions).** Rejected. Couples handbook-specific logic into shared files; adding a 4th handbook touches every concern module instead of just adding one file.

The plugin pattern matches Drizzle schema modules in `libs/bc/study/src/` (one file per BC concern) and Svelte component co-location (one file per surface). Consistent with the codebase.

## Schema

### `study.handbook_section_errata`

```typescript
// libs/bc/study/src/schema.ts
import { pgTable, text, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { handbookSection } from './schema';

export const handbookSectionErrata = pgTable(
	'handbook_section_errata',
	{
		id: text('id').primaryKey(),
		sectionId: text('section_id')
			.notNull()
			.references(() => handbookSection.id, { onDelete: 'cascade' }),
		errataId: text('errata_id').notNull(),
		sourceUrl: text('source_url').notNull(),
		publishedAt: date('published_at').notNull(),
		appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
		patchKind: text('patch_kind').notNull(),
		targetAnchor: text('target_anchor'),
		targetPage: text('target_page').notNull(),
		originalText: text('original_text'),
		replacementText: text('replacement_text').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => ({
		bySection: uniqueIndex('hbe_section_errata_idx').on(t.sectionId, t.errataId),
	}),
).enableRLS();
```

`patchKind` is constrained at the BC layer (TypeScript discriminated union), not via DB CHECK. Reason: ADR practice in this repo is to constrain in code where the type system already enforces it; CHECK constraints duplicate the constraint and drift.

`(section_id, errata_id)` unique index prevents double-apply. Re-apply path deletes-then-inserts inside one transaction.

### Migration

`drizzle/0003_handbook_section_errata.sql` (new). Generated via `bun run db:generate`. Applied via `bun run db:migrate`.

## API surface

### Python CLI (`tools/handbook-ingest/`)

```bash
# Apply a specific erratum (URL must be in YAML)
bun run sources extract handbooks afh --apply-errata mosaic

# Re-apply all known errata for an edition (idempotent unless --force)
bun run sources extract handbooks afh --reapply-errata

# Force re-apply (deletes existing handbook_section_errata rows for the edition,
# re-runs parser, re-inserts)
bun run sources extract handbooks afh --reapply-errata --force

# Discovery (peer to extract, not nested)
bun run sources discover-errata           # all handbooks
bun run sources discover-errata afh       # one handbook
bun run sources discover-errata --review  # interactive review of pending
```

The `--apply-errata` flag now takes an erratum *id* (matches `errata[].id` in YAML), not a URL. URL is the YAML's responsibility.

### Plugin interface (Python)

```python
# tools/handbook-ingest/ingest/handbooks/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
import re

@dataclass(frozen=True)
class ErrataPatch:
    kind: str  # 'add_subsection' | 'append_paragraph' | 'replace_paragraph'
    chapter: str  # e.g., '02'
    section_anchor: str  # e.g., 'Preflight Assessment of the Aircraft'
    target_page: str  # printed page, e.g., '2-4'
    new_heading: str | None  # for add_subsection only
    original_text: str | None  # None for add_subsection
    replacement_text: str

@dataclass(frozen=True)
class ErrataConfig:
    id: str
    source_url: str
    published_at: str  # ISO date
    parser: str  # parser name; e.g., 'additive-paragraph'

class HandbookPlugin(ABC):
    slug: str

    @abstractmethod
    def discovery_url(self) -> str:
        """FAA parent page for this handbook."""

    @abstractmethod
    def discovery_link_patterns(self) -> list[re.Pattern]:
        """Regex patterns matching errata/addendum URLs on the parent page.
        Multiple patterns allowed because FAA naming is inconsistent."""

    def parse_errata(self, pdf_path: Path, errata: ErrataConfig) -> list[ErrataPatch]:
        """Default: dispatch to a registered parser by `errata.parser`.
        Override only when a handbook needs custom logic that the
        layout-keyed parser registry can't express."""
        from ..errata_parsers import get_parser
        return get_parser(errata.parser).parse(pdf_path, errata)

    def body_quirks_pre(self, ctx: NormalizeContext) -> NormalizeContext:
        """Hook for per-book pre-normalization. Default: passthrough."""
        return ctx

    def body_quirks_post(self, ctx: NormalizeContext) -> NormalizeContext:
        """Hook for per-book post-normalization. Default: passthrough."""
        return ctx
```

### Plugin registry

```python
# tools/handbook-ingest/ingest/handbooks/__init__.py
from .base import HandbookPlugin
from .phak import PhakHandbook
from .afh import AfhHandbook
from .avwx import AvwxHandbook

REGISTRY: dict[str, type[HandbookPlugin]] = {
    'phak': PhakHandbook,
    'afh': AfhHandbook,
    'avwx': AvwxHandbook,
}

class UnknownHandbookError(Exception):
    pass

def get_handbook(slug: str) -> HandbookPlugin:
    cls = REGISTRY.get(slug)
    if cls is None:
        raise UnknownHandbookError(
            f"No plugin registered for slug '{slug}'. "
            f"Available: {sorted(REGISTRY.keys())}"
        )
    return cls()
```

### Errata parser interface

```python
# tools/handbook-ingest/ingest/errata_parsers/base.py
from abc import ABC, abstractmethod
from pathlib import Path

class ErrataParser(ABC):
    name: str

    @abstractmethod
    def parse(self, pdf_path: Path, errata: ErrataConfig) -> list[ErrataPatch]:
        """Extract patches from the errata PDF."""

class UnknownErrataLayoutError(Exception):
    """Raised when the parser cannot recognize the addendum format."""
```

```python
# tools/handbook-ingest/ingest/errata_parsers/__init__.py
from .additive_paragraph import AdditiveParagraphParser

PARSERS: dict[str, type[ErrataParser]] = {
    'additive-paragraph': AdditiveParagraphParser,
}

def get_parser(name: str) -> ErrataParser:
    cls = PARSERS.get(name)
    if cls is None:
        raise ValueError(f"No parser registered for '{name}'. Available: {sorted(PARSERS.keys())}")
    return cls()
```

### TypeScript dispatcher (`scripts/sources.ts`)

```typescript
// scripts/sources/discover/index.ts (new)
export async function runDiscoverErrata(args: string[]): Promise<number> {
	const { handbook, review, dryRun } = parseDiscoverArgs(args);
	const results = await scanHandbooks(handbook ? [handbook] : ALL_HANDBOOK_SLUGS);
	await writeStateFiles(results);
	await writePendingReport(results);
	if (process.env.GH_TOKEN && results.newCandidates.length > 0) {
		await openOrUpdateIssue(results);
	}
	if (review) {
		return launchInteractiveReview(results);
	}
	return results.failed.length > 0 ? 2 : 0;
}
```

The discover module shells through the Python plugin registry for `discovery_url()` and `discovery_link_patterns()` so the patterns live in one place per handbook.

### BC functions (`libs/bc/study/src/handbooks-errata.ts`, new)

```typescript
import { db } from '@ab/db';
import { handbookSectionErrata } from './schema';
import { eq, desc } from 'drizzle-orm';

export async function listErrataForSection(sectionId: string) {
	return db
		.select()
		.from(handbookSectionErrata)
		.where(eq(handbookSectionErrata.sectionId, sectionId))
		.orderBy(desc(handbookSectionErrata.appliedAt));
}

export async function hasErrata(sectionId: string): Promise<boolean> {
	const rows = await db
		.select({ id: handbookSectionErrata.id })
		.from(handbookSectionErrata)
		.where(eq(handbookSectionErrata.sectionId, sectionId))
		.limit(1);
	return rows.length > 0;
}

export type ErrataDisplay = {
	id: string;
	errataId: string;
	publishedAt: string;
	sourceUrl: string;
	patchKind: 'add_subsection' | 'append_paragraph' | 'replace_paragraph';
	originalText: string | null;
	replacementText: string;
};

export function formatErrataForDisplay(row: HandbookSectionErrataRow): ErrataDisplay {
	return {
		id: row.id,
		errataId: row.errataId,
		publishedAt: row.publishedAt,
		sourceUrl: row.sourceUrl,
		patchKind: row.patchKind as ErrataDisplay['patchKind'],
		originalText: row.originalText,
		replacementText: row.replacementText,
	};
}
```

### Reader UI

`apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.server.ts`:

```typescript
export async function load({ params }) {
	const section = await getSection(params);
	const errata = await listErrataForSection(section.id);
	return {
		section,
		errata: errata.map(formatErrataForDisplay),
	};
}
```

`+page.svelte`: amendment badge in the header area, expand panel below. New component `libs/ui/src/handbook/AmendmentPanel.svelte` (props: `errata: ErrataDisplay[]`).

## Component structure

`libs/ui/src/handbook/AmendmentPanel.svelte` (new):

```text
<AmendmentPanel errata={errata}>
  <button>Amended ({errata.length})</button>  -- badge, toggles open
  <div class="panel" hidden={!open}>
    {#each errata as entry}
      <ErrataEntry entry={entry} />
    {/each}
  </div>
</AmendmentPanel>
```

`libs/ui/src/handbook/ErrataEntry.svelte` (new): renders one errata row. Header: `errata id` · `published date` · `source link`. Body: side-by-side or inline diff of `original_text` / `replacement_text`. For `add_subsection`, original is null and we render only the replacement framed as "added".

Diff rendering: prefer existing utility if `libs/utils/` has one. Otherwise minimal `<del>` / `<ins>` inline using a simple LCS-based word diff (~50 lines, no new dep).

## Data flow

```text
FAA page (HTTP)
    -> discover-errata script (TS dispatcher)
    -> plugin discovery_link_patterns (Python via subprocess JSON)
    -> <cache>/discovery/handbooks/<doc>.json (state)
    -> <cache>/discovery/_pending.md (human review)
    -> [user runs --apply-errata <id>]
    -> plugin parse_errata (Python)
    -> ErrataPatch list
    -> writes <edition>/<chapter>/<section>.md (regenerated)
    -> writes <edition>/<chapter>/<section>.errata.md (note)
    -> manifest.json updated
    -> [user runs db:seed]
    -> handbook_section.content_md updated
    -> handbook_section_errata rows inserted
    -> reader load function joins errata onto section
    -> AmendmentPanel renders
```

The Python and TS sides communicate via subprocess + stdout JSON, not a shared library. This matches the existing pattern in `tools/handbook-ingest/` and avoids cross-language dependency complexity.

## Source-byte coverage extension

`scripts/sources/download/handbooks.ts` (new or extension of existing handbook download):

- Reads a catalogue of ~17 handbook source URLs (defined in `scripts/sources/download/handbooks-catalogue.ts` to keep the URL list out of code paths).
- HEAD-cached download per book into `<cache>/handbooks/<slug>/<edition>/source.pdf`.
- Reads each handbook's YAML `errata:` list (where YAML exists) and downloads each errata PDF into `<cache>/handbooks/<slug>/<edition>/_errata/<id>.pdf`.
- For handbooks without a YAML config (the 14 not-yet-ingested), still downloads `source.pdf` using minimal metadata in the catalogue.

Catalogue entry shape:

```typescript
type HandbookCatalogueEntry = {
	slug: string; // 'ifh', 'iph', etc.
	title: string;
	currentEdition: string; // 'FAA-H-8083-15B'
	sourceUrl: string;
	parentPageUrl: string; // for discovery
	ingested: boolean; // false for the 14 not-yet-onboarded
};
```

## Discovery dismissal (false-positive suppression)

Per-handbook YAML configs grow a sibling `dismissed_errata:` list in addition to the existing `errata:` list. A dismissal is the user's "I reviewed this candidate, it is not a real errata, do not surface it again" signal. Because YAML is the single declarative source of truth for what a handbook knows about, dismissals belong there too.

Schema (one-line edit closes a candidate forever):

```yaml
dismissed_errata:
  - url: https://www.faa.gov/.../press-release.pdf
    reason: "press release, not an errata"
  - sha256: "<64-char hex>"
    reason: "duplicate of phak addendum a, different URL"
```

Validation rules (enforced by `_load_dismissed_errata_list` in `tools/handbook-ingest/ingest/config_loader.py`):

| Field    | Rule                                                                |
| -------- | ------------------------------------------------------------------- |
| `url`    | Optional, must be HTTPS when present                                |
| `sha256` | Optional, must be 64 lowercase hex chars when present               |
| Anchor   | Each entry must specify `url`, `sha256`, or both (neither is invalid) |
| `reason` | Optional free-form note retained for audit                          |

The discovery dispatcher reads these via the Python subprocess JSON interface (`python -m ingest.discovery_meta`). On every run, dismissed URLs force-set the candidate's status to `dismissed` and suppress GitHub-issue creation. SHA-256 dismissal is a forward-looking hook (not yet wired through to the scrape, since we cannot HEAD-fetch every parent-page link without amplifying network cost); the field is reserved so a future `--check-hashes` mode can compare the dismissal hash to the candidate's content.

## Discovery state file

`<cache>/discovery/handbooks/<doc>.json`:

```json
{
	"slug": "afh",
	"last_scanned_at": "2026-04-28T14:00:00Z",
	"parent_page_etag": "...",
	"known_errata": [
		{
			"url": "https://www.faa.gov/.../AFH_Addendum_(MOSAIC).pdf",
			"first_seen_at": "2026-04-28T14:00:00Z",
			"status": "applied",
			"errata_id": "mosaic"
		}
	],
	"candidates": []
}
```

`status` values:

- `candidate`: discovered, not yet reviewed.
- `applied`: applied via `--apply-errata`; references the YAML `errata[].id`.
- `dismissed`: user marked as not-relevant (e.g., duplicate, mis-classified).
- `withdrawn`: URL no longer resolves; the FAA pulled it.

## Server startup hook

`apps/study/src/hooks.server.ts` (extend existing):

```typescript
import { maybeRunDiscovery } from '$lib/server/discovery';

await maybeRunDiscovery();  // non-blocking; logs and forks
```

`$lib/server/discovery.ts` (new):

```typescript
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

export async function maybeRunDiscovery(): Promise<void> {
	const cachePath = resolve(getCacheRoot(), 'discovery', '_last_run.json');
	let stale = true;
	try {
		const { ran_at } = JSON.parse(await readFile(cachePath, 'utf8'));
		stale = Date.now() - new Date(ran_at).getTime() > FRESHNESS_MS;
	} catch {
		// missing or corrupt; treat as stale
	}
	if (!stale) return;

	const child = spawn('bun', ['run', 'sources', 'discover-errata'], {
		detached: true,
		stdio: 'ignore',
	});
	child.unref();
}
```

Failure modes: missing cache, missing `bun`, child process crash. All logged, none fatal. Server starts.

## launchd cron

`scripts/setup-discovery-cron.sh` (new; user opts in):

- Writes `~/Library/LaunchAgents/com.airboss.discover-errata.plist`.
- Schedules `bun run sources discover-errata` Sundays 09:00.
- Idempotent: re-run replaces existing plist.
- Documented in `docs/devops/` as "optional; the dev-server hook is the primary mechanism."

## Key decisions

### Why subprocess JSON between TS and Python, not an FFI binding

The existing handbook-ingest already uses subprocess + JSON. Introducing an FFI (PyO3, ctypes, etc.) for one new boundary would be a heavy precedent. Subprocess overhead is negligible for batch operations (discovery scans 17 pages per run; apply runs once per erratum). Keep it boring.

### Why patches are stored as text, not as structured AST

Original/replacement text capture the FAA's exact words, which is the citation-correctness promise. Structured AST (paragraph IDs, position offsets) would be more efficient for re-rendering but invents structure the FAA doesn't provide and risks drift between what we stored and what the source PDF actually says. Plain text + diff at render time is the safest model.

### Why one parser file per layout, not per handbook

Same insight as the plugin module split. Layouts have nameable archetypes (additive paragraph, replacement triplet, summary-of-changes table). Handbooks may use different layouts at different times (PHAK 25B used incremental addenda; PHAK 25C MOSAIC uses additive). Coupling parser logic to handbook would force PHAK to know two layouts; coupling to layout means PHAK's plugin says `parser: additive-paragraph` for the MOSAIC erratum and `parser: summary-of-changes` for older ones, and each parser is testable in isolation.

### Why discovery is gated behind a freshness file, not always-run

Discovery makes ~17 HTTPS requests. Server start should be fast. Freshness file makes the common case zero-cost (cache hit) and the rare case non-blocking (background fork). The freshness window is 7 days because FAA cadence is years; weekly is overkill but cheap and tolerant.

### Why GitHub issue and not just a commit

The discovery output is a queue of work-shaped items, not a code change. Committing it would put rapidly-churning state in version control. An issue is the right shape: it has a thread (comments), a label (`errata`), can be closed when work lands, and lives in the repo's existing notification surface.

### Why no auto-apply in v1

Errata parsing is brittle until proven against multiple layouts. Auto-apply could silently corrupt section text if the parser misreads a layout. Manual review until the parser has unit tests covering ≥3 distinct layouts AND a dry-run mode shows zero diff against the human-applied output. The trigger is parser-readiness, not number-of-applies, because ten AFH MOSAICs prove nothing about the next handbook's format.

### Why ADR 020 gets an inline edit, not a new ADR

Repo precedent allows ADR Revisions sections. One incorrect line about cumulative-vs-incremental does not warrant a sibling ADR that would mostly say "ADR 020 line 44 is wrong." Inline + dated revisions note keeps the record self-contained and discoverable from its primary source.
