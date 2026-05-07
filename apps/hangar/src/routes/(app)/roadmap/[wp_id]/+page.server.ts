/**
 * `/roadmap/[wp_id]` -- WP detail page. Renders the spec.md frontmatter
 * sidebar plus the available sub-doc bodies (spec, tasks, test-plan,
 * design, user-stories) as tab panels. Sub-docs that don't exist on disk
 * silently drop from the tab bar.
 *
 * Read-only: no form actions. The "How to mutate" footer surfaces the
 * `bun run wp set` invocation for this WP. Phase 2 of the parent WP will
 * add UI writebacks; Phase 8 explicitly does not.
 *
 * Cross-links:
 *
 *   - `depends_on` / `unblocks` resolve to internal `/roadmap/<id>` URLs.
 *     Each link is rendered with its target's status so it's obvious whether
 *     the dependency is shipped, in flight, or unparseable.
 *   - `shipped_prs` resolve to GitHub URLs through the `AIRBOSS_REPO_SLUG`
 *     constant.
 *   - Bug back-references (Phase 6 of the parent WP) are TODO; the bugs
 *     surface ships separately.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { requireRole } from '@ab/auth';
import { AIRBOSS_REPO_SLUG, ROADMAP_QUERY_PARAMS, ROLES, WP_SUB_DOCS, type WpSubDocKey } from '@ab/constants';
import type { WorkPackageFrontmatter, WorkPackageValidationError } from '@ab/types';
import { renderMarkdown } from '@ab/utils';
import { loadAllWorkPackages } from '@ab/wp-loader';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface SubDocPanel {
	key: WpSubDocKey;
	label: string;
	bodyHtml: string;
}

export interface DependencyLink {
	id: string;
	status: string | null;
	exists: boolean;
}

export interface ShippedPrLink {
	number: number;
	url: string;
}

export const load: PageServerLoad = (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const wpId = event.params.wp_id;
	if (!wpId || !/^[a-z0-9][a-z0-9-]*$/.test(wpId)) {
		throw error(404, 'Work package not found');
	}
	const all = loadAllWorkPackages();
	const wp = all.find((p) => p.id === wpId);
	if (wp === undefined) {
		throw error(404, `Work package "${wpId}" not found`);
	}
	const fm = wp.frontmatter;
	const wpDir = dirname(wp.specPath);
	const panels: SubDocPanel[] = [];
	for (const subDoc of WP_SUB_DOCS) {
		const path = join(wpDir, subDoc.filename);
		if (!existsSync(path)) continue;
		let raw: string;
		try {
			raw = readFileSync(path, 'utf8');
		} catch {
			continue;
		}
		// Strip the frontmatter fence (only spec.md carries one, but be
		// defensive in case future sub-docs grow their own).
		const body = stripFrontmatter(raw);
		panels.push({
			key: subDoc.key,
			label: subDoc.label,
			bodyHtml: renderMarkdown(body, { minHeadingLevel: 2, headingIds: true }),
		});
	}
	const tabParam = event.url.searchParams.get(ROADMAP_QUERY_PARAMS.TAB);
	const validTabs = new Set<string>(panels.map((p) => p.key));
	const activeTab: WpSubDocKey =
		tabParam !== null && validTabs.has(tabParam) ? (tabParam as WpSubDocKey) : (panels[0]?.key ?? 'spec');

	const dependsOn: DependencyLink[] = (fm?.depends_on ?? []).map((depId) => resolveDependencyLink(depId, all));
	const unblocks: DependencyLink[] = (fm?.unblocks ?? []).map((depId) => resolveDependencyLink(depId, all));
	const shippedPrs: ShippedPrLink[] = (fm?.shipped_prs ?? []).map((number) => ({
		number,
		url: `https://github.com/${AIRBOSS_REPO_SLUG}/pull/${number}`,
	}));

	return {
		id: wp.id,
		frontmatter: fm,
		validationErrors: wp.validation_errors satisfies readonly WorkPackageValidationError[],
		panels,
		activeTab,
		dependsOn,
		unblocks,
		shippedPrs,
		// Surfaced verbatim in the "How to mutate" footer so the user can
		// copy / paste a real command and never has to guess the spelling.
		mutateCommand: `bun run wp set ${wp.id} <field> <value>`,
		// TODO(bugs): Once `docs/bugs/` ships (Phase 6 of
		// tracking-system-overhaul) and bug frontmatter carries `fix_wp`,
		// reverse-look-up bug rows here so the sidebar can list "Bugs that
		// reference this WP". Out of scope for Phase 8.
		relatedBugs: [] as readonly { id: string; title: string }[],
	};
};

function stripFrontmatter(raw: string): string {
	const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	return match === null ? raw : raw.slice(match[0].length);
}

function resolveDependencyLink(
	depId: string,
	all: ReadonlyArray<{ id: string; frontmatter: WorkPackageFrontmatter | null }>,
): DependencyLink {
	const target = all.find((p) => p.id === depId);
	if (target === undefined) {
		return { id: depId, status: null, exists: false };
	}
	return {
		id: target.id,
		status: target.frontmatter?.status ?? null,
		exists: true,
	};
}
