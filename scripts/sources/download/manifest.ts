/**
 * Per-doc `manifest.json` reader/writer.
 *
 * The manifest sits next to the cached source file and records what we
 * downloaded, when, and what the upstream server told us about it. The
 * downloader's freshness check (see `freshness.ts`) compares HEAD response
 * metadata against this manifest to decide whether a re-fetch is needed.
 *
 * See ADR 018 + `docs/platform/STORAGE.md` for the full schema rationale.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Corpus } from './args';
import type { DownloadPlan } from './plans';

export interface Manifest {
	readonly corpus: Corpus;
	readonly doc: string;
	readonly edition: string;
	readonly source_url: string;
	readonly source_filename: string;
	readonly source_sha256: string;
	readonly size_bytes: number;
	readonly fetched_at: string;
	readonly last_modified?: string;
	readonly etag?: string;
	readonly schema_version: number;
}

export function manifestPathFor(plan: DownloadPlan): string {
	return join(dirname(plan.destPath), 'manifest.json');
}

export function readManifest(plan: DownloadPlan): Manifest | null {
	const path = manifestPathFor(plan);
	if (!existsSync(path)) return null;
	try {
		const raw = readFileSync(path, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<Manifest>;
		if (
			typeof parsed.source_sha256 === 'string' &&
			typeof parsed.source_url === 'string' &&
			typeof parsed.size_bytes === 'number'
		) {
			return parsed as Manifest;
		}
	} catch {
		return null;
	}
	return null;
}

export function writeManifest(plan: DownloadPlan, manifest: Manifest): void {
	const path = manifestPathFor(plan);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}
