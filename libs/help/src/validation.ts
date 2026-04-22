/**
 * Build-time validation for help pages.
 *
 * Two layers mirror the aviation library:
 *
 *   1) `validateHelpPages(pages, opts)` -- audits the help-page data
 *      itself: required tag axes, unique ids (page + section), `documents`
 *      path shape, `related[]` resolution against the combined registries,
 *      wiki-link resolution in section bodies, reviewedAt staleness.
 *
 *   2) Orphan detection and cross-registry wiki-link scanning live at the
 *      script level (`scripts/references/validate.ts`) which already walks
 *      help content via `scanContent()` in `scripts/references/scan.ts`.
 *
 * `validateHelpPages` returns `{ errors, warnings }` that the caller
 * aggregates. Errors fail the build; warnings print but don't fail.
 */

import { extractWikilinks, type WikilinkParseError } from '@ab/aviation';
import {
	APP_SURFACE_MAX,
	APP_SURFACE_MIN,
	APP_SURFACE_VALUES,
	AVIATION_TOPIC_VALUES,
	HELP_KIND_VALUES,
	REFERENCE_BANNED_KEYWORDS,
	REFERENCE_KEYWORD_MAX_COUNT,
	REFERENCE_KEYWORD_MAX_LENGTH,
} from '@ab/constants';
import type { HelpPage } from './schema/help-page';
import type { HelpSection } from './schema/help-section';

export interface HelpValidationIssue {
	message: string;
	pageId?: string;
	sectionId?: string;
	location?: string;
}

export interface HelpValidationResult {
	errors: readonly HelpValidationIssue[];
	warnings: readonly HelpValidationIssue[];
}

export interface HelpValidationOptions {
	/** Resolver for aviation reference ids (drives wiki-link + related checks). */
	hasAviationReference(id: string): boolean;
}

const STALE_REVIEW_MS = 365 * 24 * 60 * 60 * 1000;

export function validateHelpPages(pages: readonly HelpPage[], opts: HelpValidationOptions): HelpValidationResult {
	const errors: HelpValidationIssue[] = [];
	const warnings: HelpValidationIssue[] = [];

	// Build the help-id set first so intra-help `related[]` and wiki-links
	// can resolve before any per-page validation emits.
	const helpIds = new Set<string>();
	const dupeIds = new Set<string>();
	for (const page of pages) {
		if (helpIds.has(page.id)) dupeIds.add(page.id);
		helpIds.add(page.id);
	}
	for (const dupe of dupeIds) {
		errors.push({ message: `Duplicate help-page id '${dupe}'.`, pageId: dupe });
	}

	const now = Date.now();
	for (const page of pages) {
		validateOnePage(page, errors, warnings);
		validatePageRelated(page, helpIds, opts, errors);
		for (const section of page.sections) {
			validateSectionWikilinks(page, section, helpIds, opts, errors);
		}
		if (page.reviewedAt) {
			const reviewed = Date.parse(page.reviewedAt);
			if (Number.isNaN(reviewed)) {
				errors.push({
					message: `Help page '${page.id}' has unparseable reviewedAt '${page.reviewedAt}'.`,
					pageId: page.id,
				});
			} else if (now - reviewed > STALE_REVIEW_MS) {
				warnings.push({
					message: `Help page '${page.id}' was last reviewed ${page.reviewedAt} (> 12 months).`,
					pageId: page.id,
				});
			}
		}
	}

	// Orphan check: pages registered but unreferenced by any other page's
	// `related[]`. Emitted as a warning (new pages are legitimately orphan
	// on creation).
	const linkedIds = new Set<string>();
	for (const page of pages) {
		for (const rel of page.related ?? []) linkedIds.add(rel);
		for (const section of page.sections) {
			for (const rel of section.related ?? []) linkedIds.add(rel);
		}
	}
	const orphans: string[] = [];
	for (const page of pages) {
		if (!linkedIds.has(page.id)) orphans.push(page.id);
	}
	if (orphans.length > 0) {
		warnings.push({
			message: `${orphans.length} orphan help page(s) (no other page links to them). First: '${orphans[0]}'.`,
		});
	}

	return { errors, warnings };
}

