#!/usr/bin/env bun

/**
 * Source-corpus dispatcher for airboss.
 *
 * Single entry point for every developer task that touches a source corpus
 * (CFR, AIM, ACs, ACS, FAA handbooks). Replaces the three pre-2026-04-27
 * top-level scripts (`download-sources`, `ingest`, `handbook-ingest`).
 *
 * Usage:
 *   bun run sources                           # prints index
 *   bun run sources help
 *   bun run sources <command> --help          # detailed help for one command
 *
 *   bun run sources download [flags]          # fetch source bytes
 *   bun run sources register <corpus> [...]   # register derivatives in @ab/sources
 *   bun run sources extract handbooks [...]   # run python TOC/LLM section extraction
 *
 * Source of truth:
 *
 *   - ADR 018 (storage policy) -- where source bytes live
 *   - ADR 019 §1.2 (corpus catalogue) -- what corpora exist
 *   - `scripts/README.sources.md` -- operator runbook
 */

import { maybePrintBanner } from './sources/discover/banner';
import { runDownloadSources } from './sources/download/index';

// `register` and `extract` are loaded lazily so the `download` command does
// not pull in `@ab/sources/*` (and its `fast-xml-parser` etc. transitive deps)
// just to fetch a PDF. `discover-errata` is loaded lazily for the same reason.

// ---------------------------------------------------------------------------
// Help (mirrors db.ts / references.ts: a what/why/how/links block per command)
// ---------------------------------------------------------------------------

interface CommandHelp {
	summary: string;
	what: string;
	why: string;
	how: string;
	links?: string[];
}

