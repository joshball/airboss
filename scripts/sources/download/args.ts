/**
 * Argument parsing for `bun run sources download`.
 *
 * Pure transform from `argv` to a typed `CliArgs`. The actual side-effecting
 * orchestration (HEAD requests, file writes, summary printing) lives in
 * sibling modules.
 */

export type Corpus = 'regs' | 'aim' | 'ac' | 'acs' | 'handbooks';

export const ALL_CORPORA: readonly Corpus[] = ['regs', 'aim', 'ac', 'acs', 'handbooks'] as const;

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
	};
}

export const HELP_TEXT = `bun run sources download -- one-shot source-corpus downloader.

Usage:
  bun run sources download [flags]

Flags:
  --corpus=<list>              Comma-separated subset (regs,aim,ac,acs,handbooks)
  --dry-run                    Plan only, no network calls
  --verify                     HEAD-only audit, no downloads (exits 1 if any URL fails)
  --force-refresh              Ignore existing cache, re-download
  --include-handbooks-extras   Add 8083-2/9/15/16/27/30/32/34
  --edition-date=YYYY-MM-DD    eCFR snapshot date (default: per-title latest_amended_on)
  --verbose                    Log every URL attempt + redirects
  --no-color                   Disable ANSI color in output (also honors NO_COLOR env)
  --help                       Show this help

Cache root:
  $AIRBOSS_HANDBOOK_CACHE (default: ~/Documents/airboss-handbook-cache/)

Per-doc layout:
  <root>/<corpus>/<doc>/<edition>/<descriptive>.<ext>
  <root>/<corpus>/<doc>/<edition>/source.<ext>      (symlink for new corpora)
  <root>/<corpus>/<doc>/<edition>/manifest.json

Idempotent: HEAD-checks each URL and skips files where content-length matches
the cached size and (etag matches OR last-modified has not advanced past the
manifest). Pass --force-refresh to override.
`;
