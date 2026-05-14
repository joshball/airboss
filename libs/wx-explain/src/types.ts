/**
 * `@ab/wx-explain` -- per-token annotations.
 *
 * The output shape every `explainX` function in this lib produces. A
 * `TokenAnnotation` decodes one token of a parsed weather product into
 * (a) what the token literally says and (b) optionally why the air mass
 * produced it. The `why` line is only emitted when a `TruthModel` is
 * supplied; bare decode mode (`why` absent) is the catalog-style ladder
 * step.
 */

export interface TokenAnnotation {
	/** The raw token as it appears in the product (e.g. `28019G31KT`, `+TSRA`). */
	token: string;
	/** Catalog token-family slug (e.g. `wind-gust`, `wx-heavy`, `sigmet-va`). */
	family: string;
	/** Plain-English decode of the token. Always present. */
	decode: string;
	/** Optional synoptic explanation drawn from a TruthModel. Omitted when no TruthModel is supplied. */
	why?: string;
}
