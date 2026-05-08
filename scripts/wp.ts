#!/usr/bin/env bun

/**
 * Work-package dispatcher for airboss. ADR 025.
 *
 * Read-only CLI surface for the frontmatter-driven tracking system. Mirrors
 * the dispatcher pattern from `scripts/db.ts` and `scripts/sources.ts`: one
 * entry point, per-command help, exit non-zero on failure.
 *
 * Read-only in this PR (Phase 1). Mutations (`bun run wp set`) ship in
 * Phase 3 of the parent WP.
 *
 *   bun run wp                       # index
 *   bun run wp help
 *   bun run wp list [filters] [--json|--md]
 *   bun run wp show <wp-id> [--section spec|tasks|test-plan]
 *   bun run wp next                  # signed-off + unblocked + human-review pending
 *   bun run wp blocked               # depends_on includes any non-shipped WP
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	WP_AGENT_REVIEW_STATUSES,
	WP_CATEGORIES,
	WP_FIELD_ALIASES,
	WP_HUMAN_REVIEW_STATUSES,
	WP_OWNERS,
	WP_PRODUCTS,
	WP_SETTABLE_FIELDS,
	WP_STATUSES,
	type WPAgentReviewStatus,
	type WPCategory,
	type WPHumanReviewStatus,
	type WPProduct,
	type WPSettableField,
	type WPStatus,
} from '@ab/constants';
import type { WorkPackage } from '@ab/types';
import { isShipped, loadAllWorkPackages, loadWorkPackageFromSpec } from './lib/wp-loader';

interface ListFlags {
	product: WPProduct | null;
	category: WPCategory | null;
	status: WPStatus | null;
	humanReview: WPHumanReviewStatus | null;
	agentReview: WPAgentReviewStatus | null;
	tag: string | null;
	json: boolean;
	md: boolean;
}

interface ShowFlags {
	section: 'spec' | 'tasks' | 'test-plan' | 'all';
}

const KNOWN_LIST_FLAG_NAMES = new Set([
	'--product',
	'--category',
	'--status',
	'--human-review',
	'--agent-review',
	'--tag',
	'--json',
	'--md',
]);

function isOneOf<T extends string>(value: string, set: readonly T[]): value is T {
	return (set as readonly string[]).includes(value);
}

function parseListFlags(argv: readonly string[]): ListFlags {
	const flags: ListFlags = {
		product: null,
		category: null,
		status: null,
		humanReview: null,
		agentReview: null,
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
			console.error(`wp list: unexpected positional argument "${arg}"`);
			process.exit(1);
		}
		const eqIdx = arg.indexOf('=');
		const name = eqIdx >= 0 ? arg.slice(0, eqIdx) : arg;
		const value = eqIdx >= 0 ? arg.slice(eqIdx + 1) : argv[++i];
		if (!KNOWN_LIST_FLAG_NAMES.has(name)) {
			console.error(`wp list: unknown flag "${name}"`);
			process.exit(1);
		}
		if (value === undefined) {
			console.error(`wp list: flag "${name}" requires a value`);
			process.exit(1);
		}
		switch (name) {
			case '--product':
				if (!isOneOf(value, WP_PRODUCTS)) {
					console.error(`wp list: invalid product "${value}". Valid: ${WP_PRODUCTS.join(', ')}`);
					process.exit(1);
				}
				flags.product = value;
				break;
			case '--category':
				if (!isOneOf(value, WP_CATEGORIES)) {
					console.error(`wp list: invalid category "${value}". Valid: ${WP_CATEGORIES.join(', ')}`);
					process.exit(1);
				}
				flags.category = value;
				break;
			case '--status':
				if (!isOneOf(value, WP_STATUSES)) {
					console.error(`wp list: invalid status "${value}". Valid: ${WP_STATUSES.join(', ')}`);
					process.exit(1);
				}
				flags.status = value;
				break;
			case '--human-review':
				if (!isOneOf(value, WP_HUMAN_REVIEW_STATUSES)) {
					console.error(`wp list: invalid human-review "${value}". Valid: ${WP_HUMAN_REVIEW_STATUSES.join(', ')}`);
					process.exit(1);
				}
				flags.humanReview = value;
				break;
			case '--agent-review':
				if (!isOneOf(value, WP_AGENT_REVIEW_STATUSES)) {
					console.error(`wp list: invalid agent-review "${value}". Valid: ${WP_AGENT_REVIEW_STATUSES.join(', ')}`);
					process.exit(1);
				}
				flags.agentReview = value;
				break;
			case '--tag':
				flags.tag = value;
				break;
		}
	}
	return flags;
}

function applyFilters(packages: readonly WorkPackage[], flags: ListFlags): WorkPackage[] {
	return packages.filter((wp) => {
		const fm = wp.frontmatter;
		if (fm === null) {
			// Unparseable WPs only surface in default + --json. They do not match
			// any concrete filter.
			const anyFilter =
				flags.product !== null ||
				flags.category !== null ||
				flags.status !== null ||
				flags.humanReview !== null ||
				flags.agentReview !== null ||
				flags.tag !== null;
			return !anyFilter;
		}
		if (flags.product !== null && fm.product !== flags.product) return false;
		if (flags.category !== null && fm.category !== flags.category) return false;
		if (flags.status !== null && fm.status !== flags.status) return false;
		if (flags.humanReview !== null && fm.human_review_status !== flags.humanReview) return false;
		if (flags.agentReview !== null && fm.agent_review_status !== flags.agentReview) return false;
		if (flags.tag !== null && !fm.tags.includes(flags.tag)) return false;
		return true;
	});
}

function emitTable(packages: readonly WorkPackage[]): void {
	if (packages.length === 0) {
		console.log('(no work packages match)');
		return;
	}
	const rows = packages.map((wp) => {
		const fm = wp.frontmatter;
		if (fm === null) {
			return {
				id: wp.id,
				product: '?',
				category: '?',
				status: 'invalid',
				human: '?',
				agent: '?',
				title: `(${wp.validation_errors.length} validation errors)`,
			};
		}
		return {
			id: wp.id,
			product: fm.product,
			category: fm.category,
			status: fm.status,
			human: fm.human_review_status,
			agent: fm.agent_review_status,
			title: fm.title,
		};
	});
	const widths = {
		id: Math.max(2, ...rows.map((r) => r.id.length)),
		product: Math.max(7, ...rows.map((r) => r.product.length)),
		category: Math.max(8, ...rows.map((r) => r.category.length)),
		status: Math.max(6, ...rows.map((r) => r.status.length)),
		human: Math.max(5, ...rows.map((r) => r.human.length)),
		agent: Math.max(5, ...rows.map((r) => r.agent.length)),
	};
	const header = [
		'ID'.padEnd(widths.id),
		'PRODUCT'.padEnd(widths.product),
		'CATEGORY'.padEnd(widths.category),
		'STATUS'.padEnd(widths.status),
		'HUMAN'.padEnd(widths.human),
		'AGENT'.padEnd(widths.agent),
		'TITLE',
	].join('  ');
	console.log(header);
	console.log('-'.repeat(header.length));
	for (const r of rows) {
		console.log(
			[
				r.id.padEnd(widths.id),
				r.product.padEnd(widths.product),
				r.category.padEnd(widths.category),
				r.status.padEnd(widths.status),
				r.human.padEnd(widths.human),
				r.agent.padEnd(widths.agent),
				r.title,
			].join('  '),
		);
	}
	console.log('');
	console.log(`Total: ${rows.length}`);
}

function emitMarkdown(packages: readonly WorkPackage[]): void {
	if (packages.length === 0) {
		console.log('_No work packages match._');
		return;
	}
	console.log('| ID | Product | Category | Status | Human | Agent | Title |');
	console.log('| -- | ------- | -------- | ------ | ----- | ----- | ----- |');
	for (const wp of packages) {
		const fm = wp.frontmatter;
		if (fm === null) {
			console.log(`| ${wp.id} | ? | ? | invalid | ? | ? | (${wp.validation_errors.length} errors) |`);
			continue;
		}
		console.log(
			`| ${wp.id} | ${fm.product} | ${fm.category} | ${fm.status} | ${fm.human_review_status} | ${fm.agent_review_status} | ${fm.title} |`,
		);
	}
}

function emitJson(packages: readonly WorkPackage[]): void {
	console.log(JSON.stringify(packages, null, 2));
}

function commandList(argv: readonly string[]): number {
	const flags = parseListFlags(argv);
	const packages = applyFilters(loadAllWorkPackages(), flags);
	if (flags.json) {
		emitJson(packages);
	} else if (flags.md) {
		emitMarkdown(packages);
	} else {
		emitTable(packages);
	}
	return 0;
}

function parseShowFlags(argv: readonly string[]): { id: string; flags: ShowFlags } {
	let id: string | null = null;
	const flags: ShowFlags = { section: 'all' };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === undefined) continue;
		if (arg === '--section') {
			const value = argv[++i];
			if (value !== 'spec' && value !== 'tasks' && value !== 'test-plan') {
				console.error(`wp show: --section must be one of spec | tasks | test-plan`);
				process.exit(1);
			}
			flags.section = value;
			continue;
		}
		if (arg.startsWith('--')) {
			console.error(`wp show: unknown flag "${arg}"`);
			process.exit(1);
		}
		if (id !== null) {
			console.error(`wp show: only one wp-id allowed (got "${id}" and "${arg}")`);
			process.exit(1);
		}
		id = arg;
	}
	if (id === null) {
		console.error('wp show: missing required <wp-id>');
		process.exit(1);
	}
	return { id, flags };
}

function readSection(specPath: string, section: 'spec' | 'tasks' | 'test-plan'): string | null {
	const dir = dirname(specPath);
	const filename = section === 'spec' ? 'spec.md' : section === 'tasks' ? 'tasks.md' : 'test-plan.md';
	const path = join(dir, filename);
	if (!existsSync(path)) return null;
	return readFileSync(path, 'utf8');
}

function commandShow(argv: readonly string[]): number {
	const { id, flags } = parseShowFlags(argv);
	const packages = loadAllWorkPackages();
	const wp = packages.find((p) => p.id === id);
	if (wp === undefined) {
		console.error(`wp show: no work package found with id "${id}"`);
		return 1;
	}
	if (wp.frontmatter === null) {
		console.error(`wp show: ${id} has invalid frontmatter:`);
		for (const err of wp.validation_errors) console.error(`  [${err.field}] ${err.message}`);
		// continue and dump the body anyway -- the user can still want to read it
	}
	const sections: Array<'spec' | 'tasks' | 'test-plan'> =
		flags.section === 'all' ? ['spec', 'tasks', 'test-plan'] : [flags.section];
	for (const section of sections) {
		const body = readSection(wp.specPath, section);
		if (body === null) {
			if (flags.section !== 'all') {
				console.error(`wp show: ${id} has no ${section}.md`);
				return 1;
			}
			continue;
		}
		if (sections.length > 1) {
			console.log(`\n# ===== ${section}.md =====\n`);
		}
		console.log(body);
	}
	return 0;
}

function commandNext(): number {
	const packages = loadAllWorkPackages();
	const shippedIds = new Set(packages.filter(isShipped).map((p) => p.id));
	const candidates = packages.filter((wp) => {
		const fm = wp.frontmatter;
		if (fm === null) return false;
		if (fm.status !== 'signed-off') return false;
		if (fm.human_review_status !== 'pending') return false;
		// All depends_on must be shipped.
		for (const dep of fm.depends_on) {
			if (!shippedIds.has(dep)) return false;
		}
		return true;
	});
	if (candidates.length === 0) {
		console.log('(nothing unblocked + signed-off + pending human review)');
		return 0;
	}
	console.log('Unblocked work packages ready to walk:');
	console.log('');
	emitTable(candidates);
	return 0;
}

function commandBlocked(): number {
	const packages = loadAllWorkPackages();
	const shippedIds = new Set(packages.filter(isShipped).map((p) => p.id));
	const blocked = packages.filter((wp) => {
		const fm = wp.frontmatter;
		if (fm === null) return false;
		if (fm.status === 'shipped' || fm.status === 'abandoned' || fm.status === 'superseded') return false;
		return fm.depends_on.some((dep) => !shippedIds.has(dep));
	});
	if (blocked.length === 0) {
		console.log('(no work packages are blocked on unfinished deps)');
		return 0;
	}
	console.log('Blocked work packages (depends_on includes a non-shipped WP):');
	console.log('');
	for (const wp of blocked) {
		const fm = wp.frontmatter;
		if (fm === null) continue;
		const pending = fm.depends_on.filter((dep) => !shippedIds.has(dep));
		console.log(`  ${wp.id} (${fm.status}) -> waiting on: ${pending.join(', ')}`);
	}
	console.log('');
	console.log(`Total blocked: ${blocked.length}`);
	return 0;
}

// ---- set: mutation surface (ADR 025 Phase 3) ------------------------------

function isSettableField(value: string): value is WPSettableField {
	return (WP_SETTABLE_FIELDS as readonly string[]).includes(value);
}

function resolveFieldAlias(name: string): WPSettableField | null {
	const aliased = WP_FIELD_ALIASES[name];
	if (aliased !== undefined) return aliased;
	return isSettableField(name) ? name : null;
}

interface FrontmatterEdit {
	yaml: string;
	yamlEnd: number;
}

function splitFrontmatter(source: string): FrontmatterEdit | null {
	const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
	const match = source.match(fence);
	if (match === null || match.index !== 0) return null;
	const yaml = match[1] ?? '';
	const yamlStart = (match[0].indexOf('\n') ?? -1) + 1;
	const yamlEnd = yamlStart + yaml.length;
	return { yaml, yamlEnd };
}

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
	if (lines.length > 0 && lines[lines.length - 1] === '') {
		lines[lines.length - 1] = `${field}: ${rendered}`;
		lines.push('');
	} else {
		lines.push(`${field}: ${rendered}`);
	}
	return lines.join('\n');
}

function renderJsonStringArray(field: string, raw: string): string | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.error(`wp set: ${field} must be a JSON array; got "${raw}"`);
		return null;
	}
	if (!Array.isArray(parsed)) {
		console.error(`wp set: ${field} must be a JSON array`);
		return null;
	}
	for (const t of parsed) {
		if (typeof t !== 'string' || t.length === 0) {
			console.error(`wp set: ${field} entries must be non-empty strings`);
			return null;
		}
	}
	return `[${parsed.map((t) => JSON.stringify(t)).join(', ')}]`;
}

function renderJsonNumberArray(field: string, raw: string): string | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.error(`wp set: ${field} must be a JSON array of integers; got "${raw}"`);
		return null;
	}
	if (!Array.isArray(parsed)) {
		console.error(`wp set: ${field} must be a JSON array`);
		return null;
	}
	for (const t of parsed) {
		if (typeof t !== 'number' || !Number.isInteger(t) || t < 1) {
			console.error(`wp set: ${field} entries must be positive integers`);
			return null;
		}
	}
	return `[${parsed.join(', ')}]`;
}

function renderValue(field: WPSettableField, raw: string): string | null {
	const trimmed = raw.trim();
	switch (field) {
		case 'status':
			if (!isOneOf(trimmed, WP_STATUSES)) {
				console.error(`wp set: invalid status "${trimmed}". Valid: ${WP_STATUSES.join(', ')}`);
				return null;
			}
			return trimmed;
		case 'agent_review_status':
			if (!isOneOf(trimmed, WP_AGENT_REVIEW_STATUSES)) {
				console.error(
					`wp set: invalid agent_review_status "${trimmed}". Valid: ${WP_AGENT_REVIEW_STATUSES.join(', ')}`,
				);
				return null;
			}
			return trimmed;
		case 'human_review_status':
			if (!isOneOf(trimmed, WP_HUMAN_REVIEW_STATUSES)) {
				console.error(
					`wp set: invalid human_review_status "${trimmed}". Valid: ${WP_HUMAN_REVIEW_STATUSES.join(', ')}`,
				);
				return null;
			}
			return trimmed;
		case 'category':
			if (!isOneOf(trimmed, WP_CATEGORIES)) {
				console.error(`wp set: invalid category "${trimmed}". Valid: ${WP_CATEGORIES.join(', ')}`);
				return null;
			}
			return trimmed;
		case 'product':
			if (!isOneOf(trimmed, WP_PRODUCTS)) {
				console.error(`wp set: invalid product "${trimmed}". Valid: ${WP_PRODUCTS.join(', ')}`);
				return null;
			}
			return trimmed;
		case 'owner':
			if (!isOneOf(trimmed, WP_OWNERS)) {
				console.error(`wp set: invalid owner "${trimmed}". Valid: ${WP_OWNERS.join(', ')}`);
				return null;
			}
			return trimmed;
		case 'shipped_date':
			if (trimmed === 'null') return 'null';
			if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
				console.error(`wp set: shipped_date must be YYYY-MM-DD or "null"; got "${trimmed}"`);
				return null;
			}
			return trimmed;
		case 'shipped_prs':
			return renderJsonNumberArray('shipped_prs', trimmed);
		case 'depends_on':
		case 'unblocks':
		case 'tags':
			return renderJsonStringArray(field, trimmed);
	}
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

interface SetFlags {
	json: boolean;
}

function parseSetFlags(argv: readonly string[]): { positional: string[]; flags: SetFlags } {
	const positional: string[] = [];
	const flags: SetFlags = { json: false };
	for (const arg of argv) {
		if (arg === '--json') {
			flags.json = true;
			continue;
		}
		if (arg.startsWith('--')) {
			console.error(`wp set: unknown flag "${arg}"`);
			process.exit(1);
		}
		positional.push(arg);
	}
	return { positional, flags };
}

function commandSet(argv: readonly string[]): number {
	const { positional, flags } = parseSetFlags(argv);
	const id = positional[0];
	const fieldArg = positional[1];
	const valueArg = positional[2];
	if (id === undefined || fieldArg === undefined || valueArg === undefined) {
		console.error('wp set: usage: bun run wp set <wp-id> <field> <value>');
		console.error(`  Whitelisted fields: ${WP_SETTABLE_FIELDS.join(', ')}`);
		console.error(`  Aliases: ${Object.keys(WP_FIELD_ALIASES).join(', ')}`);
		return 1;
	}
	const field = resolveFieldAlias(fieldArg);
	if (field === null) {
		console.error(`wp set: field "${fieldArg}" is not in the mutation whitelist.`);
		console.error(`  Whitelisted: ${WP_SETTABLE_FIELDS.join(', ')}`);
		console.error(`  Aliases: ${Object.keys(WP_FIELD_ALIASES).join(', ')}`);
		return 1;
	}
	// Resolve repo root via the loader's cached resolution: load the WP by id.
	const all = loadAllWorkPackages();
	const before = all.find((p) => p.id === id);
	if (before === undefined) {
		console.error(`wp set: no work package found with id "${id}"`);
		return 1;
	}
	if (before.frontmatter === null) {
		console.error(`wp set: ${id} has invalid frontmatter; cannot mutate. Fix the spec first.`);
		for (const err of before.validation_errors) console.error(`  [${err.field}] ${err.message}`);
		return 1;
	}

	// Pre-flight the shipped-transition gate so we surface a friendly message
	// instead of letting the post-write re-validate fail.
	if (field === 'status' && valueArg.trim() === 'shipped' && before.frontmatter.human_review_status !== 'signed-off') {
		console.error(
			`wp set: cannot set status=shipped while human_review_status=${before.frontmatter.human_review_status}.`,
		);
		console.error('Lint enforces: status: shipped requires human_review_status: signed-off.');
		console.error(`First: bun run wp set ${id} human-review signed-off (user only)`);
		console.error(`Then:  bun run wp set ${id} status shipped`);
		return 1;
	}

	const rendered = renderValue(field, valueArg);
	if (rendered === null) return 1;

	const specPath = before.specPath;
	const source = readFileSync(specPath, 'utf8');
	const split = splitFrontmatter(source);
	if (split === null) {
		console.error(`wp set: ${specPath} has no frontmatter fence; refusing to mutate`);
		return 1;
	}
	let newYaml = setFrontmatterField(split.yaml, field, rendered);

	// Auto-set shipped_date when status flips to shipped and date is null/missing.
	let autoSetDate: string | null = null;
	const dateMissing = before.frontmatter.shipped_date === null || before.frontmatter.shipped_date === undefined;
	if (field === 'status' && rendered === 'shipped' && dateMissing) {
		const today = todayIso();
		newYaml = setFrontmatterField(newYaml, 'shipped_date', today);
		autoSetDate = today;
	}

	const newSource = `---\n${newYaml}\n---${source.slice(split.yamlEnd + '\n---'.length)}`;
	writeFileSync(specPath, newSource);

	const after = loadWorkPackageFromSpec(specPath, id);
	if (after.frontmatter === null) {
		console.error(`wp set: write left ${specPath} invalid:`);
		for (const err of after.validation_errors) console.error(`  [${err.field}] ${err.message}`);
		return 1;
	}

	if (flags.json) {
		console.log(JSON.stringify(after.frontmatter, null, 2));
	} else {
		console.log(`wp set: ${id}.${field} = ${rendered}`);
		if (autoSetDate !== null) {
			console.error(`wp set: also set shipped_date = ${autoSetDate} (auto, was null)`);
		}
	}
	return 0;
}

function printIndex(): void {
	console.log('Usage: bun run wp <command> [flags]');
	console.log('       bun run wp <command> --help');
	console.log('');
	console.log('Commands:');
	console.log('  list       List work packages, optionally filtered');
	console.log('  show       Render one WP (spec + tasks + test-plan, or one section)');
	console.log('  next       WPs ready to walk: signed-off, deps shipped, human review pending');
	console.log('  blocked    WPs whose depends_on includes a non-shipped WP');
	console.log('  set        Mutate a whitelisted frontmatter field');
	console.log('  help       Show this index');
	console.log('');
	console.log('Filters for `list` (compose with AND):');
	console.log(`  --product       ${WP_PRODUCTS.join(' | ')}`);
	console.log(`  --category      ${WP_CATEGORIES.join(' | ')}`);
	console.log(`  --status        ${WP_STATUSES.join(' | ')}`);
	console.log(`  --human-review  ${WP_HUMAN_REVIEW_STATUSES.join(' | ')}`);
	console.log(`  --agent-review  ${WP_AGENT_REVIEW_STATUSES.join(' | ')}`);
	console.log('  --tag <name>    free-form tag (matches if tags array contains it)');
	console.log('');
	console.log('Output formats for `list` (default: human table):');
	console.log('  --json          JSON array, full WorkPackage shape');
	console.log('  --md            embeddable markdown table');
	console.log('');
	console.log('Mutation (`set`) whitelist:');
	console.log(`  ${WP_SETTABLE_FIELDS.join(', ')}`);
	console.log('Aliases:');
	console.log(`  ${Object.keys(WP_FIELD_ALIASES).join(', ')}`);
	console.log('');
	console.log('See: docs/decisions/025-wp-frontmatter-contract/decision.md');
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
	case 'next':
		exitCode = commandNext();
		break;
	case 'blocked':
		exitCode = commandBlocked();
		break;
	case 'set':
		exitCode = commandSet(rest);
		break;
	default:
		console.error(`wp: unknown command "${head}"`);
		printIndex();
		exitCode = 1;
}
process.exit(exitCode);
