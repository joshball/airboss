#!/usr/bin/env bun
/**
 * Reference + content validator.
 *
 * Combines the two validation layers from @ab/aviation:
 *
 *   1) validateReferences(AVIATION_REFERENCES) -- schema + tag + related
 *      symmetry + verbatim/sources coherence gates.
 *   2) validateContentWikilinks(scan, registry) -- every
 *      `[[display::id]]` id in content resolves; broken links error,
 *      TBD-id links warn.
 *
 * Exit code 1 on any error; exit 0 on clean or warnings-only. Output goes
 * to stdout + stderr; no JSON for Phase 1 (check dispatcher just reads
 * exit code + log).
 */

import {
	AVIATION_REFERENCES,
	hasReference,
	listReferences,
	validateContentWikilinks,
	validateReferences,
} from '@ab/aviation';
import { scanContent } from './scan';

function print(prefix: string, message: string, referenceId?: string, location?: string): void {
	const pieces = [prefix, message];
	if (referenceId) pieces.push(`[ref:${referenceId}]`);
	if (location) pieces.push(`[${location}]`);
	console.log(pieces.join(' '));
}

const refResult = validateReferences(AVIATION_REFERENCES);

const { scans } = scanContent();
const contentResult = validateContentWikilinks(scans, {
	hasReference,
	knownIds: listReferences().map((r) => r.id),
});

const allErrors = [...refResult.errors, ...contentResult.errors];
const allWarnings = [...refResult.warnings, ...contentResult.warnings];

for (const w of allWarnings) {
	print('warn:', w.message, w.referenceId, w.location);
}

if (allErrors.length > 0) {
	for (const e of allErrors) {
		print('error:', e.message, e.referenceId, e.location);
	}
	console.error(`\nreferences: ${allErrors.length} error(s), ${allWarnings.length} warning(s).`);
	process.exit(1);
}

console.log(
	`references: 0 errors, ${allWarnings.length} warning(s); scanned ${scans.length} content location(s), ${contentResult.summary.linkCount} wiki-link(s).`,
);
