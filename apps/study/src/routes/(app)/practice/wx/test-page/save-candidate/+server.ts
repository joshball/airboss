/**
 * POST `/practice/wx/test-page/save-candidate` -- writes a catalog-example
 * candidate sidecar for review (Drill Phase 4).
 *
 * The sandbox author drags sliders until a product looks the way they
 * want, then "saves it as a catalog example." This endpoint writes the
 * `CatalogExampleCandidate` JSON to
 * `course/knowledge/weather/encoded-text-catalog/examples-pending/<slug>.json`.
 * Files in that directory are review candidates: a human promotes them
 * into a catalog markdown example (raw / product / synoptic / tokenFamilies
 * / references) before they appear on the examples page.
 *
 * Admin-only -- it writes into the course corpus, so it carries the same
 * ADMIN guard as the page and the derive endpoint. The slug is validated
 * to lowercase kebab-case and the resolved path is re-checked against the
 * examples-pending root so a crafted slug cannot escape the directory.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireRole } from '@ab/auth';
import { ROLES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, json } from '@sveltejs/kit';
import { saveCandidateRequestSchema } from '../_lib/schema';
import type { CatalogExampleCandidate } from '../_lib/types';
import type { RequestHandler } from './$types';

const log = createLogger('study:wx-test-page-save-candidate');

// apps/study/src/routes/(app)/practice/wx/test-page/save-candidate -> repo
// root is ten levels up.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..', '..', '..', '..', '..');
const PENDING_DIR = resolve(REPO_ROOT, 'course', 'knowledge', 'weather', 'encoded-text-catalog', 'examples-pending');

export const POST: RequestHandler = async (event) => {
	const user = requireRole(event, ROLES.ADMIN);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Request body must be JSON');
	}

	const parsed = saveCandidateRequestSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, `Invalid candidate: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
	}
	const req = parsed.data;

	// Defence in depth: the slug is already kebab-case validated, but
	// re-check the resolved path still lives under the pending directory.
	const filePath = resolve(PENDING_DIR, `${req.slug}.json`);
	if (!filePath.startsWith(`${PENDING_DIR}/`)) {
		throw error(400, 'Invalid candidate slug');
	}

	const candidate: CatalogExampleCandidate = {
		slug: req.slug,
		product: req.product,
		raw: req.raw,
		synoptic: req.synoptic,
		tokenFamilies: req.tokenFamilies,
		references: req.references,
		sliderState: req.sliderState,
		authoredAt: new Date().toISOString(),
		authoredBy: user.email,
	};

	try {
		await mkdir(PENDING_DIR, { recursive: true });
		await writeFile(filePath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf-8');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('failed to write catalog-example candidate', {
			requestId: event.locals.requestId,
			userId: user.id,
			metadata: { slug: req.slug, message },
		});
		throw error(500, `Failed to save candidate: ${message}`);
	}

	log.info('catalog-example candidate saved', {
		requestId: event.locals.requestId,
		userId: user.id,
		metadata: { slug: req.slug, product: req.product },
	});

	return json({ slug: req.slug, savedAt: candidate.authoredAt });
};
