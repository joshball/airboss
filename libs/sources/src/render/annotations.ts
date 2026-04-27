/**
 * Annotation cascade per ADR 019 §3.4 + §6.3.
 *
 * Pure data: given a resolved entry, its supersession chain, the lesson's
 * acknowledgments slice that targets this id, and the lesson-level
 * `historical_lens` flag, produce a `ResolvedAnnotation` describing what
 * the renderer should display.
 *
 * Each render mode then PLACES the annotation per §3.1's render-mode table
 * (tooltip in web, footnote in print, omitted in TTS, inline-parenthetical
 * in plain-text, etc.). The annotation kind + text is mode-agnostic.
 */

import type { LessonAcknowledgment, ResolvedAnnotation, SourceEntry, SourceId } from '../types.ts';

export interface AnnotationInput {
	/** The matched SourceEntry, or null when the registry has no entry. */
	readonly entry: SourceEntry | null;
	/** Supersession chain from `entry` forward. `chain[0]` is `entry`. */
	readonly chain: readonly SourceEntry[];
	/** Acks targeting this id (matched by raw target or reference label). */
	readonly matchingAcks: readonly LessonAcknowledgment[];
	/** Lesson-level historical-lens flag. */
	readonly historicalLens: boolean;
	/**
	 * Resolver for "given an id, walk forward in the supersession chain". The
	 * cascade walks chains rooted at the ack's `superseder`, which may differ
	 * from the entry's own chain root.
	 */
	readonly walkChain: (id: SourceId) => readonly SourceEntry[];
}

/** Compute the annotation per the §3.4 + §6.3 cascade rules. */
export function computeAnnotation(input: AnnotationInput): ResolvedAnnotation {
	const { entry, chain, matchingAcks, historicalLens, walkChain } = input;

	// 1. Per-target ack with `historical: true` -> historical (overrides lens).
	for (const ack of matchingAcks) {
		if (ack.historical) {
			return { kind: 'historical', text: '(historical reference)', note: ack.note };
		}
	}

	// 2. Per-target ack with a `superseder` -> walk chain from superseder; emit
	// `covered` when the chain end IS the superseder, `chain-advanced` when the
	// chain has moved past it.
	for (const ack of matchingAcks) {
		if (ack.superseder !== undefined) {
			const superChain = walkChain(ack.superseder);
			const chainEnd = superChain[superChain.length - 1];
			if (chainEnd === undefined) {
				// Superseder isn't in the registry. Fall through to the cross-corpus
				// / no-op branches below.
				continue;
			}
			if (chainEnd.id === ack.superseder) {
				const reasonText = ack.reason !== undefined ? `; ${ack.reason}` : '';
				return {
					kind: 'covered',
					text: `(acknowledged ${chainEnd.canonical_short} supersession${reasonText})`,
					note: ack.note,
				};
			}
			return {
				kind: 'chain-advanced',
				text: '(ack chain advanced; please re-validate)',
				note: ack.note,
			};
		}
	}

	// 3. Per-target ack without superseder (e.g. just a note attached). The ack
	// suppresses the validator's row-13 warning but doesn't emit annotation
	// text; the note may still travel to a tooltip/footnote.
	if (matchingAcks.length > 0) {
		const note = matchingAcks[0]?.note;
		return { kind: 'none', text: '', note };
	}

	// 4. Lesson-level historical lens overrides when no per-target ack exists.
	if (historicalLens) {
		return { kind: 'historical', text: '(historical reference)' };
	}

	// 5. Cross-corpus supersession detection: walk the entry's own chain; if it
	// crosses corpora, emit `cross-corpus` annotation.
	if (entry !== null && chain.length >= 2) {
		const last = chain[chain.length - 1];
		if (last !== undefined && last.corpus !== entry.corpus) {
			return {
				kind: 'cross-corpus',
				text: `(via ${last.canonical_short} in ${last.corpus})`,
			};
		}
	}

	// 6. Default: no annotation. Validator's row-13 WARNING handles same-corpus
	// supersession surfaces; the renderer doesn't double-surface.
	return { kind: 'none', text: '' };
}

/**
 * Filter acks to those whose `target` matches `rawId` (pin-stripped) or whose
 * reference label `id` matches the body's link reference.
 *
 * Per ADR 019 §3.4: when a lesson has multiple acks for the same target, each
 * binding link MUST use a reference label, and the renderer matches by label
 * to disambiguate. When the link does NOT have a reference label (inline
 * link), every ack with a matching target binds.
 */
export function findMatchingAcks(
	acks: readonly LessonAcknowledgment[],
	rawId: string,
	referenceLabel: string | null,
): readonly LessonAcknowledgment[] {
	const stripped = stripPinFromRaw(rawId);
	if (referenceLabel !== null) {
		return acks.filter((a) => a.id === referenceLabel);
	}
	return acks.filter((a) => stripPinFromRaw(a.target) === stripped);
}

function stripPinFromRaw(raw: string): string {
	const q = raw.indexOf('?');
	return q === -1 ? raw : raw.slice(0, q);
}
