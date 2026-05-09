/**
 * Chart chrome: title band at the top, optional footer band at the bottom.
 *
 * Title band carries the chart title (uppercase, bold) and a subtitle
 * (date / time / source descriptor). Footer band carries source
 * attribution and the library version stamped from `meta.json`.
 *
 * Browser-safe: pure SVG-string composition, no Node imports.
 */

import { SVG_HEIGHT, SVG_WIDTH, TITLE_BAND_HEIGHT } from './projection';

export interface ChromeInput {
	title: string;
	subtitle?: string;
	/** Right-aligned label in the title band (e.g., "CONUS - Lambert Conformal 33/45"). */
	rightTitle?: string;
	/** Right-aligned subtitle (often a "not for ops use" disclaimer). */
	rightSubtitle?: string;
	/** Footer attribution -- typically the source of the underlying data. */
	sourceAttribution?: string;
	/** Stamped on the right of the footer band. */
	libraryVersion?: string;
	/** Override the default canvas width when the chart is non-default size. */
	width?: number;
	/** Override the default canvas height. */
	height?: number;
	/** Override the default title-band height. */
	titleBandHeight?: number;
	/** Footer band height; 0 disables the footer. Default: 24 px when any footer
	 * field is set, 0 otherwise. */
	footerBandHeight?: number;
}

export interface ChromeOutput {
	titleBand: string;
	footerBand: string;
}

const TITLE_BG = '#fafaf7';
const TITLE_RULE = '#d8d4c8';
const TITLE_FG = '#3d3a32';
const TITLE_FG_MUTED = '#7a7568';
const TITLE_FG_SOFT = '#a09b8d';

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			case "'":
				return '&apos;';
			default:
				return c;
		}
	});
}

/**
 * Build the title and footer band SVG fragments for a chart. Returns
 * the inner SVG strings (no wrapping `<g>`); the caller mounts them
 * inside the `chrome` layer band.
 */
export function buildChrome(input: ChromeInput): ChromeOutput {
	const width = input.width ?? SVG_WIDTH;
	const height = input.height ?? SVG_HEIGHT;
	const titleBandHeight = input.titleBandHeight ?? TITLE_BAND_HEIGHT;
	const hasFooter = input.sourceAttribution !== undefined || input.libraryVersion !== undefined;
	const footerBandHeight = input.footerBandHeight ?? (hasFooter ? 24 : 0);

	const titleBand = renderTitleBand(input, width, titleBandHeight);
	const footerBand = footerBandHeight > 0 ? renderFooterBand(input, width, height, footerBandHeight) : '';

	return { titleBand, footerBand };
}

function renderTitleBand(input: ChromeInput, width: number, bandHeight: number): string {
	const title = escapeXml(input.title.toUpperCase());
	const subtitle = input.subtitle !== undefined ? escapeXml(input.subtitle) : '';
	const rightTitle = input.rightTitle !== undefined ? escapeXml(input.rightTitle) : '';
	const rightSubtitle = input.rightSubtitle !== undefined ? escapeXml(input.rightSubtitle) : '';

	const subtitleLine =
		subtitle.length > 0
			? `<text x="24" y="${bandHeight - 14}" font-size="12" fill="${TITLE_FG_MUTED}">${subtitle}</text>`
			: '';
	const rightTitleLine =
		rightTitle.length > 0
			? `<text x="${width - 24}" y="26" text-anchor="end" font-size="11" font-weight="600" fill="${TITLE_FG_MUTED}">${rightTitle}</text>`
			: '';
	const rightSubtitleLine =
		rightSubtitle.length > 0
			? `<text x="${width - 24}" y="${bandHeight - 14}" text-anchor="end" font-size="11" fill="${TITLE_FG_SOFT}">${rightSubtitle}</text>`
			: '';

	return `<g class="chrome-title">
  <rect x="0" y="0" width="${width}" height="${bandHeight}" fill="${TITLE_BG}" />
  <line x1="0" y1="${bandHeight}" x2="${width}" y2="${bandHeight}" stroke="${TITLE_RULE}" stroke-width="0.6" />
  <text x="24" y="26" font-size="16" font-weight="700" fill="${TITLE_FG}" letter-spacing="1.2">${title}</text>
  ${subtitleLine}
  ${rightTitleLine}
  ${rightSubtitleLine}
</g>`;
}

function renderFooterBand(input: ChromeInput, width: number, height: number, bandHeight: number): string {
	const top = height - bandHeight;
	const sourceAttr = input.sourceAttribution !== undefined ? escapeXml(input.sourceAttribution) : '';
	const libraryVersion = input.libraryVersion !== undefined ? escapeXml(input.libraryVersion) : '';

	return `<g class="chrome-footer">
  <rect x="0" y="${top}" width="${width}" height="${bandHeight}" fill="${TITLE_BG}" />
  <line x1="0" y1="${top}" x2="${width}" y2="${top}" stroke="${TITLE_RULE}" stroke-width="0.6" />
  <text x="24" y="${top + 16}" font-size="10" fill="${TITLE_FG_MUTED}">${sourceAttr}</text>
  <text x="${width - 24}" y="${top + 16}" text-anchor="end" font-size="10" fill="${TITLE_FG_SOFT}">${libraryVersion}</text>
</g>`;
}
