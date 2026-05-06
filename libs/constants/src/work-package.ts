/**
 * Work-package frontmatter vocabulary. ADR 025.
 *
 * Every `docs/work-packages/<slug>/spec.md` carries a YAML frontmatter block
 * whose enums are validated against the constants below. Schema lives in
 * `@ab/types` (`libs/types/src/work-package.ts`) and consumes these values.
 *
 * Lives in `@ab/constants` so that the lint script, the read-only CLI
 * (`scripts/wp.ts`), and the future hangar `/roadmap` view all narrow on the
 * same source of truth.
 */

/** Single source of truth for the human-controlled email that owns
 * `human_review_status`. Lint rejects any agent commit (`git config user.email`
 * != this value) that mutates the field. */
export const WP_HUMAN_REVIEWER_EMAIL = 'joshua.g.s.ball@gmail.com';

/** Product / surface a WP belongs to. `none` is the escape hatch for cross-cutting
 * platform work that does not target a single app. */
export const WP_PRODUCTS = ['study', 'hangar', 'sim', 'flightbag', 'avionics', 'platform', 'course', 'none'] as const;
export type WPProduct = (typeof WP_PRODUCTS)[number];

/** Closed category vocabulary -- five values, intentionally small. Course
 * content is `content` with `tags: [course]`; do not add a `course` category. */
export const WP_CATEGORIES = ['product', 'feature', 'content', 'docs', 'platform'] as const;
export type WPCategory = (typeof WP_CATEGORIES)[number];

/** WP lifecycle status. */
export const WP_STATUSES = ['draft', 'signed-off', 'in-flight', 'shipped', 'abandoned', 'superseded'] as const;
export type WPStatus = (typeof WP_STATUSES)[number];

/** Agent-controlled review state. Flips to `done` after a self-review pass
 * (lint clean, tests green, /ball-review-* clean). */
export const WP_AGENT_REVIEW_STATUSES = ['pending', 'done'] as const;
export type WPAgentReviewStatus = (typeof WP_AGENT_REVIEW_STATUSES)[number];

/** Human-controlled review state. **USER ONLY** -- lint rejects any agent
 * commit that changes this value. */
export const WP_HUMAN_REVIEW_STATUSES = ['pending', 'walked', 'signed-off'] as const;
export type WPHumanReviewStatus = (typeof WP_HUMAN_REVIEW_STATUSES)[number];

/** Who drives the next step on the WP. */
export const WP_OWNERS = ['agent', 'user'] as const;
export type WPOwner = (typeof WP_OWNERS)[number];

/** Workspace-relative path to the work-package directory. */
export const WP_DIR = 'docs/work-packages';

/** Spec filename. The loader keys WP id from the parent directory name. */
export const WP_SPEC_FILE = 'spec.md';
