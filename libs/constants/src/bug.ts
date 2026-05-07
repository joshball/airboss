/**
 * Bug-tracker frontmatter vocabulary. Phase 6 of `tracking-system-overhaul`.
 *
 * Every `docs/bugs/<slug>.md` carries a YAML frontmatter block whose enums
 * are validated against the constants below. Schema lives in `@ab/types`
 * (`libs/types/src/bug.ts`) and consumes these values.
 *
 * Lives in `@ab/constants` so that the lint script, the read-only +
 * mutation CLI (`scripts/bug.ts`), and the future hangar `/bugs` view all
 * narrow on the same source of truth. Mirrors the WP pattern from ADR 025.
 *
 * Bug `product` reuses `WP_PRODUCTS` (see `./work-package.ts`) rather than
 * defining its own surface enum -- a bug filed against the study app
 * filters under the same `--product study` flag as the WPs that target it.
 */

/** Bug severity. Closed vocabulary, ordered roughly by impact. */
export const BUG_SEVERITIES = ['blocking', 'major', 'minor', 'nit'] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

/** Bug lifecycle status. */
export const BUG_STATUSES = ['open', 'wontfix', 'duplicate', 'fixed'] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

/** Workspace-relative path to the bugs directory. */
export const BUG_DIR = 'docs/bugs';

/** Glob (relative to repo root) the loader walks. Excludes the generated
 * INDEX.md and any `.archive/` subtree. */
export const BUG_FILE_GLOB = 'docs/bugs/bug-*.md';
