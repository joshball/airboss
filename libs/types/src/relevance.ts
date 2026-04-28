/**
 * Knowledge-node relevance entry.
 *
 * Lives on `knowledge_node.relevance` as a JSONB array. The array is a derived
 * cache rebuilt from authored syllabi by `bun run db build:relevance` (see
 * the cert-syllabus-and-goal-composer WP). Authoring touches relevance only
 * indirectly via the syllabus + leaf links; the YAML frontmatter on
 * `course/knowledge/<slug>/node.md` no longer carries a `relevance:` field
 * after the migration cutover.
 *
 * Shape: one entry per (cert, bloom) pair the node is exercised by, plus a
 * derived `priority` capturing whether the node is examiner-grade for this
 * cert (`critical`), inherited from a downstream cert (`standard`), or only
 * adjacent (`stretch`). Highest bloom wins per `(node, cert)` pair on
 * deduplication.
 */

import type { BloomLevel, Cert, StudyPriority } from '@ab/constants';

export interface RelevanceEntry {
	/** Cert slug -- `private`, `instrument`, `commercial`, `cfi`, ... */
	cert: Cert;
	/** Bloom level the cert's syllabus exercises this node at. */
	bloom: BloomLevel;
	/** Derived priority for spending study time on this node for this cert. */
	priority: StudyPriority;
}
