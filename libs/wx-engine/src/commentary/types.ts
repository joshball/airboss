/**
 * Layer-4 commentary callout shape.
 *
 * Each callout pins to one chart element or product field, asks a discovery-
 * first question, supplies the truth-model rationale, and references real
 * knowledge-node ids from `course/knowledge/weather/`. The shape mirrors
 * `docs/work-packages/wx-engine/spec.md` "Data model" + DESIGN.md
 * "Layer 4 derivation: commentary".
 *
 * The shape is browser-safe (pure types). Values (`deriveCommentary`,
 * `resolveKnowledgeNodeId`, `validateAllKnowledgeNodes`) live in
 * `@ab/wx-engine/server` and reach for `node:fs` for the resolver. The
 * runtime barrel re-exports `CommentaryCallout` as a type only.
 */

/** Pin target for a commentary callout. */
export interface CommentaryCalloutTarget {
	/** What kind of product or chart element the callout pins to. */
	kind: 'metar' | 'taf-period' | 'chart-feature' | 'airmet' | 'pirep' | 'fb-row';
	/**
	 * Chart slug when the callout points at a chart feature, AIRMET overlay,
	 * PIREP plot, or winds-aloft row. Must match an entry in
	 * `bundle.charts[*].slug`.
	 */
	chartSlug?: string;
	/**
	 * Element id within the target. Station ICAO for METAR / TAF / PIREP /
	 * fb-row callouts; AIRMET advisory id for AIRMET callouts; named feature
	 * id (e.g. `isobar-pack`, `front-position`, `cell-C-prefront-1`) for
	 * chart-feature callouts.
	 */
	elementId?: string;
}

/** Pedagogy mode: socratic prompts the learner; glance is a one-line cue. */
export type CommentaryMode = 'socratic' | 'glance';

/** Layer-4 commentary callout. */
export interface CommentaryCallout {
	/** Stable id of the form `wxc-<scenario-id>-<rule>-<elementId>`. */
	id: string;
	target: CommentaryCalloutTarget;
	/** Discovery-first question (What/Why/How for `socratic` mode). */
	question: string;
	/** The specific cue to look at -- raw text or a "see chart X" pointer. */
	observation: string;
	/** Truth-model rationale -- WHY this is the way it is. Cites named elements. */
	reason: string;
	/** Knowledge-graph node ids to surface as references. */
	knowledgeNodeIds: string[];
	mode: CommentaryMode;
}
