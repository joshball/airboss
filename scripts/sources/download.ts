/**
 * `bun run sources download` -- entry point.
 *
 * Thin shim that delegates to the carved-out `download/` module. The split
 * exists so individual concerns (args, plans, http, manifest, freshness,
 * symlinks, summary, execute, run) can be reviewed and tested in isolation.
 *
 * See `scripts/README.sources.md` for the operator runbook.
 */

import { runDownloadSources } from './download/index';

export { __download_internal__, type RunOptions, runDownloadSources } from './download/index';

if (import.meta.main) {
	const code = await runDownloadSources({ argv: process.argv.slice(2) });
	process.exit(code);
}
