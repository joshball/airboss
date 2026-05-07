/**
 * POH/AFM per-aircraft authoring overlay loader tests.
 *
 * Round-trips a small YAML payload through `loadPohAuthoring` to lock the
 * Zod schema:
 *
 *   - aircraftModel / manufacturer / revision / description / whyItMatters
 *     / topics flow through unchanged.
 *   - revisionDate + applicableSerialNumbers are optional.
 *   - topics is enum-validated against AVIATION_TOPIC_VALUES; an unknown
 *     topic value bails the load with a ZodError so seed runs fail loudly
 *     rather than silently dropping the chip.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPohAuthoring } from './poh-authoring';

function withTempYaml<T>(yamlBody: string, fn: (path: string) => Promise<T>): Promise<T> {
	const dir = mkdtempSync(join(tmpdir(), 'poh-authoring-test-'));
	const path = join(dir, 'poh.yaml');
	writeFileSync(path, yamlBody, 'utf-8');
	return fn(path).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('loadPohAuthoring', () => {
	it('returns an empty map when the file is missing', async () => {
		const result = await loadPohAuthoring('/tmp/does-not-exist-poh-authoring.yaml');
		expect(result).toEqual({});
	});

	it('parses the full overlay shape for one aircraft', async () => {
		const yaml = [
			'aircraft:',
			'  cessna-172s:',
			'    aircraftModel: "Cessna 172S Skyhawk"',
			'    manufacturer: "Cessna"',
			'    revision: "13"',
			'    revisionDate: "2024-08-01"',
			'    applicableSerialNumbers: "172S serial 172S8001 and on"',
			'    description: "test desc"',
			'    whyItMatters: "test why"',
			'    topics: ["aircraft-systems", "performance"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			const result = await loadPohAuthoring(path);
			expect(result['cessna-172s']).toBeDefined();
			expect(result['cessna-172s']?.aircraftModel).toBe('Cessna 172S Skyhawk');
			expect(result['cessna-172s']?.manufacturer).toBe('Cessna');
			expect(result['cessna-172s']?.revision).toBe('13');
			expect(result['cessna-172s']?.revisionDate).toBe('2024-08-01');
			expect(result['cessna-172s']?.applicableSerialNumbers).toBe('172S serial 172S8001 and on');
			expect(result['cessna-172s']?.description).toBe('test desc');
			expect(result['cessna-172s']?.whyItMatters).toBe('test why');
			expect(result['cessna-172s']?.topics).toEqual(['aircraft-systems', 'performance']);
		});
	});

	it('revisionDate and applicableSerialNumbers are optional', async () => {
		const yaml = [
			'aircraft:',
			'  cessna-172s:',
			'    aircraftModel: "Cessna 172S Skyhawk"',
			'    manufacturer: "Cessna"',
			'    revision: "13"',
			'    description: "test desc"',
			'    whyItMatters: "test why"',
			'    topics: ["aircraft-systems"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			const result = await loadPohAuthoring(path);
			expect(result['cessna-172s']).toBeDefined();
			expect(result['cessna-172s']?.revisionDate).toBeUndefined();
			expect(result['cessna-172s']?.applicableSerialNumbers).toBeUndefined();
		});
	});

	it('rejects an unknown topic value with a ZodError', async () => {
		const yaml = [
			'aircraft:',
			'  cessna-172s:',
			'    aircraftModel: "Cessna 172S Skyhawk"',
			'    manufacturer: "Cessna"',
			'    revision: "13"',
			'    description: "test desc"',
			'    whyItMatters: "test why"',
			'    topics: ["aircraft-systems", "not-a-real-topic"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			await expect(loadPohAuthoring(path)).rejects.toThrow();
		});
	});

	it('rejects an empty topics array (min: 1)', async () => {
		const yaml = [
			'aircraft:',
			'  cessna-172s:',
			'    aircraftModel: "Cessna 172S Skyhawk"',
			'    manufacturer: "Cessna"',
			'    revision: "13"',
			'    description: "test desc"',
			'    whyItMatters: "test why"',
			'    topics: []',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			await expect(loadPohAuthoring(path)).rejects.toThrow();
		});
	});

	it('rejects a topics array longer than AVIATION_TOPIC_MAX (5)', async () => {
		const yaml = [
			'aircraft:',
			'  cessna-172s:',
			'    aircraftModel: "Cessna 172S Skyhawk"',
			'    manufacturer: "Cessna"',
			'    revision: "13"',
			'    description: "test desc"',
			'    whyItMatters: "test why"',
			'    topics: ["aircraft-systems", "performance", "emergencies", "procedures", "weight-balance", "navigation"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			await expect(loadPohAuthoring(path)).rejects.toThrow();
		});
	});

	it('rejects an entry missing required manufacturer', async () => {
		const yaml = [
			'aircraft:',
			'  cessna-172s:',
			'    aircraftModel: "Cessna 172S Skyhawk"',
			'    revision: "13"',
			'    description: "test desc"',
			'    whyItMatters: "test why"',
			'    topics: ["aircraft-systems"]',
		].join('\n');
		await withTempYaml(yaml, async (path) => {
			await expect(loadPohAuthoring(path)).rejects.toThrow();
		});
	});
});
