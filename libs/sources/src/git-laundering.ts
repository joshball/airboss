// @browser-globals: server-only -- never imported by client .svelte
/**
 * Sentinel-laundering safeguard.
 *
 * Source of truth: ADR 019 amendment 2026-05 §2 "Sentinel-laundering
 * safeguard". When a sentinel field is modified in the same commit as a
 * registry edition advance for the cited slug, the validator emits NOTICE
 * "sentinel updated against new edition -- reviewer should confirm content
 * equivalence." The check is build-time only and does NOT block the publish
 * gate (per ADR 019 §1.6).
 *
 * Implementation is git-aware: shells out to `git diff --name-only HEAD~1`
 * to find files modified in HEAD's commit and looks for two co-occurrences:
 *
 *   1. A file under `course/knowledge/**` (or wherever sentinels live in
 *      frontmatter) that touches a sentinel field.
 *   2. A registry-bearing file (a manifest, a sources-registry seed) that
 *      advances an edition for the cited slug.
 *
 * The registry-bearing fileset is corpus-specific. This module exposes the
 * git-plumbing surface and a small co-occurrence checker; the validator's
 * NOTICE-emitting code feeds it the cited slug and the file containing the
 * sentinel, and asks "did the same commit advance an edition for this
 * slug?". The corpus-specific edition-advance detection lives in this
 * module behind a small map -- one detector per corpus that owns
 * registry-bearing manifests.
 *
 * Browser safety: this file is server-only (CLI build path); the
 * `// @browser-globals: server-only` tag and the lazy node:* loads keep
 * the client bundle clean.
 */

interface NodeChildProcess {
	execFileSync(file: string, args: readonly string[], options?: { encoding?: string }): string;
}

/**
 * Read the list of files modified in HEAD's commit (HEAD~1..HEAD). Returns
 * an empty array when git is unavailable, when HEAD is the initial commit
 * (no HEAD~1), or when the call fails for any other reason. Build-time
 * concerns -- never blocks the publish gate per ADR 019 §1.6.
 */
export function getFilesChangedInHead(cwd: string): readonly string[] {
	if (typeof process === 'undefined') return [];
	const cp = process.getBuiltinModule?.('node:child_process') as NodeChildProcess | undefined;
	if (cp === undefined) return [];
	try {
		const out = cp.execFileSync('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], {
			encoding: 'utf-8',
			cwd,
		} as { encoding: string; cwd: string });
		return out
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	} catch {
		return [];
	}
}

/**
 * A corpus-specific predicate: given a list of files modified in the
 * current commit and a slug for the cited corpus entry, decide whether
 * the same commit advanced an edition for that slug. Implementations
 * should be tight: regex on path, optional content-peek if needed.
 */
export type EditionAdvanceDetector = (filesChanged: readonly string[], slug: string) => boolean;

const DETECTORS: Map<string, EditionAdvanceDetector> = new Map();

/**
 * Register a per-corpus edition-advance detector. The corpus key must be
 * one of ADR 019 §1.2's enumerated corpora; tests register fakes here too.
 */
export function registerEditionAdvanceDetector(corpus: string, detector: EditionAdvanceDetector): void {
	DETECTORS.set(corpus, detector);
}

/**
 * Default detector for the `handbooks` corpus. An edition advance manifests
 * as a change to `handbooks/<doc>/<faaDir>/manifest.json`. Doc slug appears
 * as the second path segment; the detector matches on that.
 */
export const handbooksEditionAdvanceDetector: EditionAdvanceDetector = (filesChanged, slug) => {
	const prefix = `handbooks/${slug}/`;
	for (const file of filesChanged) {
		if (!file.startsWith(prefix)) continue;
		if (file.endsWith('/manifest.json')) return true;
	}
	return false;
};

// Eagerly seed the handbooks detector so the validator works without
// per-test wiring. Other corpora register theirs when their resolver
// loads (or the cert-syllabus / regs WPs ship analogous detectors).
DETECTORS.set('handbooks', handbooksEditionAdvanceDetector);

/**
 * Returns true when the cited corpus's slug had an edition advance in the
 * current commit AND the citing file was also modified. Build-time only;
 * NOTICE-tier surface, never blocks the publish gate.
 *
 * @param corpus       The cited corpus (`'handbooks'`, `'regs'`, ...).
 * @param slug         The corpus-specific slug (`'phak'`, `'afh'`, ...).
 * @param citingFile   Path of the file containing the sentinel (repo-relative).
 * @param filesChanged Files changed in the current commit; pass `getFilesChangedInHead(cwd)`.
 */
export function isSentinelLaunderingCandidate(
	corpus: string,
	slug: string,
	citingFile: string,
	filesChanged: readonly string[],
): boolean {
	const detector = DETECTORS.get(corpus);
	if (detector === undefined) return false;
	const citingTouched = filesChanged.some((f) => f === citingFile || f.endsWith(`/${citingFile}`));
	if (!citingTouched) return false;
	return detector(filesChanged, slug);
}

/** Test-only surface: clear all registered detectors (then re-register). */
export const __git_laundering_internal__ = {
	clear(): void {
		DETECTORS.clear();
	},
	restoreDefaults(): void {
		DETECTORS.clear();
		DETECTORS.set('handbooks', handbooksEditionAdvanceDetector);
	},
	listDetectors(): readonly string[] {
		return Array.from(DETECTORS.keys());
	},
};
