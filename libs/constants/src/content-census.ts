/**
 * Content-census thresholds and derived-state rules.
 *
 * The `libs/content-census/` corpus adapters classify every content item
 * into a derived state (Layer 1 of the census -- see
 * `docs/work-packages/hangar-content-census/design.md`). Every numeric
 * threshold those rules depend on lives here so the rule is one named
 * constant, not a magic number buried in an adapter.
 *
 * Pure data -- no `node:*`, browser-safe. The adapters themselves are
 * server-only; these constants are not.
 */

/**
 * A knowledge node is `draft` rather than `complete` when fewer than this
 * many of its seven `:::phase` directives carry authored prose. A node with
 * zero authored phases is a `skeleton`; the discovery-first pedagogy (ADR
 * 011) hinges on the Discover and Reveal phases in particular, so both must
 * be authored for a node to count as `complete`.
 */
export const KNOWLEDGE_NODE_COMPLETE_PHASE_MIN = 7;

/**
 * The two phases whose presence the knowledge derived-state rule treats as
 * load-bearing. A node with body prose but no Discover+Reveal pair cannot
 * deliver the discovery-first arc and is classified `draft` at best.
 */
export const KNOWLEDGE_NODE_REQUIRED_PHASES = ['discover', 'reveal'] as const;

/**
 * A node's card deck is `rich` when it carries at least this many cards,
 * `thin` when it has one or more but fewer than this, and `none` with zero.
 * Five is the smallest deck that can exercise a topic from more than one
 * angle (recall + application + a couple of discriminators).
 */
export const NODE_CARD_RICH_MIN = 5;

/**
 * A regulations course week is `full` only when it carries an overview, all
 * of its numbered lesson files, a drills file, and an oral file -- and every
 * lesson file clears the skeleton-body threshold below. Anything short of
 * that is `partial`.
 */
export const REGULATIONS_WEEK_REQUIRED_MODALITIES = ['overview', 'drills', 'oral'] as const;

/**
 * A course markdown file (a regulations lesson) counts as authored, not a
 * skeleton, when its body -- the content after the frontmatter fence -- has
 * at least this many non-blank lines. A freshly scaffolded lesson file is a
 * heading plus a TODO; a real lesson clears this comfortably.
 */
export const COURSE_FILE_AUTHORED_BODY_MIN_LINES = 12;

/**
 * A vision / PRD document is classified by its authored `prd_depth`
 * frontmatter: `full` and `vision` depth read as `fleshed-out`; `light`
 * reads as `outline`; a missing or unrecognised depth, or a `status`
 * naming a stub / spike, reads as `stub`.
 */
export const VISION_FLESHED_OUT_DEPTHS = ['full', 'vision'] as const;
export const VISION_OUTLINE_DEPTHS = ['light'] as const;
