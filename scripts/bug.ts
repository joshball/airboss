#!/usr/bin/env bun

/**
 * Bug dispatcher for airboss. Phase 6 of `tracking-system-overhaul`.
 *
 * Mirrors the dispatcher pattern from `scripts/wp.ts`: one entry point,
 * per-command help, exit non-zero on failure. Read + scaffold + mutation
 * surface for the frontmatter-driven bug tracker.
 *
 *   bun run bug                       # index
 *   bun run bug help
 *   bun run bug list [filters] [--json|--md]
 *   bun run bug show <bug-id>
 *   bun run bug new <slug>            # scaffold a new bug file
 *   bun run bug set <bug-id> <field> <value>
 *   bun run bug index                 # regenerate docs/bugs/INDEX.md
 *
 * Mutation whitelist for `set`: status, severity, fix_pr, fix_wp, tags.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
	BUG_DIR,
	BUG_SEVERITIES,
	BUG_STATUSES,
	type BugSeverity,
	type BugStatus,
	WP_PRODUCTS,
	type WPProduct,
} from '@ab/constants';
import type { Bug } from '@ab/types';
import { isOpen, loadAllBugs, loadBugFromFile } from './lib/bug-loader';
import { generateBugsIndex } from './tracking/generate-bugs-index';

const SET_FIELD_NAMES = ['status', 'severity', 'fix_pr', 'fix_wp', 'tags'] as const;
type SetFieldName = (typeof SET_FIELD_NAMES)[number];

interface ListFlags {
	product: WPProduct | null;
	severity: BugSeverity | null;
	status: BugStatus | null;
	tag: string | null;
	json: boolean;
	md: boolean;
}

const KNOWN_LIST_FLAG_NAMES = new Set(['--product', '--severity', '--status', '--tag', '--json', '--md']);

function isOneOf<T extends string>(value: string, set: readonly T[]): value is T {
	return (set as readonly string[]).includes(value);
}

function walkUpForAirbossPackageJson(start: string): string | null {
	let dir = start;
	for (let i = 0; i < 16; i += 1) {
		const candidate = join(dir, 'package.json');
		try {
			const json = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
			if (json.name === 'airboss') return dir;
		} catch {
			// continue
		}
		const parent = resolve(dir, '..');
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

/**
 * Resolve the airboss repo root the CLI should write into. Prefers `process.cwd()`
 * (so tests can spin up a synthetic repo in a tmpdir) and falls back to the
 * source location of this module (so a normal `bun run bug` from anywhere in
 * the real worktree still works).
 */
function resolveRepoRoot(): string {
	const fromCwd = walkUpForAirbossPackageJson(process.cwd());
	if (fromCwd !== null) return fromCwd;
	const fromSource = walkUpForAirbossPackageJson(import.meta.dir);
	if (fromSource !== null) return fromSource;
	throw new Error('bug: unable to locate repo root (airboss package.json)');
}

function parseListFlags(argv: readonly string[]): ListFlags {
	const flags: ListFlags = {
		product: null,
		severity: null,
		status: null,
		tag: null,
		json: false,
		md: false,
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === undefined) continue;
		if (arg === '--json') {
			flags.json = true;
			continue;
		}
		if (arg === '--md') {
			flags.md = true;
			continue;
		}
		if (!arg.startsWith('--')) {
			console.error(`bug list: unexpected positional argument "${arg}"`);
			process.exit(1);
		}
		const eqIdx = arg.indexOf('=');
		const name = eqIdx >= 0 ? arg.slice(0, eqIdx) : arg;
		const value = eqIdx >= 0 ? arg.slice(eqIdx + 1) : argv[++i];
		if (!KNOWN_LIST_FLAG_NAMES.has(name)) {
			console.error(`bug list: unknown flag "${name}"`);
			process.exit(1);
		}
		if (value === undefined) {
			console.error(`bug list: flag "${name}" requires a value`);
			process.exit(1);
		}
		switch (name) {
			case '--product':
				if (!isOneOf(value, WP_PRODUCTS)) {
					console.error(`bug list: invalid product "${value}". Valid: ${WP_PRODUCTS.join(', ')}`);
					process.exit(1);
				}
				flags.product = value;
				break;
			case '--severity':
				if (!isOneOf(value, BUG_SEVERITIES)) {
					console.error(`bug list: invalid severity "${value}". Valid: ${BUG_SEVERITIES.join(', ')}`);
					process.exit(1);
				}
				flags.severity = value;
				break;
			case '--status':
				if (!isOneOf(value, BUG_STATUSES)) {
					console.error(`bug list: invalid status "${value}". Valid: ${BUG_STATUSES.join(', ')}`);
					process.exit(1);
				}
				flags.status = value;
				break;
			case '--tag':
				flags.tag = value;
				break;
		}
	}
	return flags;
}

