/**
 * ACS / PTS citation formatter.
 *
 * Source of truth: ADR 019 §3.1 (token vocabulary), §2.2
 * (`CorpusResolver.formatCitation`).
 *
 * Three pre-computed styles live on `SourceEntry` (canonical_short,
 * canonical_formal, canonical_title); the formatter just picks one.
 *
 *   short   -> 'PPL ACS V.A.K1'
 *   formal  -> 'Private Pilot -- Airplane ACS (FAA-S-ACS-25), Area V Task A Element K1'
 *   title   -> 'Aerodynamics of steep turns'
 */

import type { CitationStyle } from '../registry/corpus-resolver.ts';
import type { SourceEntry } from '../types.ts';

export function formatAcsCitation(entry: SourceEntry, style: CitationStyle): string {
	switch (style) {
		case 'short':
			return entry.canonical_short;
		case 'formal':
			return entry.canonical_formal;
		case 'title':
			return entry.canonical_title;
		default: {
			const exhaustive: never = style;
			throw new Error(`unknown citation style for acs entry: ${exhaustive as string}`);
		}
	}
}
