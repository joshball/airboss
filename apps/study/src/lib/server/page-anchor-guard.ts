/**
 * Page-anchor static guard (study-app-ia-cleanup Phase 4).
 *
 * Scans `apps/study/src/routes/(app)/**\/+page.svelte` and reports every
 * page that does not surface a `data-testid="page-anchor"` somewhere in
 * its render path. The page-anchor testid is the canonical
 * existence-sentinel for the IA: every top-level route exposes it on the
 * primary heading so the e2e flow can assert "this page rendered" with a
 * single contract rather than hand-rolling per-page selectors.
 *
 * The guard is intentionally conservative: it accepts the testid via
 * - direct presence in the page file
 * - presence in any sibling `_panels/*.svelte` file
 * - presence in any wider component the page mounts whose source we can
 *   still find by simple module-name lookup (PageHeader, ReferencePage,
 *   HelpLayout). These are the project's canonical heading wrappers and
 *   they all land the testid themselves.
 *
 * This is a static check (fs glob + regex). It runs in Vitest, not
 * Playwright, so it stays cheap, deterministic, and CI-loud. The
 * Playwright `ia-flow.spec.ts` walks the same routes and asserts the
 * testid is *visible*; the static guard catches new routes whose authors
 * forgot to add it before they ever reach the e2e suite.
 */

const HAS_NODE = typeof process !== 'undefined' && typeof process.getBuiltinModule === 'function';

interface PageAuditResult {
	/** Path to the +page.svelte under audit, relative to repo root. */
	path: string;
	/** Whether the page surfaces `data-testid="page-anchor"` somewhere. */
	hasAnchor: boolean;
	/** Why the guard concluded `hasAnchor`. Empty if `hasAnchor` is false. */
	matchedVia: 'direct' | 'panel' | 'wrapper' | null;
}

const ANCHOR_RE = /data-testid=["']page-anchor["']/;

/**
 * The wrapper components that render an `<h1 data-testid="page-anchor">`
 * for the page that mounts them. If a page's source includes the wrapper
 * tag, the page is considered anchored without further checking.
 */
const ANCHOR_WRAPPERS: ReadonlyArray<string> = [
	'<PageHeader',
	'<ReferencePage',
	'<HelpLayout',
	// `<CardHeaderPanel` carries the anchor on the memory-card detail page;
	// listed explicitly so the page-level audit does not have to crawl into
	// `_panels/`.
	'<CardHeaderPanel',
];

/**
 * Run the static page-anchor audit against the `(app)` route tree.
 *
 * Returns the per-page result set. Pass to a Vitest assertion to fail
 * the run on any `hasAnchor === false`.
 */
export function auditPageAnchors(routesRoot: string): PageAuditResult[] {
	if (!HAS_NODE) throw new Error('auditPageAnchors must run in a Node-capable runtime (Vitest, scripts).');
	// Lazy-load Node built-ins so the module stays browser-safe per the
	// `noNodejsModules` rule on `libs/*`. This file lives in `apps/study`
	// so the rule does not apply, but the pattern is consistent with the
	// rest of the codebase.
	const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs');
	const path = process.getBuiltinModule('node:path') as typeof import('node:path');

	const pageFiles: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const next = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(next);
			} else if (entry.isFile() && entry.name === '+page.svelte') {
				pageFiles.push(next);
			}
		}
	};
	walk(routesRoot);

	const results: PageAuditResult[] = [];
	for (const file of pageFiles) {
		const source = fs.readFileSync(file, 'utf8');
		if (ANCHOR_RE.test(source)) {
			results.push({ path: file, hasAnchor: true, matchedVia: 'direct' });
			continue;
		}
		// Wrapper components (`<PageHeader>` et al.) carry the anchor
		// themselves; if the page mounts one, treat the page as anchored.
		if (ANCHOR_WRAPPERS.some((tag) => source.includes(tag))) {
			results.push({ path: file, hasAnchor: true, matchedVia: 'wrapper' });
			continue;
		}
		// Sibling `_panels/*.svelte` files often render the page's primary
		// heading. Walk just one level deep -- panels nested deeper are
		// unusual and would lose the "page-level h1" semantic anyway.
		const dir = path.dirname(file);
		const panelsDir = path.join(dir, '_panels');
		if (fs.existsSync(panelsDir)) {
			let panelMatched = false;
			for (const entry of fs.readdirSync(panelsDir, { withFileTypes: true })) {
				if (!entry.isFile() || !entry.name.endsWith('.svelte')) continue;
				const panelSource = fs.readFileSync(path.join(panelsDir, entry.name), 'utf8');
				if (ANCHOR_RE.test(panelSource)) {
					panelMatched = true;
					break;
				}
			}
			if (panelMatched) {
				results.push({ path: file, hasAnchor: true, matchedVia: 'panel' });
				continue;
			}
		}
		results.push({ path: file, hasAnchor: false, matchedVia: null });
	}
	return results;
}
