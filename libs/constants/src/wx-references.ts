/**
 * Constants for the weather-product reference page corpus.
 *
 * The 25 product reference pages live as markdown at
 * `course/weather/references/products/<slug>/page.md`. Each page carries an
 * `authoritative_sources:` block in its YAML frontmatter -- a list of FAA
 * document citations (AC 00-45H, AIM, FAA-H-8083-28, ...).
 *
 * - `WX_REFERENCE_PRODUCTS_DIR_SEGMENTS` is the on-disk directory path,
 *   expressed as path segments so callers join it onto the repo root with
 *   their own `path.join`. The page loader and the citation validator share
 *   this single source of truth.
 * - `WX_REFERENCE_STATUS_*` enumerates the page lifecycle status. `draft`
 *   pages may carry unverified citations; `done` pages may not -- the
 *   citation validator gates the promotion to `done`.
 *
 * Browser-safe: pure literals + types, no Node-only globals or imports.
 */

/**
 * Path segments, relative to the repo root, of the weather-product reference
 * page directory. Each immediate subdirectory is one product slug and holds a
 * `page.md`. Join with `path.join(repoRoot, ...WX_REFERENCE_PRODUCTS_DIR_SEGMENTS)`.
 */
export const WX_REFERENCE_PRODUCTS_DIR_SEGMENTS = ['course', 'weather', 'references', 'products'] as const;

/** The `page.md` basename every product reference page directory carries. */
export const WX_REFERENCE_PAGE_BASENAME = 'page.md';

/**
 * Lifecycle `status:` values authored in a product reference page frontmatter.
 *
 * - `draft` -- authored but not verified against the source PDFs; may carry
 *   `verified: false` citations.
 * - `done` -- promoted; every `authoritative_sources` entry must be
 *   `verified: true`. The citation validator enforces this.
 */
export const WX_REFERENCE_STATUS_DRAFT = 'draft';
export const WX_REFERENCE_STATUS_DONE = 'done';
export const WX_REFERENCE_STATUS_VALUES = [WX_REFERENCE_STATUS_DRAFT, WX_REFERENCE_STATUS_DONE] as const;
export type WxReferenceStatus = (typeof WX_REFERENCE_STATUS_VALUES)[number];
