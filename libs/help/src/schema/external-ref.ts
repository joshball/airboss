/**
 * External references attached to a help/concept page.
 *
 * Rendered as a formatted footer section on the page (like an academic
 * paper's "References" block). Source badges distinguish Wikipedia, FAA,
 * papers, books, and other hosts; the renderer can also infer a badge
 * from an inline link's hostname when the author didn't annotate it.
 */

export type ExternalRefSource = 'wikipedia' | 'faa' | 'paper' | 'book' | 'other';

/** Ordered set of valid source values for enum-style checks. */
export const EXTERNAL_REF_SOURCE_VALUES: readonly ExternalRefSource[] = ['wikipedia', 'faa', 'paper', 'book', 'other'];

export interface ExternalRef {
	/** Display title for the reference (human-readable, required). */
	title: string;
	/** Canonical URL. Must be https and must not resolve to a private-network host. */
	url: string;
	/** Source badge. Authors set this explicitly; inline-link rendering infers. */
	source: ExternalRefSource;
	/** Optional 1-sentence note about what the reference covers. */
	note?: string;
}

/**
 * Derive an `ExternalRefSource` from a URL hostname. Used by the markdown
 * renderer for inline external links so authors don't have to annotate
 * every external `[text](url)` with a source.
 */
export function sourceFromUrl(url: string): ExternalRefSource {
	try {
		const host = new URL(url).hostname.toLowerCase();
		if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) return 'wikipedia';
		if (host === 'faa.gov' || host.endsWith('.faa.gov')) return 'faa';
		if (host === 'arxiv.org' || host.endsWith('.arxiv.org')) return 'paper';
		if (host === 'doi.org' || host.endsWith('.doi.org')) return 'paper';
		return 'other';
	} catch {
		return 'other';
	}
}
