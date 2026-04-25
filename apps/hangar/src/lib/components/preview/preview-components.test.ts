/**
 * Source-inspection tests for the binary-visual preview components.
 *
 * The repo's vitest config runs in `environment: 'node'` without the Svelte
 * component plugin registered, so `.svelte` files cannot be imported into
 * tests. This pattern mirrors `apps/hangar/src/lib/components/theme-tokens.test.ts`
 * (and the sibling server theme-tokens test) -- the component source is read
 * and inspected to assert:
 *
 *   1. the props surface each component promises (see spec Phase 5)
 *   2. the DOM a fixture with those props would produce (markers in markup)
 *   3. zero hardcoded hex/rgb/hsl/named colours in any <style> block
 *   4. role tokens are used for colour / spacing / radius
 *
 * When the Svelte plugin is wired into vitest (separate infra work), these
 * can grow into real render assertions; until then the contract above is
 * what keeps these components honest.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\s*\(/;
const HSL = /\bhsla?\s*\(/;
const NAMED_COLOR =
	/\b(?:red|green|blue|white|black|gray|grey|yellow|orange|purple|pink|brown|cyan|magenta|lime|navy|teal|aqua|fuchsia|maroon|olive|silver)\b/i;

function read(relative: string): string {
	return readFileSync(resolve(HERE, relative), 'utf8');
}

function extractStyle(source: string): string {
	const match = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);
	return match?.[1] ?? '';
}

function extractTemplate(source: string): string {
	// Strip <script>...</script> and <style>...</style> blocks; what remains is
	// the template body the component renders.
	return source.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
}

describe('GeotiffPreview.svelte', () => {
	const source = read('./GeotiffPreview.svelte');
	const style = extractStyle(source);
	const template = extractTemplate(source);

	it('declares the spec-required props', () => {
		expect(source).toContain('sourceId');
		expect(source).toContain('fileName');
		expect(source).toContain('fileSizeBytes');
		expect(source).toContain('media');
		expect(source).toContain('edition');
	});

	it('renders a thumbnail image wired to the hangar thumbnail route', () => {
		expect(template).toContain('<img');
		expect(template).toContain('ROUTES.HANGAR_SOURCE_THUMBNAIL(sourceId)');
	});

	it('surfaces an unavailable fallback when media is absent or generator is unavailable', () => {
		expect(source).toContain('thumbnailAvailable');
		expect(source).toContain("generator !== 'unavailable'");
		expect(template).toContain('Thumbnail unavailable');
	});

	it('renders file size and edition stamp', () => {
		expect(template).toContain('formatBytes(fileSizeBytes)');
		expect(source).toContain('editionLabel');
		expect(source).toContain('effectiveDate');
		expect(source).toContain('editionNumber');
	});

	it('has zero hardcoded colour values in <style>', () => {
		expect(style.match(HEX)).toBeNull();
		expect(style.match(RGB)).toBeNull();
		expect(style.match(HSL)).toBeNull();
		expect(style.match(NAMED_COLOR)).toBeNull();
	});

	it('uses role tokens for colour / spacing / radius', () => {
		expect(style).toMatch(/var\(--surface-raised\)/);
		expect(style).toMatch(/var\(--edge-subtle\)/);
		expect(style).toMatch(/var\(--ink-body\)/);
		expect(style).toMatch(/var\(--space-/);
		expect(style).toMatch(/var\(--radius-/);
	});
});

describe('JpegPreview.svelte', () => {
	const source = read('./JpegPreview.svelte');
	const style = extractStyle(source);
	const template = extractTemplate(source);

	it('declares the spec-required props', () => {
		expect(source).toContain('sourceId');
		expect(source).toContain('fileName');
		expect(source).toContain('fileSizeBytes');
		expect(source).toContain('altText');
	});

	it('renders an inline <img> wired to the hangar thumbnail route', () => {
		expect(template).toContain('<img');
		expect(template).toContain('ROUTES.HANGAR_SOURCE_THUMBNAIL(sourceId)');
	});

	it('renders a caption with file name and size', () => {
		expect(template).toContain('{fileName}');
		expect(template).toContain('formatBytes(fileSizeBytes)');
	});

	it('has zero hardcoded colour values in <style>', () => {
		expect(style.match(HEX)).toBeNull();
		expect(style.match(RGB)).toBeNull();
		expect(style.match(HSL)).toBeNull();
		expect(style.match(NAMED_COLOR)).toBeNull();
	});

	it('uses role tokens for colour / spacing / radius', () => {
		expect(style).toMatch(/var\(--surface-raised\)/);
		expect(style).toMatch(/var\(--edge-subtle\)/);
		expect(style).toMatch(/var\(--ink-muted\)/);
		expect(style).toMatch(/var\(--space-/);
		expect(style).toMatch(/var\(--radius-/);
	});
});

describe('ZipPreview.svelte', () => {
	const source = read('./ZipPreview.svelte');
	const style = extractStyle(source);
	const template = extractTemplate(source);

	it('declares the spec-required props', () => {
		expect(source).toContain('fileName');
		expect(source).toContain('fileSizeBytes');
		expect(source).toContain('isArchive');
		expect(source).toContain('media');
	});

	it('lists archive entries from media.archiveEntries', () => {
		expect(source).toContain('archiveEntries');
		expect(template).toContain('{#each entries as entry');
		expect(template).toContain('{entry.name}');
		expect(template).toContain('formatBytes(entry.sizeBytes)');
	});

	it('renders file size and archive-entry count header', () => {
		expect(template).toContain('formatBytes(fileSizeBytes)');
		expect(template).toContain('{entries.length}');
	});

	it('renders an "archived edition" flag when isArchive is true', () => {
		expect(template).toContain('{#if isArchive}');
		expect(template).toContain('archived edition');
	});

	it('falls back to an empty-state message when no manifest is recorded', () => {
		expect(template).toContain('No archive manifest recorded');
	});

	it('has zero hardcoded colour values in <style>', () => {
		expect(style.match(HEX)).toBeNull();
		expect(style.match(RGB)).toBeNull();
		expect(style.match(HSL)).toBeNull();
		expect(style.match(NAMED_COLOR)).toBeNull();
	});

	it('uses role tokens for colour / spacing / radius', () => {
		expect(style).toMatch(/var\(--surface-raised\)/);
		expect(style).toMatch(/var\(--edge-subtle\)/);
		expect(style).toMatch(/var\(--ink-body\)/);
		expect(style).toMatch(/var\(--space-/);
		expect(style).toMatch(/var\(--radius-/);
	});
});

describe('PdfPreview.svelte', () => {
	const source = read('./PdfPreview.svelte');
	const style = extractStyle(source);
	const template = extractTemplate(source);

	it('declares the spec-required props', () => {
		expect(source).toContain('sourceId');
		expect(source).toContain('fileName');
		expect(source).toContain('fileSizeBytes');
	});

	it('embeds the file via <object> wired to the raw-file route', () => {
		expect(template).toContain('<object');
		expect(template).toContain('type="application/pdf"');
		expect(source).toContain('ROUTES.HANGAR_SOURCE_FILE_RAW(sourceId, fileName)');
	});

	it('renders an "open in new tab" fallback link', () => {
		expect(template).toContain('Open in new tab');
		expect(template).toContain('target="_blank"');
	});

	it('renders fallback content for browsers that decline to embed PDFs', () => {
		expect(template).toContain('declined to embed');
	});

	it('has zero hardcoded colour values in <style>', () => {
		expect(style.match(HEX)).toBeNull();
		expect(style.match(RGB)).toBeNull();
		expect(style.match(HSL)).toBeNull();
		expect(style.match(NAMED_COLOR)).toBeNull();
	});

	it('uses role tokens for colour / spacing / radius', () => {
		expect(style).toMatch(/var\(--surface-raised\)/);
		expect(style).toMatch(/var\(--edge-subtle\)/);
		expect(style).toMatch(/var\(--ink-body\)/);
		expect(style).toMatch(/var\(--space-/);
		expect(style).toMatch(/var\(--radius-/);
	});
});

describe('CsvPreview.svelte', () => {
	const source = read('./CsvPreview.svelte');
	const style = extractStyle(source);
	const template = extractTemplate(source);

	it('declares the spec-required props', () => {
		expect(source).toContain('fileName');
		expect(source).toContain('fileSizeBytes');
		expect(source).toContain('previewText');
		expect(source).toContain('maxRows');
	});

	it('parses the previewText with the local CSV parser', () => {
		expect(source).toContain("import { parseCsv } from './parse-csv'");
		expect(source).toContain('parseCsv(previewText, delimiter)');
	});

	it('selects tab vs comma delimiter from the file extension', () => {
		expect(source).toContain(".endsWith('.tsv')");
	});

	it('renders rows through the shared DataTable primitive', () => {
		expect(source).toContain("import DataTable, { type DataTableColumn } from '@ab/ui/components/DataTable.svelte'");
		expect(template).toContain('<DataTable');
	});

	it('caps the visible row count and surfaces the truncation', () => {
		expect(source).toContain('parsed.rows.slice(0, maxRows)');
		expect(template).toContain('truncated');
	});

	it('falls back to an empty-state when the CSV has no header', () => {
		expect(template).toContain('CSV is empty or could not be parsed');
	});

	it('has zero hardcoded colour values in <style>', () => {
		expect(style.match(HEX)).toBeNull();
		expect(style.match(RGB)).toBeNull();
		expect(style.match(HSL)).toBeNull();
		expect(style.match(NAMED_COLOR)).toBeNull();
	});

	it('uses role tokens for colour / spacing / radius', () => {
		expect(style).toMatch(/var\(--surface-raised\)/);
		expect(style).toMatch(/var\(--edge-subtle\)/);
		expect(style).toMatch(/var\(--ink-body\)/);
		expect(style).toMatch(/var\(--space-/);
		expect(style).toMatch(/var\(--radius-/);
	});
});

describe('MarkdownPreview.svelte', () => {
	const source = read('./MarkdownPreview.svelte');
	const style = extractStyle(source);
	const template = extractTemplate(source);

	it('declares the spec-required props', () => {
		expect(source).toContain('fileName');
		expect(source).toContain('fileSizeBytes');
		expect(source).toContain('nodes');
	});

	it('renders the AST through the shared MarkdownBody primitive', () => {
		expect(source).toContain("import MarkdownBody from '@ab/help/ui/MarkdownBody.svelte'");
		expect(template).toContain('<MarkdownBody {nodes}');
	});

	it('imports the MdNode type from @ab/help', () => {
		expect(source).toContain("import type { MdNode } from '@ab/help'");
	});

	it('renders a header strip with file name + size', () => {
		expect(template).toContain('{fileName}');
		expect(template).toContain('formatBytes(fileSizeBytes)');
	});

	it('has zero hardcoded colour values in <style>', () => {
		expect(style.match(HEX)).toBeNull();
		expect(style.match(RGB)).toBeNull();
		expect(style.match(HSL)).toBeNull();
		expect(style.match(NAMED_COLOR)).toBeNull();
	});

	it('uses role tokens for colour / spacing / radius', () => {
		expect(style).toMatch(/var\(--surface-raised\)/);
		expect(style).toMatch(/var\(--edge-subtle\)/);
		expect(style).toMatch(/var\(--ink-body\)/);
		expect(style).toMatch(/var\(--space-/);
		expect(style).toMatch(/var\(--radius-/);
	});
});

describe('files route dispatcher', () => {
	const dispatcher = readFileSync(
		resolve(HERE, '..', '..', '..', 'routes', '(app)', 'sources', '[id]', 'files', '+page.svelte'),
		'utf8',
	);

	it('imports all six dedicated preview components', () => {
		expect(dispatcher).toContain("import GeotiffPreview from '$lib/components/preview/GeotiffPreview.svelte'");
		expect(dispatcher).toContain("import JpegPreview from '$lib/components/preview/JpegPreview.svelte'");
		expect(dispatcher).toContain("import ZipPreview from '$lib/components/preview/ZipPreview.svelte'");
		expect(dispatcher).toContain("import PdfPreview from '$lib/components/preview/PdfPreview.svelte'");
		expect(dispatcher).toContain("import CsvPreview from '$lib/components/preview/CsvPreview.svelte'");
		expect(dispatcher).toContain("import MarkdownPreview from '$lib/components/preview/MarkdownPreview.svelte'");
	});

	it('dispatches on PREVIEW_KINDS for every preview kind', () => {
		expect(dispatcher).toContain('PREVIEW_KINDS.GEOTIFF');
		expect(dispatcher).toContain('PREVIEW_KINDS.JPEG');
		expect(dispatcher).toContain('PREVIEW_KINDS.ZIP');
		expect(dispatcher).toContain('PREVIEW_KINDS.PDF');
		expect(dispatcher).toContain('PREVIEW_KINDS.CSV');
		expect(dispatcher).toContain('PREVIEW_KINDS.MARKDOWN');
	});

	it('forwards source media + edition into the geotiff tile', () => {
		expect(dispatcher).toContain('media={data.source.media}');
		expect(dispatcher).toContain('edition={data.source.edition}');
	});

	it('forwards parsed markdown nodes to the MarkdownPreview', () => {
		expect(dispatcher).toContain('nodes={file.markdownNodes}');
	});
});
