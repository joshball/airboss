/**
 * Legacy IA redirects (study-app-ia-cleanup Phase 3).
 *
 * Phase 3 renamed `/dashboard` → `/insights`, folded `/calibration`,
 * `/lens/*`, `/knowledge/*`, `/glossary/*` under their new section
 * homes (`/insights/...`, `/reference/...`), and rolled `/credentials`,
 * `/goals`, `/plans` under `/program/*` (already wired in Phase 2 but
 * the redirects only land here, in Phase 3).
 *
 * The resolver is a pure function over `(pathname, search)` so it's
 * unit-testable without the SvelteKit handle. The handle wrapper in
 * `hooks.server.ts` runs this BEFORE auth so an unauthenticated user
 * hitting `/dashboard` lands cleanly on `/insights` (or
 * `/login?redirectTo=/insights` if the new path is auth-gated).
 *
 * Schedule for removal: 6 months after Phase 3 ships, per design.md.
 * Removing the table is one delete; if a redirect still has traffic at
 * the 6-month mark, decide -- delete + accept the breakage, or
 * formalize the alias.
 */

import { ROUTES } from '@ab/constants';

interface LegacyRedirectRule {
	/** Anchored pattern -- matches the entire pathname (no trailing-slash quirks here; the resolver normalises). */
	readonly from: RegExp;
	/** Build the new path from the regex match. The query string is preserved by the caller. */
	readonly to: (match: RegExpExecArray) => string;
}

/**
 * Ordered list of legacy patterns. Order matters: the first match wins,
 * so put more-specific child patterns before their parent. Each entry
 * targets a literal path segment (no `?...` query) so the rule stays
 * grep-able. Query strings are appended by `resolveLegacyRedirect`.
 */
const RULES: readonly LegacyRedirectRule[] = [
	// Dashboard (singleton).
	{ from: /^\/dashboard\/?$/, to: () => ROUTES.INSIGHTS },
	// Calibration.
	{ from: /^\/calibration\/?$/, to: () => ROUTES.INSIGHTS_CALIBRATION },
	// Lens family -- keep specificity ordered: weakness/[severity], weakness, handbook/[doc]/[chapter], handbook/[doc], handbook, lens.
	{
		from: /^\/lens\/weakness\/([^/]+)\/?$/,
		to: (m) => ROUTES.INSIGHTS_LENS_WEAKNESS_BUCKET(decodeURIComponent(m[1] ?? '')),
	},
	{ from: /^\/lens\/weakness\/?$/, to: () => ROUTES.INSIGHTS_LENS_WEAKNESS },
	{
		from: /^\/lens\/handbook\/([^/]+)\/([^/]+)\/?$/,
		to: (m) => ROUTES.INSIGHTS_LENS_HANDBOOK_CHAPTER(decodeURIComponent(m[1] ?? ''), decodeURIComponent(m[2] ?? '')),
	},
	{
		from: /^\/lens\/handbook\/([^/]+)\/?$/,
		to: (m) => ROUTES.INSIGHTS_LENS_HANDBOOK_DOC(decodeURIComponent(m[1] ?? '')),
	},
	{ from: /^\/lens\/handbook\/?$/, to: () => ROUTES.INSIGHTS_LENS_HANDBOOK },
	{ from: /^\/lens\/?$/, to: () => ROUTES.INSIGHTS_LENS },
	// Knowledge family.
	{
		from: /^\/knowledge\/([^/]+)\/learn\/?$/,
		to: (m) => ROUTES.REFERENCE_KNOWLEDGE_LEARN(decodeURIComponent(m[1] ?? '')),
	},
	{
		from: /^\/knowledge\/([^/]+)\/?$/,
		to: (m) => ROUTES.REFERENCE_KNOWLEDGE_SLUG(decodeURIComponent(m[1] ?? '')),
	},
	{ from: /^\/knowledge\/?$/, to: () => ROUTES.REFERENCE_KNOWLEDGE },
	// Glossary family.
	{
		from: /^\/glossary\/([^/]+)\/?$/,
		to: (m) => ROUTES.REFERENCE_GLOSSARY_ID(decodeURIComponent(m[1] ?? '')),
	},
	{ from: /^\/glossary\/?$/, to: () => ROUTES.REFERENCE_GLOSSARY },
	// Phase 2 surfaces (Quals / Goals / Plans -> /program/*). The Phase 2
	// PR moved the canonical paths but did not install hook-level
	// redirects; Phase 3 does the redirect plumbing for the entire
	// rename batch in one place.
	{
		from: /^\/credentials\/([^/]+)\/areas\/([^/]+)\/?$/,
		to: (m) => ROUTES.PROGRAM_QUAL_AREA(decodeURIComponent(m[1] ?? ''), decodeURIComponent(m[2] ?? '')),
	},
	{
		from: /^\/credentials\/([^/]+)\/?$/,
		to: (m) => ROUTES.PROGRAM_QUAL(decodeURIComponent(m[1] ?? '')),
	},
	{ from: /^\/credentials\/?$/, to: () => ROUTES.PROGRAM_QUALS },
	{
		from: /^\/goals\/([^/]+)\/?$/,
		to: (m) => ROUTES.PROGRAM_GOAL(decodeURIComponent(m[1] ?? '')),
	},
	{ from: /^\/goals\/?$/, to: () => ROUTES.PROGRAM_GOALS },
	{
		from: /^\/plans\/([^/]+)\/?$/,
		to: (m) => ROUTES.PROGRAM_PLAN(decodeURIComponent(m[1] ?? '')),
	},
	{ from: /^\/plans\/?$/, to: () => ROUTES.PROGRAM_PLANS },
];

/**
 * Resolve a legacy URL to its current canonical path. Returns `null` if
 * the pathname doesn't match any legacy rule. Pure function -- safe to
 * call from unit tests.
 */
export function resolveLegacyRedirect(pathname: string, search: string): string | null {
	for (const rule of RULES) {
		const match = rule.from.exec(pathname);
		if (match !== null) {
			const target = rule.to(match);
			return search.length > 0 ? `${target}${search}` : target;
		}
	}
	return null;
}

/** Number of installed legacy patterns. Used by the test harness for coverage assertions. */
export const LEGACY_REDIRECT_COUNT = RULES.length;