const COMMAND_HELP: Record<string, CommandHelp> = {
	download: {
		summary: 'Fetch source bytes (CFR XML, AIM, ACs, ACS, optional handbook extras) into the local cache',
		what: `One-shot operator script that downloads every source corpus the project needs into the local cache (\`$AIRBOSS_HANDBOOK_CACHE\`, default \`~/Documents/airboss-handbook-cache/\`). Idempotent: HEAD-checks each URL and skips files where content-length matches the cached size and (etag matches OR last-modified has not advanced).

  bun run sources download                                # everything except handbook extras
  bun run sources download --corpus=regs                  # only CFR
  bun run sources download --corpus=regs,aim,ac           # subset
  bun run sources download --dry-run                      # preview, no network
  bun run sources download --verify                       # HEAD-only audit (no downloads)
  bun run sources download --include-handbooks-extras     # add 8083-2/9/15/16/27/30/32/34
  bun run sources download --force-refresh                # ignore manifest, re-fetch
  bun run sources download --edition-date=2026-04-22      # eCFR snapshot date override
  bun run sources download --verbose                      # log every URL + redirect`,
		why: 'One command instead of N. Output is colored (yellow = skipped/cached, green = downloaded ok, red = errors) so a long run is scannable. Verify mode is the diagnostic for "did the FAA rotate a URL on us?" -- safe to run at any time, no bytes touched.',
		how: 'Fetches `titles.json` from eCFR once per run for per-title `latest_amended_on`. Per-doc `manifest.json` records hash, size, etag, last-modified. Browser-style User-Agent on every request (FAA returns 403 without one). Streams downloads with sha256 alongside.',
		links: [
			'scripts/sources/download.ts',
			'scripts/sources/download/',
			'scripts/README.sources.md',
			'docs/decisions/018-source-artifact-storage-policy/decision.md',
			'docs/platform/STORAGE.md',
		],
	},
	register: {
		summary: 'Register derivative trees with the @ab/sources registry (cfr / handbooks / aim)',
		what: `Routes to the per-corpus \`runIngestCli\` exported from \`@ab/sources/<corpus>\`. Each corpus owns its arg parsing, validation, and execution. The dispatcher only handles routing, top-level help, and the \`--all\` orchestrator.

  bun run sources register cfr [--title=14|49] [--edition=YYYY-MM-DD] [--fixture=<path>] [--out=<path>]
  bun run sources register handbooks [--doc=phak|afh|avwx] [--edition=<...>] [--out=<path>]
  bun run sources register aim [--edition=YYYY-MM] [--out=<path>]
  bun run sources register --all
  bun run sources register --help
  bun run sources register <corpus> --help`,
		why: 'Adding a new corpus is a single import + one entry in the dispatcher map. CFR ingest fetches and walks live XML; handbook + AIM register existing on-disk derivatives produced by the extraction pipeline.',
		how: 'CFR live ingest hits the eCFR Versioner API and caches under `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<edition>/`. CI runs MUST pass `--fixture=` -- live network ingest is an operator action.',
		links: [
			'scripts/sources/register.ts',
			'libs/sources/src/regs/ingest.ts',
			'libs/sources/src/handbooks/ingest.ts',
			'libs/sources/src/aim/ingest.ts',
			'docs/work-packages/reference-cfr-ingestion-bulk/',
			'docs/work-packages/reference-handbook-ingestion/',
			'docs/work-packages/reference-aim-ingestion/',
		],
	},
	'discover-errata': {
		summary: 'Scan FAA handbook parent pages for newly-published errata / addenda',
		what: `Crawls the FAA parent page for each of the 17 catalogued handbooks (per WP \`apply-errata-and-afh-mosaic\` research), classifies each PDF link as an errata-shape candidate, and persists state under \`<cache>/discovery/handbooks/<slug>.json\`. New candidates are reported in \`<cache>/discovery/_pending.md\` and (when \`GH_TOKEN\` is set) auto-opened as GitHub issues, idempotently.

  bun run sources discover-errata
  bun run sources discover-errata --doc=phak,afh
  bun run sources discover-errata --force                  # bypass freshness gate
  bun run sources discover-errata --dry-run                # skip GH API calls`,
		why: 'There is no FAA RSS, API, or structured changelog for handbook errata (research dossier section 1). Page-scraping the parent page is the only signal. Discovery surfaces all 17 handbooks even though only a subset are ingested; non-ingested books emit `signal-only` records so we know when to onboard.',
		how: 'Reads per-handbook discovery URL + dismissal/applied lists from the Python ingestion side via subprocess JSON (`python -m ingest.discovery_meta`). Scrape uses the same User-Agent as the downloader. State is cache-side only; never committed. Freshness-gated to one run per 7 days (overridable with `--force`).',
		links: [
			'scripts/sources/discover/',
			'scripts/sources/discover/run.ts',
			'tools/handbook-ingest/ingest/discovery_meta.py',
			'docs/work-packages/apply-errata-and-afh-mosaic/research/errata-discovery.md',
			'docs/decisions/020-handbook-edition-and-amendment-policy.md',
		],
	},
	extract: {
		summary: 'Run a source-extraction pipeline (currently: handbooks Python TOC + LLM strategies)',
		what: `Currently routes to a single sub-pipeline: \`handbooks\`, which dispatches to \`python -m ingest\` from \`tools/handbook-ingest/\`.

  bun run sources extract handbooks --help                                     # python-side flags
  bun run sources extract handbooks phak --edition FAA-H-8083-25C
  bun run sources extract handbooks phak --edition FAA-H-8083-25C --dry-run
  bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy compare`,
		why: 'Bun is the developer entry point for every script in the repo. This wrapper keeps the operator workflow consistent (`bun run sources ...`) regardless of the underlying runtime.',
		how: 'Uses `tools/handbook-ingest/.venv/bin/python` if present, otherwise falls back to `python3` on PATH. All flags after `handbooks` are passed through to argparse on the Python side.',
		links: [
			'scripts/sources/extract.ts',
			'scripts/sources/extract/handbooks.ts',
			'tools/handbook-ingest/README.md',
			'docs/ingestion-pipeline/handbook-ingestion-strategies.md',
			'docs/work-packages/handbook-ingestion-and-reader/',
		],
	},
	'verify-urls': {
		summary: 'HEAD-check every source-corpus URL against the live publisher (no downloads)',
		what: `Walks every YAML config under \`scripts/sources/config/\` and HEADs every URL: AC, ACS, AIM (whole-doc + 72 sections + 5 appendices), regulations (per-title), handbooks (whole-doc + chapter PDFs + ancillaries). For two-hop handbooks the index page is re-scraped and chapter URLs validated. AIM section count is also probed: a section beyond the configured count returning 200 is a hard error with copy-pasteable remediation.

  bun run sources verify-urls

NOT in CI -- network dependent. Operator runs this before a release or
after a suspected FAA URL rotation.`,
		why: 'Hardcoded URLs in YAML are deterministic and auditable, but the FAA does rotate URLs occasionally. The verifier closes the gap: HEAD every URL, surface 404s + section-count drift loudly with structured remediation pointing at the YAML field.',
		how: 'Same User-Agent + retry policy as the downloader. Exit 0 when every URL returns 2xx; exit 1 with a structured error block otherwise.',
		links: [
			'scripts/sources/verify-urls.ts',
			'scripts/sources/config/',
			'docs/decisions/022-chapter-source-ingestion/decision.md',
		],
	},
	inventory: {
		summary: 'Regenerate docs/ingestion-pipeline/inventory.md from YAML config + cache manifests',
		what: `Walks every YAML config + every cache manifest and emits a per-corpus markdown report. The output is idempotent: same input bytes = same output bytes. One timestamp at the top; no timestamps inside section bodies. Per-corpus tables show doc name, source URL, cache filename, SHA-256 (12-char prefix), and last-fetched date.

  bun run sources inventory                    # writes docs/ingestion-pipeline/inventory.md
  bun run sources inventory --help             # show flags`,
		why: 'The inventory is the human-readable index of every byte the project pulls from publishers. Operators git-diff INVENTORY.md to see what changed across cache regenerations. Regenerable + sortedstable means the diff stays small even when one doc rotates.',
		how: "Reads YAML configs via the same loader the downloader uses. Reads cache manifests via the manifest module. SHA-256 prefix is 12 hex chars (matches git's full-prefix convention).",
		links: [
			'scripts/sources/inventory.ts',
			'docs/ingestion-pipeline/inventory.md',
			'docs/decisions/022-chapter-source-ingestion/decision.md',
		],
	},
	'audit-citations': {
		summary: 'Stage-5 cross-link audit -- find dead targets, dead sources, and resolver coverage gaps',
		what: `Walks every row in \`study.content_citations\` and reports:

  - dead targets (citation points at a row that no longer exists)
  - dead sources (citation's owning card / scenario / node was hard-deleted)
  - resolver coverage gaps (corpus-backed citations whose corpus has no
    resolver registered, so the citation chip cannot deep-link)
  - invalid external_ref URLs

Also emits per-target-type and per-corpus rollups so the library-completeness
sequence can see at a glance which corpus is accumulating citations without a
resolver behind it.

  bun run sources audit-citations              # human-readable report
  bun run sources audit-citations --json       # JSON report (scheduled-job format)`,
		why: 'Stage 5 of the source ingestion pipeline ("Resolve & cite") completes when authored citations resolve to live deep-linkable targets. The audit is the read-only sanity check that catches drift -- soft-FK polymorphic edges have no DB-level enforcement, so a hard-delete of a card / reference can leave dangling citations until something looks for them.',
		how: 'Reads `study.content_citations`, joins against `hangar.reference` (regulation + AC targets), `study.knowledge_node` (knowledge targets), and the source tables (`card`, `scenario`, `knowledge_node`). Consults the registered resolver registry (`@ab/sources` `ENUMERATED_CORPORA`) to detect coverage gaps. Read-only; never mutates the DB.',
		links: [
			'scripts/sources/audit-citations.ts',
			'libs/bc/study/src/citations/audit.ts',
			'libs/bc/study/src/citations/corpus.ts',
			'docs/ingestion-pipeline/pipeline.md',
			'docs/ingestion-pipeline/stage-status.md',
		],
	},
	help: {
		summary: 'Show the command index (or detailed help for one command)',
		what: '`bun run sources help` prints the index. `bun run sources <command> --help` prints a what/why/how/links block. `bun run sources <command> <subcommand> --help` defers to the per-subcommand help (e.g. `bun run sources register cfr --help`).',
		why: 'The dispatcher is the single entry point for every source-corpus task -- help has to be discoverable, not buried.',
		how: 'Authored in a `COMMAND_HELP` record in scripts/sources.ts, one entry per top-level command. Per-subcommand help lives next to the subcommand implementation.',
		links: ['scripts/sources.ts', 'scripts/README.sources.md', 'CLAUDE.md'],
	},
};

