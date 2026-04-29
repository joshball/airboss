/**
 * YAML config loader for `scripts/sources/config/`.
 *
 * Single source of truth for the source-corpus URL inventory. The downloader
 * reads from here at runtime; the Python ingest tool reads from the same files
 * (specifically `handbooks/<slug>.yaml`).
 *
 * All loaders are synchronous and cache results for the duration of a run --
 * config files don't change between calls within one process.
 *
 * On validation failure, every loader throws an error whose message points at
 * the YAML field path, so a typo in `ac.yaml` surfaces as
 * `ac.yaml: entries[3].url: Invalid url`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';
import {
	type AimConfig,
	AimConfigSchema,
	type FlatCorpusConfig,
	FlatCorpusSchema,
	type HandbookConfig,
	HandbookConfigSchema,
	type RegsConfig,
	RegsConfigSchema,
} from './schemas';

const CONFIG_DIR = new URL('.', import.meta.url).pathname;

interface CacheEntry<T> {
	value: T;
	mtime: number;
}

const cache: Map<string, CacheEntry<unknown>> = new Map();

function cacheKey(filename: string): string {
	return filename;
}

function readYaml(absPath: string): unknown {
	if (!existsSync(absPath)) {
		throw new Error(`Config file missing: ${absPath}`);
	}
	const raw = readFileSync(absPath, 'utf-8');
	return parse(raw);
}

function describeZodError(filename: string, error: z.ZodError): string {
	const messages = error.issues.map((issue) => {
		const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
		return `${filename}: ${path}: ${issue.message}`;
	});
	return messages.join('\n');
}

function loadAndValidate<T>(filename: string, schema: z.ZodType<T>): T {
	const key = cacheKey(filename);
	const cached = cache.get(key);
	if (cached !== undefined) return cached.value as T;
	const absPath = join(CONFIG_DIR, filename);
	const raw = readYaml(absPath);
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		throw new Error(`Invalid config:\n${describeZodError(filename, parsed.error)}`);
	}
	cache.set(key, { value: parsed.data, mtime: Date.now() });
	return parsed.data;
}

export function loadAcConfig(): FlatCorpusConfig {
	return loadAndValidate('ac.yaml', FlatCorpusSchema);
}

export function loadAcsConfig(): FlatCorpusConfig {
	return loadAndValidate('acs.yaml', FlatCorpusSchema);
}

export function loadHandbooksExtrasConfig(): FlatCorpusConfig {
	return loadAndValidate('handbooks-extras.yaml', FlatCorpusSchema);
}

export function loadAimConfig(): AimConfig {
	return loadAndValidate('aim.yaml', AimConfigSchema);
}

export function loadRegsConfig(): RegsConfig {
	return loadAndValidate('regs.yaml', RegsConfigSchema);
}

export function loadHandbookConfig(slug: string): HandbookConfig {
	const filename = `handbooks/${slug}.yaml`;
	const key = cacheKey(filename);
	const cached = cache.get(key);
	if (cached !== undefined) return cached.value as HandbookConfig;
	const absPath = join(CONFIG_DIR, filename);
	const raw = readYaml(absPath);
	const parsed = HandbookConfigSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error(`Invalid handbook config:\n${describeZodError(filename, parsed.error)}`);
	}
	cache.set(key, { value: parsed.data, mtime: Date.now() });
	return parsed.data;
}

export function listHandbookSlugs(): readonly string[] {
	const dir = join(CONFIG_DIR, 'handbooks');
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.yaml'))
		.map((f) => f.replace(/\.yaml$/, ''))
		.sort();
}

/**
 * Test-only: reset the in-process cache so test fixtures don't bleed across cases.
 */
export function _resetConfigCacheForTest(): void {
	cache.clear();
}
