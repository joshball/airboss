/**
 * CFR per-Part authoring overlay loader tests.
 *
 * Round-trips a small YAML payload through `loadCfrPartAuthoring` to lock the
 * Zod schema:
 *
 *   - description / whyItMatters / scope flow through unchanged.
 *   - topics is optional but enum-validated against AVIATION_TOPIC_VALUES;
 *     an unknown topic value (typo, retired tag) bails the load with a
 *     ZodError so the seed run fails loudly rather than silently dropping
 *     the chip.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCfrPartAuthoring } from './cfr-authoring';

function withTempYaml<T>(yamlBody: string, fn: (path: string) => Promise<T>): Promise<T> {
	const dir = mkdtempSync(join(tmpdir(), 'cfr-authoring-test-'));
	const path = join(dir, 'parts.yaml');
	writeFileSync(path, yamlBody, 'utf-8');
	return fn(path).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('loadCfrPartAuthoring', () => {
	it('returns an empty map when the file is missing', async () => {
		const result = await loadCfrPartAuthoring('/tmp/does-not-exist-cfr-authoring.yaml');
		expect(result).toEqual({});
	});

	it('parses description / whyItMatters / scope / topics for a Part', async () => {
		const yaml = [
			'parts:',
			'  "91":',
			'    description: "test desc"',
			'    whyItMatters: "test why"',
			'    scope: "Operations"',
			'    topics: ["weather", "airspace", "communications"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			const result = await loadCfrPartAuthoring(path);
			expect(result['91']).toBeDefined();
			expect(result['91']?.description).toBe('test desc');
			expect(result['91']?.whyItMatters).toBe('test why');
			expect(result['91']?.scope).toBe('Operations');
			expect(result['91']?.topics).toEqual(['weather', 'airspace', 'communications']);
		});
	});

	it('topics is optional -- a Part without topics still loads', async () => {
		const yaml = ['parts:', '  "91":', '    description: "test desc"'].join('\n');
		await withTempYaml(yaml, async (path) => {
			const result = await loadCfrPartAuthoring(path);
			expect(result['91']).toBeDefined();
			expect(result['91']?.topics).toBeUndefined();
		});
	});

	it('rejects an unknown topic value with a ZodError', async () => {
		const yaml = [
			'parts:',
			'  "91":',
			'    description: "test desc"',
			'    topics: ["weather", "not-a-real-topic"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			await expect(loadCfrPartAuthoring(path)).rejects.toThrow();
		});
	});

	it('rejects an empty topics array (min: 1)', async () => {
		const yaml = ['parts:', '  "91":', '    description: "test desc"', '    topics: []'].join('\n');
		await withTempYaml(yaml, async (path) => {
			await expect(loadCfrPartAuthoring(path)).rejects.toThrow();
		});
	});

	it('rejects a topics array longer than AVIATION_TOPIC_MAX (5)', async () => {
		const yaml = [
			'parts:',
			'  "91":',
			'    description: "test desc"',
			'    topics: ["weather", "airspace", "communications", "navigation", "procedures", "operations"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			await expect(loadCfrPartAuthoring(path)).rejects.toThrow();
		});
	});
});