function printCommandHelp(name: string): void {
	const entry = COMMAND_HELP[name];
	if (!entry) {
		console.error(`No help entry for '${name}'.`);
		process.exit(1);
	}
	console.log(`\nbun run sources ${name}`);
	console.log('-'.repeat(`bun run sources ${name}`.length));
	console.log(`\n  ${entry.summary}`);
	console.log(`\nWhat\n  ${entry.what.replace(/\n/g, '\n  ')}`);
	console.log(`\nWhy\n  ${entry.why.replace(/\n/g, '\n  ')}`);
	console.log(`\nHow\n  ${entry.how.replace(/\n/g, '\n  ')}`);
	if (entry.links && entry.links.length > 0) {
		console.log('\nLinks');
		for (const link of entry.links) console.log(`  - ${link}`);
	}
	console.log('');
}

interface CommandGroup {
	label: string;
	commands: readonly string[];
}

const COMMAND_GROUPS: readonly CommandGroup[] = [
	{ label: 'Source bytes', commands: ['download', 'verify-urls', 'inventory'] },
	{ label: 'Derivative ingestion', commands: ['register', 'extract'] },
	{ label: 'Discovery', commands: ['discover-errata'] },
	{ label: 'Cross-link', commands: ['audit-citations'] },
	{ label: 'Utility', commands: ['help'] },
];