function applyFilters(bugs: readonly Bug[], flags: ListFlags): Bug[] {
	return bugs.filter((bug) => {
		const fm = bug.frontmatter;
		if (fm === null) {
			const anyFilter =
				flags.product !== null || flags.severity !== null || flags.status !== null || flags.tag !== null;
			return !anyFilter;
		}
		if (flags.product !== null && fm.product !== flags.product) return false;
		if (flags.severity !== null && fm.severity !== flags.severity) return false;
		if (flags.status !== null && fm.status !== flags.status) return false;
		if (flags.tag !== null && !fm.tags.includes(flags.tag)) return false;
		return true;
	});
}

function emitTable(bugs: readonly Bug[]): void {
	if (bugs.length === 0) {
		console.log('(no bugs match)');
		return;
	}
	const rows = bugs.map((bug) => {
		const fm = bug.frontmatter;
		if (fm === null) {
			return {
				id: bug.id,
				product: '?',
				severity: '?',
				status: 'invalid',
				title: `(${bug.validation_errors.length} validation errors)`,
			};
		}
		return {
			id: bug.id,
			product: fm.product,
			severity: fm.severity,
			status: fm.status,
			title: fm.title,
		};
	});
	const widths = {
		id: Math.max(2, ...rows.map((r) => r.id.length)),
		product: Math.max(7, ...rows.map((r) => r.product.length)),
		severity: Math.max(8, ...rows.map((r) => r.severity.length)),
		status: Math.max(6, ...rows.map((r) => r.status.length)),
	};
	const header = [
		'ID'.padEnd(widths.id),
		'PRODUCT'.padEnd(widths.product),
		'SEVERITY'.padEnd(widths.severity),
		'STATUS'.padEnd(widths.status),
		'TITLE',
	].join('  ');
	console.log(header);
	console.log('-'.repeat(header.length));
	for (const r of rows) {
		console.log(
			[
				r.id.padEnd(widths.id),
				r.product.padEnd(widths.product),
				r.severity.padEnd(widths.severity),
				r.status.padEnd(widths.status),
				r.title,
			].join('  '),
		);
	}
	console.log('');
	console.log(`Total: ${rows.length}`);
}

function emitMarkdown(bugs: readonly Bug[]): void {
	if (bugs.length === 0) {
		console.log('_No bugs match._');
		return;
	}
	console.log('| ID | Product | Severity | Status | Title |');
	console.log('| -- | ------- | -------- | ------ | ----- |');
	for (const bug of bugs) {
		const fm = bug.frontmatter;
		if (fm === null) {
			console.log(`| ${bug.id} | ? | ? | invalid | (${bug.validation_errors.length} errors) |`);
			continue;
		}
		console.log(`| ${bug.id} | ${fm.product} | ${fm.severity} | ${fm.status} | ${fm.title} |`);
	}
}

function emitJson(bugs: readonly Bug[]): void {
	console.log(JSON.stringify(bugs, null, 2));
}

