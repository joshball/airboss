import { describe, expect, it } from 'vitest';
import {
	CUSTOM_TILE,
	CUSTOM_TILE_ID,
	getPreset,
	isPresetId,
	PRESET_ID_VALUES,
	PRESET_IDS,
	PRESET_VALUES,
	PRESETS,
} from './presets';
import {
	CERT_VALUES,
	CERTS,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCE_VALUES,
	DOMAIN_VALUES,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	SESSION_MODE_VALUES,
} from './study';

describe('preset catalogue', () => {
	it('exposes exactly the five authored presets', () => {
		expect(PRESET_VALUES).toHaveLength(5);
		expect(PRESET_ID_VALUES).toHaveLength(5);
	});

	it('orders "Quick reps" first -- it is the zero-friction default', () => {
		expect(PRESET_VALUES[0]?.id).toBe(PRESET_IDS.REPS_ONLY);
	});

	it('keys match between PRESETS and PRESET_VALUES', () => {
		for (const preset of PRESET_VALUES) {
			expect(PRESETS[preset.id as keyof typeof PRESETS]).toBe(preset);
		}
	});

	it('every preset has a non-empty label and description', () => {
		for (const preset of PRESET_VALUES) {
			expect(preset.label.length).toBeGreaterThan(0);
			expect(preset.description.length).toBeGreaterThan(0);
		}
	});

	it('every preset field validates against its constants enum', () => {
		const certSet = new Set<string>(CERT_VALUES);
		const domainSet = new Set<string>(DOMAIN_VALUES);
		const depthSet = new Set<string>(DEPTH_PREFERENCE_VALUES);
		const modeSet = new Set<string>(SESSION_MODE_VALUES);

		for (const preset of PRESET_VALUES) {
			for (const cert of preset.certGoals) expect(certSet.has(cert)).toBe(true);
			for (const domain of preset.focusDomains) expect(domainSet.has(domain)).toBe(true);
			for (const domain of preset.skipDomains) expect(domainSet.has(domain)).toBe(true);
			expect(depthSet.has(preset.depthPreference)).toBe(true);
			expect(modeSet.has(preset.defaultMode)).toBe(true);
		}
	});

	it('focus and skip domains are disjoint in every preset', () => {
		for (const preset of PRESET_VALUES) {
			const focus = new Set(preset.focusDomains);
			for (const skip of preset.skipDomains) {
				expect(focus.has(skip)).toBe(false);
			}
		}
	});

	it('every sessionLength is within the study_plan CHECK bounds', () => {
		for (const preset of PRESET_VALUES) {
			expect(preset.sessionLength).toBeGreaterThanOrEqual(MIN_SESSION_LENGTH);
			expect(preset.sessionLength).toBeLessThanOrEqual(MAX_SESSION_LENGTH);
		}
	});

	it('Quick reps has no cert and no domain focus -- maps to a rep-only plan', () => {
		const quick = PRESETS[PRESET_IDS.REPS_ONLY];
		expect(quick.certGoals).toEqual([]);
		expect(quick.focusDomains).toEqual([]);
		expect(quick.sessionLength).toBe(DEFAULT_SESSION_LENGTH);
	});

	it('FIRC targets CFI', () => {
		expect(PRESETS[PRESET_IDS.FIRC].certGoals).toEqual([CERTS.CFI]);
	});
});

describe('isPresetId', () => {
	it('returns true for each authored preset id', () => {
		for (const id of PRESET_ID_VALUES) {
			expect(isPresetId(id)).toBe(true);
		}
	});

	it('returns false for the custom-tile sentinel', () => {
		expect(isPresetId(CUSTOM_TILE_ID)).toBe(false);
	});

	it('returns false for unrelated strings', () => {
		expect(isPresetId('')).toBe(false);
		expect(isPresetId('ppl')).toBe(false);
		expect(isPresetId('reps-onlyy')).toBe(false);
	});

	it('returns false for non-string input', () => {
		expect(isPresetId(123)).toBe(false);
		expect(isPresetId(null)).toBe(false);
		expect(isPresetId(undefined)).toBe(false);
	});
});

describe('getPreset', () => {
	it('returns the preset for a known id', () => {
		expect(getPreset(PRESET_IDS.REPS_ONLY)).toBe(PRESETS[PRESET_IDS.REPS_ONLY]);
	});

	it('returns null for an unknown id', () => {
		expect(getPreset('not-a-preset')).toBeNull();
		expect(getPreset(CUSTOM_TILE_ID)).toBeNull();
	});
});

describe('CUSTOM_TILE', () => {
	it('uses the CUSTOM_TILE_ID sentinel', () => {
		expect(CUSTOM_TILE.id).toBe(CUSTOM_TILE_ID);
	});

	it('has a label and description', () => {
		expect(CUSTOM_TILE.label.length).toBeGreaterThan(0);
		expect(CUSTOM_TILE.description.length).toBeGreaterThan(0);
	});
});