function printIndex(): void {
	console.log('Usage: bun run sources <command> [flags]');
	console.log('       bun run sources <command> --help   # detailed help for one command');
	console.log('');
	console.log('Commands:');
	const allNames = COMMAND_GROUPS.flatMap((g) => g.commands);
	const width = allNames.reduce((m, n) => Math.max(m, n.length), 0);
	for (const group of COMMAND_GROUPS) {
		console.log('');
		console.log(`  ${group.label}`);
		for (const name of group.commands) {
			const entry = COMMAND_HELP[name];
			if (!entry) continue;
			console.log(`    ${name.padEnd(width)}  ${entry.summary}`);
		}
	}
	console.log('');
	console.log('Flags:');
	console.log('  --help, -h    Show detailed help for a command');
	console.log('');
	console.log('Per-command usage banners:');
	console.log('  bun run sources register --help');
	console.log('  bun run sources extract --help');
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function runSourcesDispatcher(argv: readonly string[]): Promise<number> {
	const [head, ...rest] = argv;

	if (head === undefined) {
		printIndex();
		maybePrintBanner();
		return 0;
	}

	if (head === '--help' || head === '-h' || head === 'help') {
		// `bun run sources help <command>` -> per-command help
		if (rest[0] !== undefined && rest[0] in COMMAND_HELP) {
			printCommandHelp(rest[0]);
			return 0;
		}
		printIndex();
		return 0;
	}

	// Banner runs once per dispatcher invocation, before the command output, so
	// pending-review counts surface even when the user is running an unrelated
	// subcommand. Suppressible via `AIRBOSS_QUIET=1`.
	maybePrintBanner();

	switch (head) {
		case 'download': {
			if (rest.includes('--help') || rest.includes('-h')) {
				// Defer to download's own banner (it lists every flag).
				return await runDownloadSources({ argv: ['--help'] });
			}
			return await runDownloadSources({ argv: rest });
		}
		case 'register': {
			const { REGISTER_USAGE, runRegisterDispatcher } = await import('./sources/register');
			if (rest.length === 0) {
				process.stdout.write(REGISTER_USAGE);
				return 0;
			}
			return await runRegisterDispatcher(rest);
		}
		case 'extract': {
			const { EXTRACT_USAGE, runExtractDispatcher } = await import('./sources/extract');
			if (rest.length === 0) {
				process.stdout.write(EXTRACT_USAGE);
				return 0;
			}
			return await runExtractDispatcher(rest);
		}
		case 'discover-errata': {
			const { runDiscoverErrata } = await import('./sources/discover');
			return await runDiscoverErrata({ argv: rest });
		}
		case 'verify-urls': {
			if (rest.includes('--help') || rest.includes('-h')) {
				printCommandHelp('verify-urls');
				return 0;
			}
			const { runVerifyUrls } = await import('./sources/verify-urls');
			return await runVerifyUrls();
		}
		case 'inventory': {
			if (rest.includes('--help') || rest.includes('-h')) {
				printCommandHelp('inventory');
				return 0;
			}
			const { runInventory } = await import('./sources/inventory');
			return await runInventory();
		}
		case 'audit-citations': {
			if (rest.includes('--help') || rest.includes('-h')) {
				printCommandHelp('audit-citations');
				return 0;
			}
			const { runAuditCitations } = await import('./sources/audit-citations');
			const code = await runAuditCitations(rest);
			// `auditCitations` opens a postgres connection via @ab/db; close it
			// so the bun process can exit cleanly.
			const { client } = await import('@ab/db/connection');
			await client.end({ timeout: 5 });
			return code;
		}
		default: {
			console.error(`Unknown command: ${head}\n`);
			printIndex();
			return 1;
		}
	}
}

if (import.meta.main) {
	const code = await runSourcesDispatcher(process.argv.slice(2));
	process.exit(code);
}
