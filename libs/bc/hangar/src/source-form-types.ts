/**
 * Plain TS shape for the `SourceForm` Svelte component's initial prop,
 * usable from +page.server.ts without pulling the svelte runtime.
 */
export interface SourceFormInitial {
	id: string;
	type: string;
	title: string;
	version: string;
	url: string;
	path: string;
	format: string;
	checksum: string;
	downloadedAt: string;
	sizeBytes: string;
	locatorShapeJson: string;
	/** wp-hangar-non-textual: binary-visual locator fields. */
	bvRegion?: string;
	bvCadenceDays?: string;
	bvIndexUrl?: string;
}

export const EMPTY_SOURCE_INITIAL: SourceFormInitial = {
	id: '',
	type: '',
	title: '',
	version: '',
	url: '',
	path: '',
	format: 'pdf',
	checksum: 'pending-download',
	downloadedAt: 'pending-download',
	sizeBytes: '',
	locatorShapeJson: '{}',
	bvRegion: '',
	bvCadenceDays: '',
	bvIndexUrl: '',
};