function validateOnePage(page: HelpPage, errors: HelpValidationIssue[], warnings: HelpValidationIssue[]): void {
	const { id, tags } = page;

	if (!id || id.trim() === '') {
		errors.push({ message: 'Help page missing id.', pageId: id });
	}
	if (!page.title || page.title.trim() === '') {
		errors.push({ message: `Help page '${id}' missing title.`, pageId: id });
	}
	if (!page.summary || page.summary.trim() === '') {
		errors.push({ message: `Help page '${id}' missing summary.`, pageId: id });
	}
	if (!Array.isArray(page.sections) || page.sections.length === 0) {
		errors.push({ message: `Help page '${id}' has no sections.`, pageId: id });
	}

	// `documents` path-shape gate.
	if (page.documents !== undefined) {
		if (typeof page.documents !== 'string' || !page.documents.startsWith('/')) {
			errors.push({
				message: `Help page '${id}' has invalid documents path '${page.documents}' (must start with '/').`,
				pageId: id,
			});
		}
	}

	// appSurface: 1-3 entries, enum, no dupes.
	if (!Array.isArray(tags.appSurface) || tags.appSurface.length === 0) {
		errors.push({
			message: `Help page '${id}' is missing appSurface (required, ${APP_SURFACE_MIN}-${APP_SURFACE_MAX} values).`,
			pageId: id,
		});
	} else {
		if (tags.appSurface.length < APP_SURFACE_MIN || tags.appSurface.length > APP_SURFACE_MAX) {
			errors.push({
				message: `Help page '${id}' has ${tags.appSurface.length} appSurface entries (${APP_SURFACE_MIN}-${APP_SURFACE_MAX} required).`,
				pageId: id,
			});
		}
		const seen = new Set<string>();
		for (const surface of tags.appSurface) {
			if (!(APP_SURFACE_VALUES as readonly string[]).includes(surface)) {
				errors.push({
					message: `Help page '${id}' has invalid appSurface '${surface}'.`,
					pageId: id,
				});
			}
			if (seen.has(surface)) {
				errors.push({
					message: `Help page '${id}' lists duplicate appSurface '${surface}'.`,
					pageId: id,
				});
			}
			seen.add(surface);
		}
	}

	// helpKind: required, enum.
	if (!(HELP_KIND_VALUES as readonly string[]).includes(tags.helpKind)) {
		errors.push({
			message: `Help page '${id}' has invalid helpKind '${tags.helpKind}'.`,
			pageId: id,
		});
	}

	// aviationTopic: optional, enum, no dupes.
	if (tags.aviationTopic) {
		const seen = new Set<string>();
		for (const topic of tags.aviationTopic) {
			if (!(AVIATION_TOPIC_VALUES as readonly string[]).includes(topic)) {
				errors.push({
					message: `Help page '${id}' has invalid aviationTopic '${topic}'.`,
					pageId: id,
				});
			}
			if (seen.has(topic)) {
				errors.push({
					message: `Help page '${id}' lists duplicate aviationTopic '${topic}'.`,
					pageId: id,
				});
			}
			seen.add(topic);
		}
	}

	// keywords: optional, <= max count + length, no banned zombies.
	if (tags.keywords) {
		if (tags.keywords.length > REFERENCE_KEYWORD_MAX_COUNT) {
			errors.push({
				message: `Help page '${id}' has ${tags.keywords.length} keywords (max ${REFERENCE_KEYWORD_MAX_COUNT}).`,
				pageId: id,
			});
		}
		for (const keyword of tags.keywords) {
			if (!keyword || keyword.length === 0) {
				errors.push({
					message: `Help page '${id}' has an empty keyword.`,
					pageId: id,
				});
				continue;
			}
			if (keyword.length > REFERENCE_KEYWORD_MAX_LENGTH) {
				errors.push({
					message: `Help page '${id}' keyword '${keyword}' exceeds ${REFERENCE_KEYWORD_MAX_LENGTH} chars.`,
					pageId: id,
				});
			}
			if ((REFERENCE_BANNED_KEYWORDS as readonly string[]).includes(keyword)) {
				errors.push({
					message: `Help page '${id}' uses banned zombie keyword '${keyword}'.`,
					pageId: id,
				});
			}
		}
	}

	// Section-id uniqueness within the page.
	if (Array.isArray(page.sections)) {
		const seenSections = new Set<string>();
		for (const section of page.sections) {
			if (!section.id || section.id.trim() === '') {
				errors.push({
					message: `Help page '${id}' has a section with empty id.`,
					pageId: id,
				});
				continue;
			}
			if (seenSections.has(section.id)) {
				errors.push({
					message: `Help page '${id}' has duplicate section id '${section.id}'.`,
					pageId: id,
					sectionId: section.id,
				});
			}
			seenSections.add(section.id);
			if (!section.title || section.title.trim() === '') {
				errors.push({
					message: `Help page '${id}' section '${section.id}' missing title.`,
					pageId: id,
					sectionId: section.id,
				});
			}
			if (!section.body || section.body.trim() === '') {
				warnings.push({
					message: `Help page '${id}' section '${section.id}' has empty body.`,
					pageId: id,
					sectionId: section.id,
				});
			}
		}
	}
}

function validatePageRelated(
	page: HelpPage,
	helpIds: ReadonlySet<string>,
	opts: HelpValidationOptions,
	errors: HelpValidationIssue[],
): void {
	for (const related of page.related ?? []) {
		if (helpIds.has(related)) continue;
		if (opts.hasAviationReference(related)) continue;
		errors.push({
			message: `Help page '${page.id}' related id '${related}' does not resolve to a help page or aviation reference.`,
			pageId: page.id,
		});
	}
	for (const section of page.sections) {
		for (const related of section.related ?? []) {
			if (helpIds.has(related)) continue;
			if (opts.hasAviationReference(related)) continue;
			errors.push({
				message: `Help page '${page.id}' section '${section.id}' related id '${related}' does not resolve.`,
				pageId: page.id,
				sectionId: section.id,
			});
		}
	}
}

function validateSectionWikilinks(
	page: HelpPage,
	section: HelpSection,
	helpIds: ReadonlySet<string>,
	opts: HelpValidationOptions,
	errors: HelpValidationIssue[],
): void {
	const { wikilinks, errors: parseErrors } = extractWikilinks(section.body);
	for (const err of parseErrors) {
		errors.push({
			message: describeParseError(err, section.body),
			pageId: page.id,
			sectionId: section.id,
		});
	}
	for (const link of wikilinks) {
		if (link.id === null) continue; // TBD-id: warning-only, handled by the scanner.
		if (helpIds.has(link.id)) continue;
		if (opts.hasAviationReference(link.id)) continue;
		errors.push({
			message: `Help page '${page.id}' section '${section.id}' wiki-links to unknown id '${link.id}'.`,
			pageId: page.id,
			sectionId: section.id,
		});
	}
}

function describeParseError(error: WikilinkParseError, source: string): string {
	const [start] = error.sourceSpan;
	const before = source.slice(0, start);
	const line = before.split('\n').length;
	return `${error.message} (line ${line})`;
}
