/**
 * /sources index -- interactive flow diagram.
 *
 * Loads one snapshot per request: the source registry from `hangar.source`,
 * a manifest summary if `data/references/manifest.json` exists, the latest
 * validation + diff job for each source, and live reference / verbatim
 * counts from `hangar.reference` (replaces an earlier per-request regex
 * sweep over `libs/aviation/src/references/aviation.ts`).
 *
 * Form actions enqueue `hangar.job` rows for the flow-level operations
 * (rescan / revalidate / build / size-report). Per-source actions live on
 * `/sources/[id]`.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	countLiveReferences,
	countVerbatimReferences,
	getLatestCompleteJobByKind,
	listLiveSources,
	listRunningJobs,
	PENDING_DOWNLOAD,
	REPO_ROOT,
} from '@ab/bc-hangar';
import { JOB_KINDS, ROLES, ROUTES } from '@ab/constants';
import { enqueueJob } from '@ab/hangar-jobs';
import { createLogger } from '@ab/utils';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:sources-flow');

export interface ManifestSummary {
	citedIds: number;
	scannedAt: string | null;
	tbdCount: number;
}

async function loadManifestSummary(): Promise<ManifestSummary | null> {
	const path = resolve(REPO_ROOT, 'data', 'references', 'manifest.json');
	try {
		const raw = await readFile(path, 'utf8');
		const parsed = JSON.parse(raw) as {
			scannedAt?: string;
			entries?: readonly { id?: string }[];
			unresolvedText?: readonly unknown[];
		};
		const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
		const unresolved = Array.isArray(parsed.unresolvedText) ? parsed.unresolvedText : [];
		return {
			citedIds: entries.length,
			scannedAt: typeof parsed.scannedAt === 'string' ? parsed.scannedAt : null,
			tbdCount: unresolved.length,
		};
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);

	// Run the independent reads concurrently. The previous shape ran 4
	// awaits + 2 file reads + 2 regex sweeps serially; everything outside
	// the source-row map is independent and can fan out.
	const [rows, activeJobs, latestValidate, latestScan, manifest, referenceCount, verbatimCount] = await Promise.all([
		listLiveSources(),
		listRunningJobs(),
		getLatestCompleteJobByKind(JOB_KINDS.VALIDATE_REFERENCES),
		getLatestCompleteJobByKind(JOB_KINDS.FETCH_SOURCE),
		loadManifestSummary(),
		countLiveReferences(),
		countVerbatimReferences(),
	]);

	const activeByTarget = new Map<string, { id: string; kind: string }>();
	for (const job of activeJobs) {
		if (job.targetId && !activeByTarget.has(job.targetId)) {
			activeByTarget.set(job.targetId, { id: job.id, kind: job.kind });
		}
	}

	const sources = rows.map((row) => {
		const active = activeByTarget.get(row.id) ?? null;
		const downloadedChecksum = row.checksum && row.checksum !== PENDING_DOWNLOAD;
		const state: 'pending' | 'downloaded' | 'extracted' = !downloadedChecksum
			? 'pending'
			: // Heuristic: there's no per-source extracted flag yet; treat "has size + not pending" as downloaded, and leave `extracted` for future when we record it on the row.
				'downloaded';
		return {
			id: row.id,
			rev: row.rev,
			type: row.type,
			title: row.title,
			version: row.version,
			url: row.url,
			path: row.path,
			format: row.format,
			checksum: row.checksum,
			sizeBytes: row.sizeBytes,
			downloadedAt: row.downloadedAt,
			dirty: row.dirty,
			state,
			activeJob: active,
			updatedAt: row.updatedAt.toISOString(),
		};
	});

	const downloadedCount = sources.filter((s) => s.state !== 'pending').length;
	const oldestDownloadedAt =
		sources
			.filter((s) => s.state !== 'pending' && s.downloadedAt !== PENDING_DOWNLOAD)
			.map((s) => s.downloadedAt)
			.sort()[0] ?? null;

	return {
		sources,
		flowState: {
			content: {
				wikiLinkCount: manifest?.citedIds ?? 0,
				tbdCount: manifest?.tbdCount ?? 0,
				helpPageCount: 0, // wired in a later pass; manifest doesn't split content types today
			},
			manifest: {
				citedCount: manifest?.citedIds ?? 0,
				scannedAt: manifest?.scannedAt ?? null,
				scanJobId: latestScan?.id ?? null,
			},
			validation: {
				errors: 0,
				warnings: 0,
				runAt: latestValidate?.finishedAt?.toISOString() ?? null,
				validateJobId: latestValidate?.id ?? null,
			},
			glossary: {
				referenceCount,
				sourceCount: sources.length,
			},
		},
		statusTiles: {
			registeredSources: sources.length,
			downloaded: downloadedCount,
			verbatimMaterialised: verbatimCount,
			tbdCount: manifest?.tbdCount ?? 0,
			oldestDownloadedAt,
		},
	};
};

async function enqueueGlobalAction(
	event: Parameters<NonNullable<Actions['rescan']>>[0],
	kind: (typeof JOB_KINDS)[keyof typeof JOB_KINDS],
): Promise<Response | ReturnType<typeof fail>> {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	try {
		const job = await enqueueJob({
			kind,
			targetType: 'registry',
			targetId: 'registry',
			actorId: user.id,
			payload: {},
		});
		redirect(303, ROUTES.HANGAR_JOB_DETAIL(job.id));
	} catch (err) {
		if (isRedirect(err)) throw err;
		log.error(
			`enqueue ${kind} failed`,
			{ requestId: event.locals.requestId, userId: user.id },
			err instanceof Error ? err : undefined,
		);
		return fail(500, { error: err instanceof Error ? err.message : 'failed to enqueue job' });
	}
}

export const actions: Actions = {
	rescan: (event) => enqueueGlobalAction(event, JOB_KINDS.FETCH_SOURCE),
	revalidate: (event) => enqueueGlobalAction(event, JOB_KINDS.VALIDATE_REFERENCES),
	build: (event) => enqueueGlobalAction(event, JOB_KINDS.BUILD_REFERENCES),
};