function commandList(argv: readonly string[]): number {
	const flags = parseListFlags(argv);
	const bugs = applyFilters(loadAllBugs(), flags);
	if (flags.json) {
		emitJson(bugs);
	} else if (flags.md) {
		emitMarkdown(bugs);
	} else {
		emitTable(bugs);
	}
	return 0;
}

function commandShow(argv: readonly string[]): number {
	const id = argv[0];
	if (id === undefined) {
		console.error('bug show: missing required <bug-id>');
		return 1;
	}
	const bugs = loadAllBugs();
	const bug = bugs.find((b) => b.id === id);
	if (bug === undefined) {
		console.error(`bug show: no bug found with id "${id}"`);
		return 1;
	}
	if (bug.frontmatter === null) {
		console.error(`bug show: ${id} has invalid frontmatter:`);
		for (const err of bug.validation_errors) console.error(`  [${err.field}] ${err.message}`);
	}
	const body = readFileSync(bug.bugPath, 'utf8');
	console.log(body);
	return 0;
}

interface NewFlags {
	slug: string;
	title: string | null;
	product: WPProduct | null;
	severity: BugSeverity | null;
}

function parseNewFlags(argv: readonly string[]): NewFlags {
	let slug: string | null = null;
	const flags: NewFlags = { slug: '', title: null, product: null, severity: null };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === undefined) continue;
		if (arg === '--title') {
			flags.title = argv[++i] ?? null;
			continue;
		}
		if (arg === '--product') {
			const value = argv[++i];
			if (value !== undefined && isOneOf(value, WP_PRODUCTS)) flags.product = value;
			continue;
		}
		if (arg === '--severity') {
			const value = argv[++i];
			if (value !== undefined && isOneOf(value, BUG_SEVERITIES)) flags.severity = value;
			continue;
		}
		if (arg.startsWith('--')) {
			console.error(`bug new: unknown flag "${arg}"`);
			process.exit(1);
		}
		if (slug !== null) {
			console.error(`bug new: only one slug allowed (got "${slug}" and "${arg}")`);
			process.exit(1);
		}
		slug = arg;
	}
	if (slug === null) {
		console.error('bug new: missing required <slug>');
		process.exit(1);
	}
	flags.slug = slug;
	return flags;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function commandNew(argv: readonly string[]): number {
	const flags = parseNewFlags(argv);
	const rawSlug = flags.slug.startsWith('bug-') ? flags.slug.slice('bug-'.length) : flags.slug;
	if (!SLUG_PATTERN.test(rawSlug)) {
		console.error(`bug new: slug "${flags.slug}" is not kebab-case (lowercase letters, digits, hyphens)`);
		return 1;
	}
	const id = `bug-${rawSlug}`;
	const repoRoot = resolveRepoRoot();
	const targetPath = join(repoRoot, BUG_DIR, `${id}.md`);
	if (existsSync(targetPath)) {
		console.error(`bug new: ${targetPath} already exists`);
		return 1;
	}
	const today = new Date().toISOString().slice(0, 10);
	const title = flags.title ?? `<title>`;
	const product = flags.product ?? 'platform';
	const severity = flags.severity ?? 'minor';
	const body = `---
id: ${id}
title: ${title}
product: ${product}
severity: ${severity}
status: open
discovered_pr: null
discovered_date: ${today}
fix_pr: null
fix_wp: null
tags: []
---

# ${title}

(Describe the bug, repro steps, investigation notes, screenshots.)
`;
	writeFileSync(targetPath, body);
	console.log(`bug new: created ${targetPath}`);
	return 0;
}

function isSetFieldName(value: string): value is SetFieldName {
	return (SET_FIELD_NAMES as readonly string[]).includes(value);
}

interface FrontmatterEdit {
	source: string;
	yaml: string;
	yamlStart: number;
	yamlEnd: number;
}

function splitFrontmatter(source: string): FrontmatterEdit | null {
	const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
	const match = source.match(fence);
	if (match === null || match.index !== 0) return null;
	const full = match[0];
	const yaml = match[1] ?? '';
	const yamlStart = full.indexOf('\n') + 1;
	// yamlEnd is the position right before the closing `---`.
	const yamlEnd = yamlStart + yaml.length;
	return { source, yaml, yamlStart, yamlEnd };
}

