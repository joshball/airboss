/**
 * Argument parsing for `bun run sources download`.
 *
 * Pure transform from `argv` to a typed `CliArgs`. The actual side-effecting
 * orchestration (HEAD requests, file writes, summary printing) lives in
 * sibling modules.
 */

import { SOURCE_DOWNLOAD_CONCURRENCY, SOURCE_DOWNLOAD_CONCURRENCY_MAX } from '@ab/constants';

export type Corpus = 'regs' | 'aim' | 'ac' | 'acs' | 'handbooks' | 'safo' | 'info';

export const ALL_CORPORA: readonly Corpus[] = ['regs', 'aim', 'ac', 'acs', 'handbooks', 'safo', 'info'] as const;

export interface CliArgs {
	readonly corpora: ReadonlySet<Corpus>;
	readonly dryRun: boolean;
	readonly forceRefresh: boolean;
	readonly verbose: boolean;
	readonly includeHandbooksExtras: boolean;
	readonly editionDate: string | null;
	readonly verify: boolean;
	readonly help: boolean;
	readonly noColor: boolean;
	/**
	 * Force the two-hop scrape path even when the per-handbook manifest already
	 * carries cached chapter URLs. Operator escape hatch when the FAA changes
	 * URL structure mid-edition.
	 */
	readonly rescrape: boolean;
	/**
	 * Per-corpus parallel-execution cap. Defaults to `SOURCE_DOWNLOAD_CONCURRENCY`
	 * (4); operator can override via `--concurrency=N` up to
	 * `SOURCE_DOWNLOAD_CONCURRENCY_MAX` (16).
	 */
	readonly concurrency: number;
}

export function isCorpus(s: string): s is Corpus {
	return (ALL_CORPORA as readonly string[]).includes(s);
}

export function parseArgs(argv: readonly string[]): CliArgs {
	let corpora: Set<Corpus> = new Set(ALL_CORPORA);
	let dryRun = false;
	let forceRefresh = false;
	let verbose = false;
	let includeHandbooksExtras = false;
	let editionDate: string | null = null;
	let verify = false;
	let help = false;
	let noColor = false;
	let rescrape = false;
	let concurrency: number = SOURCE_DOWNLOAD_CONCURRENCY;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') {
			help = true;
			continue;
		}
		if (arg === '--dry-run') {
			dryRun = true;
			continue;
		}
		if (arg === '--force-refresh') {
			forceRefresh = true;
			continue;
		}
		if (arg === '--verbose' || arg === '-v') {
			verbose = true;
			continue;
		}
		if (arg === '--verify') {
			verify = true;
			continue;
		}
		if (arg === '--include-handbooks-extras') {
			includeHandbooksExtras = true;
			continue;
		}
		if (arg === '--no-color') {
			noColor = true;
			continue;
		}
		if (arg === '--rescrape') {
			rescrape = true;
			continue;
		}
		if (arg.startsWith('--corpus=')) {
			const requested = arg
				.slice('--corpus='.length)
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			const validated = new Set<Corpus>();
			for (const c of requested) {
				if (!isCorpus(c)) {
					throw new Error(`unknown corpus "${c}" -- valid: ${ALL_CORPORA.join(', ')}`);
				}
				validated.add(c);
			}
			corpora = validated;
			continue;
		}
		if (arg.startsWith('--edition-date=')) {
			const value = arg.slice('--edition-date='.length);
			if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
				throw new Error(`--edition-date must be YYYY-MM-DD, got "${value}"`);
			}
			editionDate = value;
			continue;
		}
		if (arg.startsWith('--concurrency=')) {
			const raw = arg.slice('--concurrency='.length);
			const parsed = Number.parseInt(raw, 10);
			if (!Number.isFinite(parsed) || String(parsed) !== raw) {
				throw new Error(`--concurrency must be an integer, got "${raw}"`);
			}
			if (parsed < 1 || parsed > SOURCE_DOWNLOAD_CONCURRENCY_MAX) {
				throw new Error(
					`--concurrency must be between 1 and ${SOURCE_DOWNLOAD_CONCURRENCY_MAX} (inclusive), got ${parsed}`,
				);
			}
			concurrency = parsed;
			continue;
		}
		throw new Error(`unknown argument: ${arg}`);
	}

	return {
		corpora,
		dryRun,
		forceRefresh,
		verbose,
		includeHandbooksExtras,
		editionDate,
		verify,
		help,
		noColor,
		rescrape,
		concurrency,
	};
}

export const HELP_TEXT = `bun run sources download -- one-shot source-corpus downloader.

Usage:
  bun run sources download [flags]

Flags:
  --corpus=<list>              Comma-separated subset (regs,aim,ac,acs,handbooks,safo,info)
  --dry-run                    Plan only, no network calls
  --verify                     HEAD-only audit, no downloads (exits 1 if any URL fails)
  --force-refresh              Ignore existing cache, re-download
  --include-handbooks-extras   Add 8083-2/9/15/16/27/30/32/34
  --edition-date=YYYY-MM-DD    eCFR snapshot date (default: per-title latest_amended_on)
  --concurrency=N              Per-corpus parallel download cap (1..16, default 4)
  --rescrape                   Force two-hop chapter URL scrape even when manifest is cached
  --verbose                    Log every URL attempt + redirects
  --no-color                   Disable ANSI color in output (also honors NO_COLOR env)
  --help                       Show this help

Cache root:
  $AIRBOSS_HANDBOOK_CACHE (default: ~/Documents/airboss-handbook-cache/)

Layout (per ADR 021):
  <root>/handbooks/<slug>/<edition>/<edition>.pdf
  <root>/handbooks/<slug>/<edition>/<edition>-errata-<id>.pdf
  <root>/handbooks/<slug>/<edition>/manifest.json
  <root>/ac/<doc-id>.pdf                            (one per AC, flat)
  <root>/acs/<doc-id>.pdf                           (one per ACS, flat)
  <root>/aim/<edition>.pdf                          (one per AIM edition)
  <root>/safo/<doc-id>.pdf                          (one per SAFO bulletin, flat)
  <root>/info/<doc-id>.pdf                          (one per InFO bulletin, flat)
  <root>/regulations/cfr-<title>/<edition>.xml      (full title)
  <root>/regulations/cfr-<title>/<edition>-parts-<filter>.xml
  <root>/<flat-corpus>/manifest.json                (per-corpus index)

Idempotent: HEAD-checks each URL and skips files where content-length matches
the cached size and (etag matches OR last-modified has not advanced past the
manifest). Pass --force-refresh to override.
`;
