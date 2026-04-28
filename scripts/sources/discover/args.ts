/**
 * `bun run sources discover-errata` argument parser.
 *
 * Hand-rolled parser to match the existing dispatcher style in
 * `scripts/sources/download/args.ts`. The flag set is intentionally narrow:
 * adding flags later is cheaper than retiring them.
 */

import { ALL_HANDBOOK_SLUGS } from './catalogue';

export interface DiscoverArgs {
	/** Restrict the scan to specific handbook slugs. Empty = scan all. */
	readonly slugs: readonly string[];
	/**
	 * Skip the freshness gate and re-scan even when `_last_run.json` is
	 * within the freshness window. Used by the weekly cron to guarantee
	 * progress regardless of the dev-server hook's cadence.
	 */
	readonly force: boolean;
	/**
	 * Skip GitHub API calls and DRS-link side effects. State files are still
	 * written to a temp directory if `tempStateRoot` is provided; otherwise
	 * the run is read-only and prints what it would do.
	 */
	readonly dryRun: boolean;
	/** Print help and exit. */
	readonly help: boolean;
	/** Override the cache root (test seam). */
	readonly cacheRoot: string | null;
}

export const DISCOVER_HELP_TEXT = `bun run sources discover-errata [options]

  Scan FAA handbook parent pages for newly-published errata / addenda. Surfaces
  candidates as a markdown report under \`<cache>/discovery/_pending.md\` and,
  when \`GH_TOKEN\` is set, opens a GitHub issue per new candidate.

  Triggers (any one fires this command, all freshness-gated):
    1. Weekly launchd cron
    2. Side effect of \`bun run sources download\`
    3. Server startup hook in apps/study/

  Options:
    --doc=<slug>[,<slug>]  Restrict scan to specific handbook slugs.
                           Default = all 17 catalogued handbooks.
    --force                Skip the 7-day freshness gate.
    --dry-run              Skip GitHub issue creation; print what would happen.
    --cache-root=<path>    Override AIRBOSS_HANDBOOK_CACHE for this run.
    --help, -h             Print this banner.

  Catalogued handbooks (${ALL_HANDBOOK_SLUGS.length}):
    ${ALL_HANDBOOK_SLUGS.join(', ')}
`;

export class ArgParseError extends Error {}

export function parseDiscoverArgs(argv: readonly string[]): DiscoverArgs {
	let force = false;
	let dryRun = false;
	let help = false;
	let cacheRoot: string | null = null;
	const slugs: string[] = [];

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') {
			help = true;
			continue;
		}
		if (arg === '--force') {
			force = true;
			continue;
		}
		if (arg === '--dry-run') {
			dryRun = true;
			continue;
		}
		if (arg.startsWith('--doc=')) {
			const value = arg.slice('--doc='.length);
			for (const slug of value.split(',')) {
				const trimmed = slug.trim().toLowerCase();
				if (trimmed.length === 0) continue;
				if (!ALL_HANDBOOK_SLUGS.includes(trimmed)) {
					throw new ArgParseError(`unknown handbook slug '${trimmed}'. Available: ${ALL_HANDBOOK_SLUGS.join(', ')}.`);
				}
				slugs.push(trimmed);
			}
			continue;
		}
		if (arg.startsWith('--cache-root=')) {
			cacheRoot = arg.slice('--cache-root='.length);
			continue;
		}
		throw new ArgParseError(`unknown option: ${arg}`);
	}

	return { slugs, force, dryRun, help, cacheRoot };
}