/**
 * Replace (or insert) a single top-level YAML scalar/array key in a frontmatter
 * block. Authors keep human-friendly key ordering and comments; we only touch
 * one line at a time. The mutated value is rendered as a YAML literal with no
 * fancy indentation so the round-trip stays diff-friendly.
 */
function setFrontmatterField(yaml: string, field: string, rendered: string): string {
	const lines = yaml.split('\n');
	const fieldRe = new RegExp(`^${field}\\s*:`);
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] ?? '';
		if (fieldRe.test(line)) {
			lines[i] = `${field}: ${rendered}`;
			return lines.join('\n');
		}
	}
	// Append at the end of the block.
	if (lines.length > 0 && lines[lines.length - 1] === '') {
		lines[lines.length - 1] = `${field}: ${rendered}`;
		lines.push('');
	} else {
		lines.push(`${field}: ${rendered}`);
	}
	return lines.join('\n');
}

function renderValue(field: SetFieldName, raw: string): string | null {
	const trimmed = raw.trim();
	switch (field) {
		case 'status':
			if (!isOneOf(trimmed, BUG_STATUSES)) {
				console.error(`bug set: invalid status "${trimmed}". Valid: ${BUG_STATUSES.join(', ')}`);
				return null;
			}
			return trimmed;
		case 'severity':
			if (!isOneOf(trimmed, BUG_SEVERITIES)) {
				console.error(`bug set: invalid severity "${trimmed}". Valid: ${BUG_SEVERITIES.join(', ')}`);
				return null;
			}
			return trimmed;
		case 'fix_pr':
			if (trimmed === 'null') return 'null';
			if (!/^\d+$/.test(trimmed)) {
				console.error(`bug set: fix_pr must be a positive integer or "null"; got "${trimmed}"`);
				return null;
			}
			return trimmed;
		case 'fix_wp':
			if (trimmed === 'null') return 'null';
			if (!/^[a-z0-9][a-z0-9-]*$/.test(trimmed)) {
				console.error(`bug set: fix_wp must be a kebab-case WP id or "null"; got "${trimmed}"`);
				return null;
			}
			return trimmed;
		case 'tags': {
			let parsed: unknown;
			try {
				parsed = JSON.parse(trimmed);
			} catch {
				console.error(`bug set: tags must be a JSON array; got "${trimmed}"`);
				return null;
			}
			if (!Array.isArray(parsed)) {
				console.error('bug set: tags must be a JSON array');
				return null;
			}
			for (const t of parsed) {
				if (typeof t !== 'string' || t.length === 0) {
					console.error('bug set: tags entries must be non-empty strings');
					return null;
				}
			}
			return `[${parsed.map((t) => JSON.stringify(t)).join(', ')}]`;
		}
	}
}

