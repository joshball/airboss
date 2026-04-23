/**
 * sim/glass instrument palette.
 *
 * Values ported verbatim from the wave 4 `--ab-sim-*` palette (commit
 * d8111b7). The migration is pixel-identical by design. Comments call
 * out the aviation convention behind each value so future edits know
 * what the number means.
 */

import type { SimTokens } from '../../contract';

export const sim: SimTokens = {
	panel: {
		bg: '#1a1a1a',
		bgDarker: '#0a0a0a',
		bgElevated: '#2a2a2a',
		border: '#333',
		fg: '#f5f5f5',
		fgDim: '#777',
		fgFaint: '#555',
		fgLight: '#aaa',
		fgLighter: '#ccc',
		fgLightest: '#ddd',
		fgMuted: '#bbb',
		fgNote: '#999',
		fgSubtle: '#888',
	},
	instrument: {
		bezel: '#333',
		bezelOuter: '#222',
		face: '#111',
		faceInner: '#1e1e1e',
		pointer: '#ffe270', // indicator yellow -- aviation convention
		pointerPivot: '#000',
		tick: '#f5f5f5',
		tickDim: '#777',
		tickFaint: '#444',
		tickMinor: '#bbb',
		tickSubtle: '#888',
	},
	horizon: {
		ground: '#7a4e25',
		sky: '#3b7bb5',
	},
	arc: {
		green: '#2fb856', // normal operating
		red: '#e0443e', // never exceed (Vne) / redline
		white: '#eaeaea', // flap operating range
		yellow: '#e9c53c', // caution
	},
	status: {
		danger: '#e0443e',
		dangerBg: '#4a1210',
		dangerBorder: '#852524',
		dangerFg: '#ffd1cf',
		dangerStrong: '#c23530',
		primary: '#2563eb',
		primaryFg: '#9bbfff',
		primaryHover: '#1d4ed8',
		success: '#2fb856',
		successBg: '#063b1c',
		successBorder: '#0c5a2c',
		successFg: '#9bffb0',
		warning: '#ffa62b',
		warningBg: '#5a4000',
		warningBorder: '#8b6a00',
	},
	banner: {
		infoBg: '#0c2a4a',
		infoBorder: '#1f4a7a',
		infoFg: '#eaf4ff',
		successBg: '#0c3a1a',
		successBorder: '#1f6a3a',
	},
	readout: {
		warningBg: 'rgba(224, 68, 62, 0.12)',
	},
	muted: {
		stateBg: 'rgba(224, 68, 62, 0.08)',
	},
};
