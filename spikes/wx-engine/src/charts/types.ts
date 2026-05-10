/**
 * Spike 01 -- chart artifact shape produced by layer-3 derivation.
 */

export interface ChartArtifact {
	/** wx-charts slug (matches the data/charts/wx/<slug>/ directory). */
	slug: string;
	/** spec.yaml content (will be serialized via yaml lib). */
	spec: object;
	/** Cache files this spec references. Each file is written to the dev cache root. */
	sources: Array<{ cacheRelPath: string; content: string }>;
}
