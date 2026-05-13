import { requireAuth } from '@ab/auth';
import { ROUTES } from '@ab/constants';
import { dedupeFirstHeading, renderMarkdown } from '@ab/utils';
import { error } from '@sveltejs/kit';
import { getKnowledgeWeatherDirToIdMap, getWxProduct } from '../../_lib/wx-products.server';
import type { PageServerLoad } from './$types';

/**
 * Rewrite relative product and knowledge-node links in a product page body
 * to the canonical route URLs before the markdown is rendered. The raw body
 * uses repo-relative paths like:
 *
 *   [TAF](../taf/page.md)
 *   [Reading METARs and TAFs](../../../../knowledge/weather/reading-metars-tafs/node.md)
 *
 * which only make sense in the filesystem corpus. The reader sees URLs.
 *
 * Operates on the markdown text (not the rendered HTML) because
 * `renderMarkdown` already supports relative links via `[text](url)`; we just
 * need to swap the URL.
 */
function rewriteBodyLinks(body: string, knowledgeDirToId: ReadonlyMap<string, string>): string {
	// Sibling product link: ../<slug>/page.md
	const siblingRe = /\(\.\.\/([a-z0-9][a-z0-9-]*)\/page\.md\)/g;
	const knowledgeRe = /\((?:\.\.\/)+knowledge\/weather\/([a-z0-9][a-z0-9-]*)\/node\.md\)/g;
	let out = body.replace(siblingRe, (_m, slug: string) => `(${ROUTES.REFERENCE_WX_PRODUCT(slug)})`);
	out = out.replace(knowledgeRe, (match, dir: string) => {
		const id = knowledgeDirToId.get(dir);
		if (id === undefined) return match;
		return `(${ROUTES.REFERENCE_KNOWLEDGE_SLUG(id)})`;
	});
	return out;
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);

	const { params } = event;
	const slug = params.slug;
	const product = await getWxProduct(slug);
	if (product === null) {
		error(404, `Weather product not found: ${slug}`);
	}

	const knowledgeDirToId = await getKnowledgeWeatherDirToIdMap();
	const rewrittenBody = rewriteBodyLinks(product.body, knowledgeDirToId);
	// The page renders the title from frontmatter in its own header; the
	// body's leading `# Title` would duplicate it. `dedupeFirstHeading`
	// strips that one H1 when it matches the title and leaves every other
	// heading intact.
	const dedupedBody = dedupeFirstHeading(rewrittenBody, product.title);
	const bodyHtml = renderMarkdown(dedupedBody, { minHeadingLevel: 2 });

	// Resolve related knowledge nodes by id: every product's frontmatter
	// references the node by id (e.g. `wx-reading-metars-tafs`) which IS the
	// URL slug, so the route URL falls out directly. We do not load the
	// knowledge graph here -- the cited-by panel is the inverse and lives on
	// the knowledge node page itself.
	const relatedKnowledgeLinks = product.relatedKnowledgeNodes.map((kn) => ({
		slug: kn.slug,
		href: ROUTES.REFERENCE_KNOWLEDGE_SLUG(kn.slug),
	}));

	const relatedProductLinks = product.relatedProducts.map((rp) => ({
		slug: rp.slug,
		title: rp.title,
		shortCode: rp.shortCode,
		exists: rp.exists,
		href: ROUTES.REFERENCE_WX_PRODUCT(rp.slug),
	}));

	return {
		product: {
			slug: product.slug,
			id: product.id,
			title: product.title,
			shortCode: product.shortCode,
			category: product.category,
			tier: product.tier,
			status: product.status,
			elevatorPitch: product.elevatorPitch,
			authoritativeSources: product.authoritativeSources,
		},
		bodyHtml,
		relatedProductLinks,
		relatedKnowledgeLinks,
	};
};
