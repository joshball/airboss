/**
 * Phase 5 -- diff job + rewriter shared types.
 *
 * Source of truth: ADR 019 §5 (versioning workflow), §6.1 (alias kinds).
 */

import type { EditionId, SourceId } from '../types.ts';
import type { EditionPair } from './pair-walker.ts';

export type DiffOutcomeKind =
	| 'auto-advance'
	| 'needs-review'
	| 'alias-silent'
	| 'alias-content'
	| 'alias-cross'
	| 'alias-split'
	| 'alias-merge'
	| 'missing-old'
	| 'missing-new';

export interface DiffOutcome {
	readonly pair: EditionPair;
	readonly kind: DiffOutcomeKind;
	readonly oldHash: string | null;
	readonly newHash: string | null;
	/** Filled when `kind === 'needs-review'` or `kind === 'alias-content'`. */
	readonly diffSnippet?: string;
	/** Filled for any alias-* kind. The `to` from the AliasEntry. */
	readonly aliasTo?: SourceId | readonly SourceId[];
}

export interface DiffReport {
	readonly schemaVersion: 1;
	readonly corpus: string;
	readonly editionPair: { readonly old: EditionId; readonly new: EditionId };
	readonly generatedAt: string;
	readonly counts: Record<DiffOutcomeKind, number>;
	readonly outcomes: readonly DiffOutcome[];
}

export interface RewriteSkip {
	readonly file: string;
	readonly reason: string;
}

export interface RewriteReport {
	readonly schemaVersion: 1;
	readonly corpus: string;
	readonly editionPair: { readonly old: EditionId; readonly new: EditionId };
	readonly filesScanned: number;
	readonly filesRewritten: number;
	readonly occurrencesAdvanced: number;
	readonly skipped: readonly RewriteSkip[];
}

export const ALL_OUTCOME_KINDS: readonly DiffOutcomeKind[] = [
	'auto-advance',
	'needs-review',
	'alias-silent',
	'alias-content',
	'alias-cross',
	'alias-split',
	'alias-merge',
	'missing-old',
	'missing-new',
];

/**
 * Outcome kinds whose lessons can be safely auto-advanced by the rewriter.
 * `cross-section`, `split`, and `content-change` aliases are NEVER auto-
 * advanced -- the author must read the new section and decide.
 */
export const ADVANCEABLE_KINDS: ReadonlySet<DiffOutcomeKind> = new Set<DiffOutcomeKind>([
	'auto-advance',
	'alias-silent',
	'alias-merge',
]);
