#!/usr/bin/env bun
/**
 * One-shot migration: rename every `index.md` and `document.md` in the inline
 * derivative tree to a self-describing filename, and embed slugs in chapter
 * directory names. Per `docs/work-packages/rename-generic-content-files/`.
 *
 * Lifecycle: lands and is deleted in the same PR.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

interface Move {
	from: string;
	to: string;
}

function slugify(title: string): string {
	const lowered = title.toLowerCase();
	const dehyphenated = lowered.replace(/[^a-z0-9]+/g, '-');
	const trimmed = dehyphenated.replace(/^-+|-+$/g, '');
	const truncated = trimmed.slice(0, 48).replace(/-+$/g, '');
	return truncated.length === 0 ? 'section' : truncated;
}

function pad2(n: number | string): string {
	const num = typeof n === 'string' ? parseInt(n, 10) : n;
	return String(num).padStart(2, '0');
}

function gitMv(from: string, to: string): void {
	const fromAbs = resolve(REPO_ROOT, from);
	const toAbs = resolve(REPO_ROOT, to);
	if (!existsSync(fromAbs)) {
		throw new Error(`source missing: ${from}`);
	}
	if (existsSync(toAbs)) {
		throw new Error(`destination already exists: ${to}`);
	}
	const toDir = dirname(toAbs);
	execSync(`mkdir -p '${toDir}'`);
	execSync(`git mv '${fromAbs}' '${toAbs}'`, { cwd: REPO_ROOT });
}

function rewriteManifestBodyPaths(manifestPath: string, mapping: Map<string, string>): void {
	const raw = readFileSync(manifestPath, 'utf-8');
	let updated = raw;
	for (const [oldPath, newPath] of mapping) {
		updated = updated.split(oldPath).join(newPath);
	}
	if (updated !== raw) {
		writeFileSync(manifestPath, updated, 'utf-8');
	}
}

// -----------------------------------------------------------------------------
// Chapter-aware handbooks (PHAK, AFH, AVWX)
// -----------------------------------------------------------------------------

interface HandbookSection {
	level: string;
	code: string;
	title: string;
	body_path: string;
}

interface HandbookManifest {
	document_slug: string;
	edition: string;
	sections: HandbookSection[];
}

function migrateChapterAwareHandbook(manifestPath: string): Move[] {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as HandbookManifest;
	const moves: Move[] = [];
	const pathMap = new Map<string, string>();
	const dirRenames: Move[] = [];

	for (const section of manifest.sections) {
		if (section.level !== 'chapter') continue;
		const code = pad2(section.code);
		const slug = slugify(section.title);
		const oldDir = join('handbooks', manifest.document_slug, manifest.edition, code);
		const newDir = join('handbooks', manifest.document_slug, manifest.edition, `${code}-${slug}`);
		dirRenames.push({ from: oldDir, to: newDir });
	}

	for (const { from: oldDir, to: newDir } of dirRenames) {
		if (existsSync(resolve(REPO_ROOT, oldDir))) {
			gitMv(oldDir, newDir);
			moves.push({ from: oldDir, to: newDir });
		}
	}

	for (const section of manifest.sections) {
		if (section.level !== 'chapter') continue;
		const code = pad2(section.code);
		const slug = slugify(section.title);
		const newDir = join('handbooks', manifest.document_slug, manifest.edition, `${code}-${slug}`);
		const oldOverview = join(newDir, 'index.md');
		const newOverview = join(newDir, `00-${slug}.md`);
		if (existsSync(resolve(REPO_ROOT, oldOverview))) {
			gitMv(oldOverview, newOverview);
			moves.push({ from: oldOverview, to: newOverview });
		}
	}

	for (const section of manifest.sections) {
		const code = pad2(section.code.split('.')[0] || section.code.split('-')[0] || '0');
		const oldDirSegment = `/${manifest.edition}/${code}/`;
		const newSlug = manifest.sections.find((s) => s.level === 'chapter' && pad2(s.code) === code)?.title;
		if (!newSlug) continue;
		const newDirSegment = `/${manifest.edition}/${code}-${slugify(newSlug)}/`;
		pathMap.set(oldDirSegment, newDirSegment);
	}

	for (const section of manifest.sections) {
		const code = pad2(section.code.split('.')[0] || section.code.split('-')[0] || '0');
		const chapterTitle = manifest.sections.find((s) => s.level === 'chapter' && pad2(s.code) === code)?.title;
		if (!chapterTitle) continue;
		const slug = slugify(chapterTitle);
		const oldIndexPath = `/${code}-${slug}/index.md`;
		const newIndexPath = `/${code}-${slug}/00-${slug}.md`;
		pathMap.set(oldIndexPath, newIndexPath);
	}

	rewriteManifestBodyPaths(manifestPath, pathMap);
	return moves;
}

// -----------------------------------------------------------------------------
// AIM
// -----------------------------------------------------------------------------

interface AimEntry {
	kind: string;
	code: string;
	title: string;
	body_path: string;
}

interface AimManifest {
	edition: string;
	entries: AimEntry[];
}

function parseAimCode(code: string): string[] {
	return code.split('-');
}

function migrateAim(manifestPath: string): Move[] {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AimManifest;
	const moves: Move[] = [];
	const pathMap = new Map<string, string>();

	const chapters = manifest.entries.filter((s) => s.kind === 'chapter');
	const sections = manifest.entries.filter((s) => s.kind === 'section');
	const paragraphs = manifest.entries.filter((s) => s.kind === 'paragraph');

	const chapterCodeToSlug = new Map<string, string>();
	for (const ch of chapters) {
		const [chRaw] = parseAimCode(ch.code);
		chapterCodeToSlug.set(pad2(chRaw), slugify(ch.title));
	}

	const sectionKeyToSlug = new Map<string, string>();
	for (const sec of sections) {
		const [chRaw, secRaw] = parseAimCode(sec.code);
		sectionKeyToSlug.set(`${pad2(chRaw)}/${pad2(secRaw)}`, slugify(sec.title));
	}

	const paragraphSlugByKey = new Map<string, string>();
	for (const p of paragraphs) {
		const [chRaw, secRaw, pRaw] = parseAimCode(p.code);
		paragraphSlugByKey.set(`${pad2(chRaw)}/${pad2(secRaw)}/${pad2(pRaw)}`, slugify(p.title));
	}

	for (const ch of chapters) {
		const [chRaw] = parseAimCode(ch.code);
		const code = pad2(chRaw);
		const slug = chapterCodeToSlug.get(code) ?? 'section';
		const oldDir = join('aim', manifest.edition, `chapter-${chRaw}`);
		const newDir = join('aim', manifest.edition, `${code}-${slug}`);
		if (existsSync(resolve(REPO_ROOT, oldDir))) {
			gitMv(oldDir, newDir);
			moves.push({ from: oldDir, to: newDir });
		}
	}

	for (const sec of sections) {
		const [chRaw, secRaw] = parseAimCode(sec.code);
		const chCode = pad2(chRaw);
		const secCode = pad2(secRaw);
		const chSlug = chapterCodeToSlug.get(chCode) ?? 'section';
		const secSlug = sectionKeyToSlug.get(`${chCode}/${secCode}`) ?? 'section';
		const oldSecDir = join('aim', manifest.edition, `${chCode}-${chSlug}`, `section-${secRaw}`);
		const newSecDir = join('aim', manifest.edition, `${chCode}-${chSlug}`, `${secCode}-${secSlug}`);
		if (existsSync(resolve(REPO_ROOT, oldSecDir))) {
			gitMv(oldSecDir, newSecDir);
			moves.push({ from: oldSecDir, to: newSecDir });
		}
	}

	for (const ch of chapters) {
		const [chRaw] = parseAimCode(ch.code);
		const code = pad2(chRaw);
		const slug = chapterCodeToSlug.get(code) ?? 'section';
		const oldOverview = join('aim', manifest.edition, `${code}-${slug}`, 'index.md');
		const newOverview = join('aim', manifest.edition, `${code}-${slug}`, `00-${slug}.md`);
		if (existsSync(resolve(REPO_ROOT, oldOverview))) {
			gitMv(oldOverview, newOverview);
			moves.push({ from: oldOverview, to: newOverview });
		}
	}

	for (const sec of sections) {
		const [chRaw, secRaw] = parseAimCode(sec.code);
		const chCode = pad2(chRaw);
		const secCode = pad2(secRaw);
		const chSlug = chapterCodeToSlug.get(chCode) ?? 'section';
		const secSlug = sectionKeyToSlug.get(`${chCode}/${secCode}`) ?? 'section';
		const oldOverview = join('aim', manifest.edition, `${chCode}-${chSlug}`, `${secCode}-${secSlug}`, 'index.md');
		const newOverview = join('aim', manifest.edition, `${chCode}-${chSlug}`, `${secCode}-${secSlug}`, `00-${secSlug}.md`);
		if (existsSync(resolve(REPO_ROOT, oldOverview))) {
			gitMv(oldOverview, newOverview);
			moves.push({ from: oldOverview, to: newOverview });
		}
	}

	for (const p of paragraphs) {
		const [chRaw, secRaw, pRaw] = parseAimCode(p.code);
		const chCode = pad2(chRaw);
		const secCode = pad2(secRaw);
		const pCode = pad2(pRaw);
		const chSlug = chapterCodeToSlug.get(chCode) ?? 'section';
		const secSlug = sectionKeyToSlug.get(`${chCode}/${secCode}`) ?? 'section';
		const pSlug = paragraphSlugByKey.get(`${chCode}/${secCode}/${pCode}`) ?? 'section';
		const oldPath = join('aim', manifest.edition, `${chCode}-${chSlug}`, `${secCode}-${secSlug}`, `paragraph-${pRaw}.md`);
		const newPath = join('aim', manifest.edition, `${chCode}-${chSlug}`, `${secCode}-${secSlug}`, `${pCode}-${pSlug}.md`);
		if (existsSync(resolve(REPO_ROOT, oldPath))) {
			gitMv(oldPath, newPath);
			moves.push({ from: oldPath, to: newPath });
		}
	}

	for (const ch of chapters) {
		const [chRaw] = parseAimCode(ch.code);
		const code = pad2(chRaw);
		const slug = chapterCodeToSlug.get(code) ?? 'section';
		pathMap.set(`aim/${manifest.edition}/chapter-${chRaw}/`, `aim/${manifest.edition}/${code}-${slug}/`);
	}
	for (const sec of sections) {
		const [chRaw, secRaw] = parseAimCode(sec.code);
		const chCode = pad2(chRaw);
		const secCode = pad2(secRaw);
		const chSlug = chapterCodeToSlug.get(chCode) ?? 'section';
		const secSlug = sectionKeyToSlug.get(`${chCode}/${secCode}`) ?? 'section';
		pathMap.set(`/${chCode}-${chSlug}/section-${secRaw}/`, `/${chCode}-${chSlug}/${secCode}-${secSlug}/`);
	}
	for (const ch of chapters) {
		const [chRaw] = parseAimCode(ch.code);
		const code = pad2(chRaw);
		const slug = chapterCodeToSlug.get(code) ?? 'section';
		pathMap.set(`/${code}-${slug}/index.md`, `/${code}-${slug}/00-${slug}.md`);
	}
	for (const sec of sections) {
		const [chRaw, secRaw] = parseAimCode(sec.code);
		const secCode = pad2(secRaw);
		const secSlug = sectionKeyToSlug.get(`${pad2(chRaw)}/${secCode}`) ?? 'section';
		pathMap.set(`/${secCode}-${secSlug}/index.md`, `/${secCode}-${secSlug}/00-${secSlug}.md`);
	}
	for (const p of paragraphs) {
		const [chRaw, secRaw, pRaw] = parseAimCode(p.code);
		const chCode = pad2(chRaw);
		const secCode = pad2(secRaw);
		const pCode = pad2(pRaw);
		const secSlug = sectionKeyToSlug.get(`${chCode}/${secCode}`) ?? 'section';
		const pSlug = paragraphSlugByKey.get(`${chCode}/${secCode}/${pCode}`) ?? 'section';
		pathMap.set(`/${secCode}-${secSlug}/paragraph-${pRaw}.md`, `/${secCode}-${secSlug}/${pCode}-${pSlug}.md`);
	}

	rewriteManifestBodyPaths(manifestPath, pathMap);
	return moves;
}

// -----------------------------------------------------------------------------
// Whole-doc handbooks
// -----------------------------------------------------------------------------

interface WholeDocManifest {
	document_slug: string;
	edition: string;
	body_path: string;
}

function migrateWholeDocHandbook(manifestPath: string): Move[] {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as WholeDocManifest;
	const moves: Move[] = [];
	const dir = dirname(manifestPath);
	const dirRel = relative(REPO_ROOT, dir);
	const oldBody = join(dirRel, 'document.md');
	const newName = `${manifest.document_slug}-${manifest.edition}.md`;
	const newBody = join(dirRel, newName);

	if (existsSync(resolve(REPO_ROOT, oldBody))) {
		gitMv(oldBody, newBody);
		moves.push({ from: oldBody, to: newBody });
		const pathMap = new Map([[`${dirRel}/document.md`, `${dirRel}/${newName}`]]);
		rewriteManifestBodyPaths(manifestPath, pathMap);
	}
	return moves;
}

// -----------------------------------------------------------------------------
// AC corpus
// -----------------------------------------------------------------------------

interface AcManifest {
	doc_slug: string;
	revision: string;
	body_path: string;
}

function migrateAc(manifestPath: string): Move[] {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AcManifest;
	const moves: Move[] = [];
	const dir = dirname(manifestPath);
	const dirRel = relative(REPO_ROOT, dir);
	const oldBody = join(dirRel, 'document.md');
	const newName = `ac-${manifest.doc_slug}-${manifest.revision}.md`;
	const newBody = join(dirRel, newName);

	if (existsSync(resolve(REPO_ROOT, oldBody))) {
		gitMv(oldBody, newBody);
		moves.push({ from: oldBody, to: newBody });
		const pathMap = new Map([[`${dirRel}/document.md`, `${dirRel}/${newName}`]]);
		rewriteManifestBodyPaths(manifestPath, pathMap);
	}
	return moves;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

function main(): void {
	const allMoves: Move[] = [];

	// Chapter-aware handbooks
	for (const slug of ['phak', 'afh', 'avwx']) {
		const dir = join(REPO_ROOT, 'handbooks', slug);
		if (!existsSync(dir)) continue;
		const editions = execSync(`ls ${dir}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
		for (const edition of editions) {
			const manifestPath = join(dir, edition, 'manifest.json');
			if (!existsSync(manifestPath)) continue;
			console.log(`migrating chapter-aware: ${slug}/${edition}`);
			const moves = migrateChapterAwareHandbook(manifestPath);
			allMoves.push(...moves);
			console.log(`  ${moves.length} moves`);
		}
	}

	// Whole-doc handbooks
	const wholeDocSlugs = execSync(`ls handbooks`, { encoding: 'utf-8', cwd: REPO_ROOT })
		.trim()
		.split('\n')
		.filter((s) => !['phak', 'afh', 'avwx'].includes(s));
	for (const slug of wholeDocSlugs) {
		const dir = join(REPO_ROOT, 'handbooks', slug);
		const editions = execSync(`ls ${dir}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
		for (const edition of editions) {
			const manifestPath = join(dir, edition, 'manifest.json');
			if (!existsSync(manifestPath)) continue;
			console.log(`migrating whole-doc: ${slug}/${edition}`);
			const moves = migrateWholeDocHandbook(manifestPath);
			allMoves.push(...moves);
			console.log(`  ${moves.length} moves`);
		}
	}

	// AIM
	const aimDir = join(REPO_ROOT, 'aim');
	if (existsSync(aimDir)) {
		const editions = execSync(`ls ${aimDir}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
		for (const edition of editions) {
			const manifestPath = join(aimDir, edition, 'manifest.json');
			if (!existsSync(manifestPath)) continue;
			console.log(`migrating aim: ${edition}`);
			const moves = migrateAim(manifestPath);
			allMoves.push(...moves);
			console.log(`  ${moves.length} moves`);
		}
	}

	// AC
	const acDir = join(REPO_ROOT, 'ac');
	if (existsSync(acDir)) {
		const docSlugs = execSync(`ls ${acDir}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
		for (const docSlug of docSlugs) {
			const docDir = join(acDir, docSlug);
			if (!existsSync(docDir)) continue;
			const revs = execSync(`ls ${docDir}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
			for (const rev of revs) {
				const manifestPath = join(docDir, rev, 'manifest.json');
				if (!existsSync(manifestPath)) continue;
				console.log(`migrating ac: ${docSlug}/${rev}`);
				const moves = migrateAc(manifestPath);
				allMoves.push(...moves);
				console.log(`  ${moves.length} moves`);
			}
		}
	}

	console.log(`\nTotal: ${allMoves.length} moves`);
}

main();