function commandSet(argv: readonly string[]): number {
	const id = argv[0];
	const fieldArg = argv[1];
	const valueArg = argv[2];
	if (id === undefined || fieldArg === undefined || valueArg === undefined) {
		console.error('bug set: usage: bun run bug set <bug-id> <field> <value>');
		console.error(`  Whitelisted fields: ${SET_FIELD_NAMES.join(', ')}`);
		return 1;
	}
	if (!isSetFieldName(fieldArg)) {
		console.error(`bug set: field "${fieldArg}" is not in the mutation whitelist.`);
		console.error(`  Whitelisted fields: ${SET_FIELD_NAMES.join(', ')}`);
		return 1;
	}
	const repoRoot = resolveRepoRoot();
	const bugPath = join(repoRoot, BUG_DIR, `${id}.md`);
	if (!existsSync(bugPath)) {
		console.error(`bug set: no bug at ${bugPath}`);
		return 1;
	}
	const before = loadBugFromFile(bugPath, id);
	if (before.frontmatter === null) {
		console.error(`bug set: ${id} has invalid frontmatter; cannot mutate`);
		for (const err of before.validation_errors) console.error(`  [${err.field}] ${err.message}`);
		return 1;
	}
	const rendered = renderValue(fieldArg, valueArg);
	if (rendered === null) return 1;

	const source = readFileSync(bugPath, 'utf8');
	const split = splitFrontmatter(source);
	if (split === null) {
		console.error(`bug set: ${bugPath} has no frontmatter fence; refusing to mutate`);
		return 1;
	}
	const newYaml = setFrontmatterField(split.yaml, fieldArg, rendered);
	const newSource = `---\n${newYaml}\n---${source.slice(split.yamlEnd + '\n---'.length)}`;
	writeFileSync(bugPath, newSource);

	// Re-validate to catch a write that leaves the file invalid.
	const after = loadBugFromFile(bugPath, id);
	if (after.frontmatter === null) {
		console.error(`bug set: write left ${bugPath} invalid:`);
		for (const err of after.validation_errors) console.error(`  [${err.field}] ${err.message}`);
		return 1;
	}
	console.log(`bug set: ${id}.${fieldArg} = ${rendered}`);
	return 0;
}

function commandIndex(): number {
	const repoRoot = resolveRepoRoot();
	const indexPath = join(repoRoot, BUG_DIR, 'INDEX.md');
	const bugs = loadAllBugs();
	const body = generateBugsIndex(bugs);
	writeFileSync(indexPath, body);
	console.log(`bug index: wrote ${indexPath} (${bugs.filter(isOpen).length} open of ${bugs.length} total)`);
	return 0;
}

function printIndex(): void {
	console.log('Usage: bun run bug <command> [flags]');
	console.log('       bun run bug <command> --help');
	console.log('');
	console.log('Commands:');
	console.log('  list       List bugs, optionally filtered');
	console.log('  show       Render one bug (frontmatter + body)');
	console.log('  new        Scaffold a new bug file');
	console.log('  set        Mutate a whitelisted frontmatter field');
	console.log('  index      Regenerate docs/bugs/INDEX.md');
	console.log('  help       Show this index');
	console.log('');
	console.log('Filters for `list` (compose with AND):');
	console.log(`  --product   ${WP_PRODUCTS.join(' | ')}`);
	console.log(`  --severity  ${BUG_SEVERITIES.join(' | ')}`);
	console.log(`  --status    ${BUG_STATUSES.join(' | ')}`);
	console.log('  --tag <name>  free-form tag (matches if tags array contains it)');
	console.log('');
	console.log('Output formats for `list` (default: human table):');
	console.log('  --json      JSON array, full Bug shape');
	console.log('  --md        embeddable markdown table');
	console.log('');
	console.log('Mutation (`set`) whitelist:');
	console.log(`  ${SET_FIELD_NAMES.join(', ')}`);
	console.log('');
	console.log('Scaffold flags for `new`:');
	console.log('  --title <text>     human title (default: <title>)');
	console.log(`  --product <name>   one of ${WP_PRODUCTS.join(' | ')} (default: platform)`);
	console.log(`  --severity <name>  one of ${BUG_SEVERITIES.join(' | ')} (default: minor)`);
	console.log('');
	console.log('See: docs/work-packages/tracking-system-overhaul/spec.md (Phase 6)');
}

const argv = process.argv.slice(2);
const [head, ...rest] = argv;
let exitCode = 0;
switch (head) {
	case undefined:
	case 'help':
	case '--help':
	case '-h':
		printIndex();
		break;
	case 'list':
		exitCode = commandList(rest);
		break;
	case 'show':
		exitCode = commandShow(rest);
		break;
	case 'new':
		exitCode = commandNew(rest);
		break;
	case 'set':
		exitCode = commandSet(rest);
		break;
	case 'index':
		exitCode = commandIndex();
		break;
	default:
		console.error(`bug: unknown command "${head}"`);
		printIndex();
		exitCode = 1;
}
process.exit(exitCode);
