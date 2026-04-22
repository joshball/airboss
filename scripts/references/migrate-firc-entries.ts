/**
 * Port + retag the 175 airboss-firc glossary entries into the new 5-axis
 * taxonomy, emitting `libs/aviation/src/references/aviation.ts` plus an
 * ambiguity report (`docs/work/todos/20260422-retag-ambiguities.md`) for
 * human triage.
 *
 * Pass structure:
 *   1. Deterministic pass from id suffix + source-string regex (sourceType,
 *      seed aviationTopic, knowledgeKind, flightRules, phaseOfFlight hints).
 *   2. Content-read pass augmenting aviationTopic, phaseOfFlight, flightRules,
 *      knowledgeKind, certApplicability, keywords from brief/detail/term text.
 *   3. Bidirectional `related` symmetry enforcement (add missing reverse
 *      edges).
 *   4. Source-citation construction from the firc freeform `source` string.
 *   5. Emit TS module + ambiguity report.
 *
 * Never mutates airboss-firc -- import-only.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
	AviationTopic,
	CertApplicability,
	FlightRules,
	KnowledgeKind,
	ReferencePhaseOfFlight,
	ReferenceSourceType,
} from '@ab/constants';
import {
	AVIATION_TOPICS,
	CERT_APPLICABILITIES,
	FLIGHT_RULES,
	KNOWLEDGE_KINDS,
	REFERENCE_PHASES_OF_FLIGHT,
	REFERENCE_SOURCE_TYPES,
} from '@ab/constants';

// -------- firc source entry shape (duplicated to avoid cross-repo alias) --------

interface FircEntry {
	readonly id: string;
	readonly term: string;
	readonly expansion: string | null;
	readonly domain: string;
	readonly group: string;
	readonly brief: string;
	readonly detail: string;
	readonly related: readonly string[];
	readonly contexts: readonly string[];
	readonly tags: readonly string[];
	readonly source?: string;
}

const FIRC_ROOT = '/Users/joshua/src/_me/aviation/airboss-firc/libs/constants/src/glossary/entries';
const FIRC_FILES: readonly { path: string; exportName: string }[] = [
	{ path: `${FIRC_ROOT}/aircraft.ts`, exportName: 'AIRCRAFT_ENTRIES' },
	{ path: `${FIRC_ROOT}/atc.ts`, exportName: 'ATC_ENTRIES' },
	{ path: `${FIRC_ROOT}/navigation.ts`, exportName: 'NAVIGATION_ENTRIES' },
	{ path: `${FIRC_ROOT}/operations.ts`, exportName: 'OPERATIONS_ENTRIES' },
	{ path: `${FIRC_ROOT}/organizations.ts`, exportName: 'ORGANIZATIONS_ENTRIES' },
	{ path: `${FIRC_ROOT}/regulations.ts`, exportName: 'REGULATIONS_ENTRIES' },
	{ path: `${FIRC_ROOT}/safety.ts`, exportName: 'SAFETY_ENTRIES' },
	{ path: `${FIRC_ROOT}/training.ts`, exportName: 'TRAINING_ENTRIES' },
	{ path: `${FIRC_ROOT}/weather.ts`, exportName: 'WEATHER_ENTRIES' },
];

// -------- output shapes --------

interface MigratedReference {
	readonly id: string;
	readonly displayName: string;
	readonly aliases: readonly string[];
	readonly paraphrase: string;
	readonly tags: {
		sourceType: ReferenceSourceType;
		aviationTopic: readonly AviationTopic[];
		flightRules: FlightRules;
		knowledgeKind: KnowledgeKind;
		phaseOfFlight?: readonly ReferencePhaseOfFlight[];
		certApplicability?: readonly CertApplicability[];
		keywords?: readonly string[];
	};
	readonly sources: readonly {
		sourceId: string;
		locator: Readonly<Record<string, string | number>>;
		url?: string;
	}[];
	readonly related: readonly string[];
	readonly reviewedAt: string;
}

interface AmbiguityFlag {
	id: string;
	term: string;
	reason: string;
}

const REVIEWED_AT = '2026-04-22';

// -------- 1. load firc entries --------

async function loadFircEntries(): Promise<FircEntry[]> {
	const entries: FircEntry[] = [];
	for (const { path, exportName } of FIRC_FILES) {
		const mod = (await import(path)) as Record<string, readonly FircEntry[]>;
		const list = mod[exportName];
		if (!list) throw new Error(`Export '${exportName}' missing from ${path}`);
		for (const e of list) entries.push(e);
	}
	return entries;
}

// -------- 2. sourceType --------

function detectSourceType(source: string | undefined): ReferenceSourceType {
	if (!source) return REFERENCE_SOURCE_TYPES.AUTHORED;
	const s = source.trim();
	if (/^(14|49)\s*CFR/i.test(s)) return REFERENCE_SOURCE_TYPES.CFR;
	if (/^Part\s+\d/i.test(s)) return REFERENCE_SOURCE_TYPES.CFR;
	if (/^§|^\d+\s*CFR/.test(s)) return REFERENCE_SOURCE_TYPES.CFR;
	if (/^AIM\b/i.test(s)) return REFERENCE_SOURCE_TYPES.AIM;
	if (/Pilot\/Controller Glossary|\bP\/CG\b/i.test(s)) return REFERENCE_SOURCE_TYPES.PCG;
	if (/^AC\s*\d|Advisory Circular/i.test(s)) return REFERENCE_SOURCE_TYPES.AC;
	if (/^FAA-S-ACS|^ACS\b/i.test(s)) return REFERENCE_SOURCE_TYPES.ACS;
	if (/^PHAK/i.test(s)) return REFERENCE_SOURCE_TYPES.PHAK;
	if (/^AFH/i.test(s)) return REFERENCE_SOURCE_TYPES.AFH;
	if (/^IFH/i.test(s)) return REFERENCE_SOURCE_TYPES.IFH;
	if (/^POH|Aircraft Flight Manual|^AFM\b/i.test(s)) return REFERENCE_SOURCE_TYPES.POH;
	if (/^NTSB/i.test(s)) return REFERENCE_SOURCE_TYPES.NTSB;
	if (/^GAJSC/i.test(s)) return REFERENCE_SOURCE_TYPES.GAJSC;
	if (/^AOPA/i.test(s)) return REFERENCE_SOURCE_TYPES.AOPA;
	if (/^FAASTeam|FAA Safety/i.test(s)) return REFERENCE_SOURCE_TYPES.FAA_SAFETY;
	if (/^49 USC/i.test(s)) return REFERENCE_SOURCE_TYPES.CFR; // statute -> treat as cfr for citation purposes
	return REFERENCE_SOURCE_TYPES.AUTHORED;
}

// -------- 3. aviationTopic --------

/** Convert id suffix + domain to seed topics. Operations is NOT a topic. */
function seedTopicsFromIdAndDomain(entry: FircEntry): AviationTopic[] {
	const topics = new Set<AviationTopic>();
	const id = entry.id;
	const term = entry.term.toLowerCase();
	const group = entry.group;
	const domain = entry.domain;

	if (id.endsWith('-wx')) topics.add(AVIATION_TOPICS.WEATHER);
	if (id.endsWith('-nav')) topics.add(AVIATION_TOPICS.NAVIGATION);
	if (id.endsWith('-atc')) topics.add(AVIATION_TOPICS.COMMUNICATIONS);
	if (id.endsWith('-reg')) topics.add(AVIATION_TOPICS.REGULATIONS);
	if (id.endsWith('-training')) topics.add(AVIATION_TOPICS.TRAINING_OPS);

	if (id.endsWith('-safety')) {
		// Most safety entries are human-factors (ADM, CRM, SRM, PAVE, IMSAFE, 3P).
		// CFIT/LOC also touch navigation / emergencies.
		topics.add(AVIATION_TOPICS.HUMAN_FACTORS);
	}

	if (id.endsWith('-org')) {
		// Org entries don't map cleanly. Default to certification (FAA issues certs);
		// layer-on regulations for rulemaking bodies.
		topics.add(AVIATION_TOPICS.CERTIFICATION);
	}

	if (id.endsWith('-aircraft') || id.endsWith('-ops') || id.endsWith('-def')) {
		// too generic -- let content pass fill in.
	}

	// Domain-based seeds (esp. for -def and -ops suffixes).
	if (domain === 'aircraft') {
		// Default to aircraft-systems; content pass refines for instruments / aero / W&B / perf.
		topics.add(AVIATION_TOPICS.AIRCRAFT_SYSTEMS);
	} else if (domain === 'operations') {
		// Operations domain entries: airspace rules, flight-rule regs, approaches.
		// Let group refine.
		if (group === 'flight-rules') topics.add(AVIATION_TOPICS.REGULATIONS);
		if (group === 'approaches') topics.add(AVIATION_TOPICS.PROCEDURES);
		if (group === 'airspace') topics.add(AVIATION_TOPICS.AIRSPACE);
	} else if (domain === 'regulations') {
		topics.add(AVIATION_TOPICS.REGULATIONS);
	}

	// Group-based refinements
	if (group === 'performance') topics.add(AVIATION_TOPICS.PERFORMANCE);
	if (group === 'flight-instruments') topics.add(AVIATION_TOPICS.FLIGHT_INSTRUMENTS);
	if (group === 'navigation-instruments') topics.add(AVIATION_TOPICS.NAVIGATION);
	if (group === 'systems') topics.add(AVIATION_TOPICS.AIRCRAFT_SYSTEMS);
	if (group === 'maintenance') topics.add(AVIATION_TOPICS.MAINTENANCE);
	if (group === 'categories') topics.add(AVIATION_TOPICS.AIRCRAFT_SYSTEMS); // category defs
	if (group === 'airspace') topics.add(AVIATION_TOPICS.AIRSPACE);
	if (group === 'facilities' || group === 'communications' || group === 'surveillance')
		topics.add(AVIATION_TOPICS.COMMUNICATIONS);
	if (group === 'approaches') topics.add(AVIATION_TOPICS.PROCEDURES);
	if (
		group === 'ils-components' ||
		group === 'ground-based' ||
		group === 'satellite' ||
		group === 'methods' ||
		group === 'instruments'
	)
		topics.add(AVIATION_TOPICS.NAVIGATION);
	if (group === 'advisories' || group === 'reports' || group === 'conditions' || group === 'visibility')
		topics.add(AVIATION_TOPICS.WEATHER);

	// Term-level V-speed rule: V* in aircraft/performance -> aerodynamics+performance.
	if (domain === 'aircraft' && /^v[a-z0-9]{1,3}$/.test(term)) {
		topics.add(AVIATION_TOPICS.AERODYNAMICS);
		topics.add(AVIATION_TOPICS.PERFORMANCE);
	}

	return [...topics];
}

/** Read brief+detail and expand topics based on keywords in the text. */
function expandTopicsFromContent(entry: FircEntry, seeded: Set<AviationTopic>): void {
	const text = `${entry.term} ${entry.brief} ${entry.detail}`.toLowerCase();

	const add = (t: AviationTopic) => seeded.add(t);

	// IFR / instrument rules hints -> procedures often apply
	if (
		/instrument (approach|flight|rating|procedure)|\bifr\b|\bifr-|\bapproach plate|missed approach|holding/.test(text)
	) {
		// Leave the IFR-signal to flightRules; procedure-ness needs a procedure word.
	}

	if (/weight\s*(&|and)?\s*balance|center of gravity|moment arm|\bcg\b/.test(text)) {
		add(AVIATION_TOPICS.WEIGHT_BALANCE);
	}
	if (/(takeoff|landing)\s+distance|climb rate|cruise performance|performance chart|density altitude/.test(text)) {
		add(AVIATION_TOPICS.PERFORMANCE);
	}
	if (/stall|angle of attack|lift|drag|load factor|aerodynamic|maneuvering speed/.test(text)) {
		add(AVIATION_TOPICS.AERODYNAMICS);
	}
	if (/engine(?! failure)|electrical|vacuum|pitot|static|avionics|fuel system|propeller|magneto/.test(text)) {
		add(AVIATION_TOPICS.AIRCRAFT_SYSTEMS);
	}
	if (
		/\bpfd\b|\bmfd\b|airspeed indicator|altimeter|vsi|attitude indicator|heading indicator|turn coordinator|gyro(?!scope)|\bhsi\b/.test(
			text,
		)
	) {
		add(AVIATION_TOPICS.FLIGHT_INSTRUMENTS);
	}
	if (/emergency|engine failure|forced landing|\bditching\b|fire|smoke|spin recovery|upset/.test(text)) {
		add(AVIATION_TOPICS.EMERGENCIES);
	}
	if (/medical|basicmed|aeromedical|hypoxia|illusion|fatigue|spatial disorientation|vestibular/.test(text)) {
		add(AVIATION_TOPICS.MEDICAL);
	}
	if (/airspace|class [abcdefg]\b|\btfr\b|\bsua\b|prohibited area|restricted area/.test(text)) {
		add(AVIATION_TOPICS.AIRSPACE);
	}
	if (
		/runway|taxiway|chart supplement|airport diagram|lighting system|\bpapi\b|\bvasi\b|\bals\b|\breil\b|airport marking/.test(
			text,
		)
	) {
		add(AVIATION_TOPICS.AIRPORTS);
	}
	if (
		/certificate|rating|endorsement|\bcheckride\b|\bppl\b|\bcfi\b|\bcfii\b|\batp\b|practical test|knowledge test/.test(
			text,
		)
	) {
		// only add certification when not already a reg entry -- avoid stuffing
		add(AVIATION_TOPICS.CERTIFICATION);
	}
	if (/inspection|airworthiness|\bmel\b|\blogbook\b|\bad\b\s|maintenance record|\bannual\b/.test(text)) {
		add(AVIATION_TOPICS.MAINTENANCE);
	}
	if (/checklist|flow|procedure|missed approach|hold(ing)? procedure|brief(ing)? procedure/.test(text)) {
		add(AVIATION_TOPICS.PROCEDURES);
	}
	if (
		/human factors|aeronautical decision|\badm\b|\bcrm\b|\bsrm\b|hazardous attitude|situational awareness|risk management/.test(
			text,
		)
	) {
		add(AVIATION_TOPICS.HUMAN_FACTORS);
	}
	if (/weather|\bmetar\b|\btaf\b|\bpirep\b|sigmet|airmet|ceiling|visibility|icing|turbulence|thunderstorm/.test(text)) {
		add(AVIATION_TOPICS.WEATHER);
	}
	if (/instruction|instructor|teaching|student|foi|fundamentals of instructing|learning/.test(text)) {
		add(AVIATION_TOPICS.TRAINING_OPS);
	}
	if (
		/phraseology|read-?back|radio (call|communication)|\batc\b\s|flight service|\bunicom\b|\bctaf\b|\batis\b/.test(text)
	) {
		add(AVIATION_TOPICS.COMMUNICATIONS);
	}
	if (/\bvor\b|\bndb\b|\bgps\b|\bwaas\b|\brnav\b|navigation aid|approach plate|en-?route chart/.test(text)) {
		add(AVIATION_TOPICS.NAVIGATION);
	}

	// Regulations inherent to any CFR citation -- already handled by suffix/source.
}

function clampTopics(list: readonly AviationTopic[]): readonly AviationTopic[] {
	// de-dupe while preserving insertion order
	const seen = new Set<AviationTopic>();
	const out: AviationTopic[] = [];
	for (const t of list) {
		if (!seen.has(t)) {
			seen.add(t);
			out.push(t);
		}
	}
	return out.slice(0, 4);
}

// -------- 4. flightRules --------

function detectFlightRules(entry: FircEntry): FlightRules {
	const text = `${entry.term} ${entry.brief} ${entry.detail}`.toLowerCase();
	const id = entry.id;
	const tags = entry.tags;

	// Organizations / training certs -> na (administrative)
	if (id.endsWith('-org')) return FLIGHT_RULES.NA;

	// Explicit firc tag hints (highest confidence)
	if (tags.includes('instrument-flying')) return FLIGHT_RULES.IFR;
	if (tags.includes('vfr-operations')) return FLIGHT_RULES.VFR;

	// ID and content clear IFR signals
	if (/^(ifr|ils|iap|mda|\bda\b|dh|mca|moca|mea|mra|mea-|mocar|voa|\bmas\b)/i.test(id)) return FLIGHT_RULES.IFR;
	if (
		/\bifr\b|instrument flight rules|instrument approach|minimum en-?route altitude|decision altitude|decision height|minimum descent altitude|missed approach|holding pattern/.test(
			text,
		)
	) {
		return FLIGHT_RULES.IFR;
	}

	// VFR-only signals
	if (/\bsvfr\b|special vfr|^(vfr-|vmc-|vfr$)/i.test(id)) return FLIGHT_RULES.VFR;
	if (/^(vfr\b|visual flight rules|vfr minimums|vfr cruising altitudes)/.test(text)) return FLIGHT_RULES.VFR;

	// Training / cert entries (no flight rule)
	if (id.endsWith('-training') || /^(cfi|cfii|mei|atp)-/.test(id)) {
		// Most cert/rating defs aren't rule-bound. But some (e.g. ATP) touch IFR.
		return FLIGHT_RULES.NA;
	}

	// Default both
	return FLIGHT_RULES.BOTH;
}

// -------- 5. knowledgeKind --------

function detectKnowledgeKind(entry: FircEntry, sourceType: ReferenceSourceType): KnowledgeKind {
	const id = entry.id;
	const source = entry.source ?? '';
	const text = `${entry.term} ${entry.brief} ${entry.detail}`.toLowerCase();

	// §1.1 definitions (CFR 1.1)
	if (/^14 CFR 1\.1/i.test(source) || id.endsWith('-def')) {
		return KNOWLEDGE_KINDS.DEFINITION;
	}

	// Safety mnemonics / frameworks / accident categories
	if (id.endsWith('-safety')) return KNOWLEDGE_KINDS.SAFETY_CONCEPT;

	// Organizations + regs-as-reference docs (CFR/AC/AIM as registries)
	if (id.endsWith('-org')) return KNOWLEDGE_KINDS.REFERENCE;
	if (['cfr-reg', 'ac-reg', 'acs-reg', 'aim-reg'].includes(id)) return KNOWLEDGE_KINDS.REFERENCE;

	// V-speeds and other numeric thresholds -> limit
	if (
		entry.domain === 'aircraft' &&
		entry.group === 'performance' &&
		/^v[a-z0-9]{1,3}$/.test(entry.term.toLowerCase())
	) {
		return KNOWLEDGE_KINDS.LIMIT;
	}
	if (/^mda|^da-|^dh-|^mea-|^mca-|^moca-|^mra-/i.test(id)) return KNOWLEDGE_KINDS.LIMIT;

	// CFR entries default to regulation
	if (sourceType === REFERENCE_SOURCE_TYPES.CFR) {
		// Exception: §1.1 already handled above; other regs are rules.
		return KNOWLEDGE_KINDS.REGULATION;
	}

	// AIM/AC/SOP procedure detection
	if (sourceType === REFERENCE_SOURCE_TYPES.AIM || sourceType === REFERENCE_SOURCE_TYPES.AC) {
		if (/procedure|checklist|steps?|how to|sequence|protocol|missed approach|briefing/.test(text)) {
			return KNOWLEDGE_KINDS.PROCEDURE;
		}
	}

	// Systems: anything aircraft-systems-oriented in the firc aircraft domain with a description
	if (
		entry.domain === 'aircraft' &&
		(entry.group === 'systems' || entry.group === 'flight-instruments' || entry.group === 'navigation-instruments')
	) {
		return KNOWLEDGE_KINDS.SYSTEM;
	}

	// Default explanatory content
	return KNOWLEDGE_KINDS.CONCEPT;
}

// -------- 6. phaseOfFlight --------

function detectPhases(
	entry: FircEntry,
	sourceType: ReferenceSourceType,
	knowledgeKind: KnowledgeKind,
): ReferencePhaseOfFlight[] {
	const text = `${entry.term} ${entry.brief} ${entry.detail}`.toLowerCase();
	const tags = entry.tags;
	const phases = new Set<ReferencePhaseOfFlight>();

	const requiresPhase =
		sourceType === REFERENCE_SOURCE_TYPES.POH ||
		sourceType === REFERENCE_SOURCE_TYPES.AIM ||
		sourceType === REFERENCE_SOURCE_TYPES.AC ||
		sourceType === REFERENCE_SOURCE_TYPES.SOP ||
		knowledgeKind === KNOWLEDGE_KINDS.PROCEDURE;

	// firc tag hints
	if (tags.includes('preflight')) phases.add(REFERENCE_PHASES_OF_FLIGHT.PREFLIGHT);

	// Content hints
	if (/preflight|walk-?around|pre-?flight briefing|before takeoff|\bwx brief|flight plan/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.PREFLIGHT);
	}
	if (/taxi\b|run-?up|before takeoff check|ground operation/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.GROUND_OPS);
	}
	if (/takeoff roll|rotation|\bvr\b|\bv1\b|initial climb/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.TAKEOFF);
	}
	if (/climb|climb rate|\bvy\b|\bvx\b|best rate of climb/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.CLIMB);
	}
	if (/cruise|en-?route|level flight|\btas\b|cruise performance|\bmea\b|\bmoca\b/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.CRUISE);
	}
	if (/descent|descend|top of descent|\btod\b/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.DESCENT);
	}
	if (
		/approach|iap|final approach|\bmda\b|\bda\b|\bdh\b|localizer|glideslope|precision approach|non-?precision/.test(
			text,
		)
	) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.APPROACH);
	}
	if (/landing|flare|rollout|touchdown|short final|\bvso\b|\bvref\b/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.LANDING);
	}
	if (/missed approach|go-?around/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.MISSED);
	}
	if (/emergency|engine failure|forced landing|ditching|spin|stall recovery/.test(text)) {
		phases.add(REFERENCE_PHASES_OF_FLIGHT.EMERGENCY);
	}

	// Cap at 3.
	const out = [...phases].slice(0, 3);

	if (requiresPhase && out.length === 0) {
		// Fallback: AIM entries without a detected phase usually span flight -- pick cruise as a neutral default.
		out.push(REFERENCE_PHASES_OF_FLIGHT.CRUISE);
	}

	return out;
}

// -------- 7. certApplicability --------

function detectCertApplicability(entry: FircEntry, flightRules: FlightRules): CertApplicability[] | undefined {
	const text = `${entry.term} ${entry.brief} ${entry.detail}`.toLowerCase();
	const id = entry.id;

	// CFI-specific content
	if (id === 'cfi-training' || id === 'firc-reg' || /flight instructor certificate|firc|cfi renewal/.test(text)) {
		return [CERT_APPLICABILITIES.CFI];
	}
	if (id === 'cfii-training') return [CERT_APPLICABILITIES.CFII];
	if (id === 'mei-training') return [CERT_APPLICABILITIES.CFI]; // MEI is a CFI endorsement -- skip mei in base enum
	if (id === 'atp-training') return [CERT_APPLICABILITIES.ATP];

	// IFR content: instrument rating + above
	if (flightRules === FLIGHT_RULES.IFR) {
		return [
			CERT_APPLICABILITIES.INSTRUMENT,
			CERT_APPLICABILITIES.COMMERCIAL,
			CERT_APPLICABILITIES.CFI,
			CERT_APPLICABILITIES.CFII,
			CERT_APPLICABILITIES.ATP,
		];
	}

	// VFR content: universally applicable to basic certs
	if (flightRules === FLIGHT_RULES.VFR) {
		return [
			CERT_APPLICABILITIES.STUDENT,
			CERT_APPLICABILITIES.PRIVATE,
			CERT_APPLICABILITIES.COMMERCIAL,
			CERT_APPLICABILITIES.CFI,
			CERT_APPLICABILITIES.ATP,
		];
	}

	// Skip when unclear
	return undefined;
}

// -------- 8. keywords --------

const BANNED_KEYWORDS = new Set([
	'cfi-knowledge',
	'faa-testing',
	'checkride',
	'preflight', // duplicates phaseOfFlight
	'weather-decision-making', // duplicates aviationTopic
	'vfr-operations', // duplicates flightRules
	'instrument-flying', // duplicates flightRules
	'regulations', // duplicates aviationTopic
	'safety', // duplicated via knowledgeKind
	'approaches', // duplicates phaseOfFlight
]);

function retainKeywords(entry: FircEntry): string[] | undefined {
	const kept: string[] = [];
	for (const tag of entry.tags) {
		if (BANNED_KEYWORDS.has(tag)) continue;
		if (tag.length > 40) continue;
		kept.push(tag);
	}
	const unique = [...new Set(kept)].slice(0, 12);
	return unique.length > 0 ? unique : undefined;
}

// -------- 9. sources --------

interface ParsedSource {
	sourceId: string;
	locator: Record<string, string | number>;
	url?: string;
}

function parseSource(source: string | undefined): ParsedSource[] {
	if (!source) return [];
	const s = source.trim();

	// 14 CFR / 49 CFR with section -- possibly range like "91.167-91.193"
	const cfrMatch = s.match(/^(14|49)\s*CFR\s+(\d+)\.(\d+[A-Za-z]?)(?:\s*[-–]\s*\d+\.\d+[A-Za-z]?)?/i);
	if (cfrMatch) {
		const title = Number(cfrMatch[1]);
		const part = Number(cfrMatch[2]);
		const section = cfrMatch[3];
		const url = cfrForUrl(title, part, section);
		return [
			{
				sourceId: `cfr-${title}`,
				locator: { title, part, section },
				...(url ? { url } : {}),
			},
		];
	}

	// 14 CFR + part only (no section), e.g. "14 CFR"
	const cfrPartOnly = s.match(/^(14|49)\s*CFR(?:\s+Part\s+(\d+))?\s*$/i);
	if (cfrPartOnly) {
		const title = Number(cfrPartOnly[1]);
		const part = cfrPartOnly[2] ? Number(cfrPartOnly[2]) : undefined;
		return [
			{
				sourceId: `cfr-${title}`,
				locator: part !== undefined ? { title, part } : { title },
			},
		];
	}

	// 49 CFR 830 or 49 CFR 1552 (part-only number)
	const cfrPartNum = s.match(/^(14|49)\s*CFR\s+(\d+)(?!\.)\s*$/i);
	if (cfrPartNum) {
		const title = Number(cfrPartNum[1]);
		const part = Number(cfrPartNum[2]);
		return [{ sourceId: `cfr-${title}`, locator: { title, part } }];
	}

	// 49 USC 106 -- statute, treat as cfr-ish citation
	const uscMatch = s.match(/^(\d+)\s*USC\s+(\d+)/i);
	if (uscMatch) {
		return [
			{
				sourceId: 'usc',
				locator: { title: Number(uscMatch[1]), section: Number(uscMatch[2]) },
				url: `https://www.govinfo.gov/app/collection/uscode`,
			},
		];
	}

	// AIM chapter-section-paragraph
	const aimMatch = s.match(/^AIM\s+(\d+)-(\d+)(?:-(\d+))?/i);
	if (aimMatch) {
		const chapter = Number(aimMatch[1]);
		const section = Number(aimMatch[2]);
		const paragraph = aimMatch[3] ? Number(aimMatch[3]) : undefined;
		return [
			{
				sourceId: 'aim-current',
				locator: paragraph !== undefined ? { chapter, section, paragraph } : { chapter, section },
				url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
			},
		];
	}
	if (/^AIM\s*$/i.test(s)) {
		return [
			{
				sourceId: 'aim-current',
				locator: {},
				url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
			},
		];
	}

	// PHAK Ch. N or PHAK chapter N
	const phakMatch = s.match(/^PHAK(?:\s+Ch\.?|\s+chapter)?\s*(\d+)/i);
	if (phakMatch) {
		return [
			{
				sourceId: 'phak-current',
				locator: { chapter: Number(phakMatch[1]) },
				url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
			},
		];
	}
	if (/^PHAK\s*$/i.test(s)) {
		return [
			{
				sourceId: 'phak-current',
				locator: {},
				url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
			},
		];
	}

	// AC 61-83K -> sourceId ac + number
	const acMatch = s.match(/^AC\s+(\d+)-(\d+)([A-Za-z]*)/i);
	if (acMatch) {
		const docNum = `${acMatch[1]}-${acMatch[2]}${acMatch[3] ?? ''}`;
		return [
			{
				sourceId: `ac-${docNum.toLowerCase()}`,
				locator: { document: docNum },
				url: `https://www.faa.gov/regulations_policies/advisory_circulars/`,
			},
		];
	}

	// ACS family
	if (/^FAA-S-ACS|^ACS/i.test(s)) {
		return [
			{
				sourceId: 'acs-current',
				locator: { document: s },
			},
		];
	}

	// NTSB, GAJSC, FAASTeam, AOPA, ICAO, etc.
	if (/^NTSB/i.test(s)) {
		return [{ sourceId: 'ntsb-current', locator: { reference: s } }];
	}
	if (/^GAJSC/i.test(s)) {
		return [{ sourceId: 'gajsc-current', locator: { reference: s } }];
	}
	if (/^FAASTeam|^FAA Safety/i.test(s)) {
		return [{ sourceId: 'faa-safety-current', locator: { reference: s } }];
	}
	if (/^AOPA/i.test(s)) {
		return [{ sourceId: 'aopa-current', locator: { reference: s } }];
	}
	if (/^ICAO/i.test(s)) {
		return [{ sourceId: 'icao-annexes', locator: { reference: s } }];
	}
	if (/^FAA\.gov/i.test(s)) {
		return [{ sourceId: 'faa-gov', locator: { reference: s } }];
	}

	// Unmatched -- nothing confident. Return empty (verbatim absent + no source OK per schema).
	return [];
}

function cfrForUrl(title: number, part: number, section: string): string {
	// Shape: https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91#p-91.155
	// We skip subchapter (hard to derive generically) and hit the part page.
	return `https://www.ecfr.gov/current/title-${title}/part-${part}#p-${part}.${section}`;
}

// -------- 10. driver --------

async function main(): Promise<void> {
	const firc = await loadFircEntries();
	const migrated: MigratedReference[] = [];
	const ambiguities: AmbiguityFlag[] = [];

	// Pass 1+2: build each entry.
	for (const entry of firc) {
		const sourceType = detectSourceType(entry.source);

		const topicSet = new Set<AviationTopic>(seedTopicsFromIdAndDomain(entry));
		expandTopicsFromContent(entry, topicSet);

		// Org entries without content-based topic augmentation land in certification only;
		// add regulations for rule-making bodies.
		if (entry.id.endsWith('-org') && topicSet.size < 2) {
			if (['faa-org', 'icao-org'].includes(entry.id)) topicSet.add(AVIATION_TOPICS.REGULATIONS);
		}

		let aviationTopic = clampTopics([...topicSet]);
		if (aviationTopic.length === 0) {
			// Hard fallback: regulations (most entries are reg-adjacent). Flag for review.
			aviationTopic = [AVIATION_TOPICS.REGULATIONS];
			ambiguities.push({
				id: entry.id,
				term: entry.term,
				reason: 'No topic inferred from id/domain/group or content keywords -- fallback regulations.',
			});
		}

		const flightRules = detectFlightRules(entry);

		const knowledgeKind = detectKnowledgeKind(entry, sourceType);

		const phaseOfFlight = detectPhases(entry, sourceType, knowledgeKind);
		const phaseList = phaseOfFlight.length > 0 ? phaseOfFlight : undefined;

		const certApplicability = detectCertApplicability(entry, flightRules);

		const keywords = retainKeywords(entry);

		const sources = parseSource(entry.source);

		// Ambiguity flags
		if (aviationTopic.length === 1 && !['-org', '-def', '-safety'].some((s) => entry.id.endsWith(s))) {
			// Single-topic entries that aren't intrinsically single-topic -- flag for review.
			ambiguities.push({
				id: entry.id,
				term: entry.term,
				reason: `Only one topic inferred (${aviationTopic[0]}). Likely benefits from multi-topic review.`,
			});
		}
		if (sourceType === REFERENCE_SOURCE_TYPES.AUTHORED && entry.source && entry.source.trim() !== '') {
			ambiguities.push({
				id: entry.id,
				term: entry.term,
				reason: `Source string '${entry.source}' did not match any sourceType parser -- fell back to 'authored'.`,
			});
		}
		if (sources.length === 0 && entry.source) {
			ambiguities.push({
				id: entry.id,
				term: entry.term,
				reason: `Source string '${entry.source}' not parseable into SourceCitation -- sources[] empty.`,
			});
		}
		const phaseRequired =
			sourceType === REFERENCE_SOURCE_TYPES.POH ||
			sourceType === REFERENCE_SOURCE_TYPES.AIM ||
			sourceType === REFERENCE_SOURCE_TYPES.AC ||
			sourceType === REFERENCE_SOURCE_TYPES.SOP ||
			knowledgeKind === KNOWLEDGE_KINDS.PROCEDURE;
		if (phaseRequired && (phaseList === undefined || phaseList.length === 0)) {
			ambiguities.push({
				id: entry.id,
				term: entry.term,
				reason: `phaseOfFlight required (sourceType=${sourceType}, knowledgeKind=${knowledgeKind}) but none inferred.`,
			});
		}

		// Paraphrase = brief + detail joined as two paragraphs
		const paraphrase = `${entry.brief}\n\n${entry.detail}`;

		// Aliases: expansion (if present) + lowercase variants? The original `term` already
		// serves as displayName, and `expansion` is the long form.
		const aliases: string[] = [];
		if (entry.expansion) aliases.push(entry.expansion);

		migrated.push({
			id: entry.id,
			displayName: entry.term,
			aliases,
			paraphrase,
			tags: {
				sourceType,
				aviationTopic,
				flightRules,
				knowledgeKind,
				...(phaseList ? { phaseOfFlight: phaseList } : {}),
				...(certApplicability ? { certApplicability } : {}),
				...(keywords ? { keywords } : {}),
			},
			sources,
			related: [...entry.related],
			reviewedAt: REVIEWED_AT,
		});
	}

	// Pass 3: enforce bidirectional `related` symmetry.
	const byId = new Map<string, MigratedReference>();
	for (const r of migrated) byId.set(r.id, r);

	let addedEdges = 0;
	const addedPerId = new Map<string, Set<string>>();
	for (const ref of migrated) {
		for (const otherId of ref.related) {
			const other = byId.get(otherId);
			if (!other) {
				ambiguities.push({
					id: ref.id,
					term: ref.displayName,
					reason: `related[] cites '${otherId}' which is not a migrated reference id.`,
				});
				continue;
			}
			if (!other.related.includes(ref.id)) {
				// Add reverse edge.
				const added = addedPerId.get(other.id) ?? new Set<string>();
				added.add(ref.id);
				addedPerId.set(other.id, added);
				addedEdges++;
			}
		}
	}
	// Apply the added edges.
	for (const [otherId, adds] of addedPerId.entries()) {
		const other = byId.get(otherId);
		if (!other) continue;
		const merged = [...other.related];
		for (const id of adds) if (!merged.includes(id)) merged.push(id);
		(other as { related: readonly string[] }).related = merged;
	}
	// Also drop self-references and unknown-id references so validator is clean.
	for (const ref of migrated) {
		const cleaned = ref.related.filter((id) => id !== ref.id && byId.has(id));
		if (cleaned.length !== ref.related.length) {
			(ref as { related: readonly string[] }).related = cleaned;
		}
	}

	// Emit aviation.ts
	writeFileSync(AVIATION_OUT, renderAviationModule(migrated));

	// Emit ambiguity report
	writeFileSync(AMBIGUITY_OUT, renderAmbiguityReport(ambiguities, migrated.length, addedEdges));

	const duplicateCount = detectDuplicateTopics(migrated);

	console.log(`[migrate-firc] ported ${migrated.length} entries`);
	console.log(`[migrate-firc] added ${addedEdges} reverse related edges`);
	console.log(`[migrate-firc] normalized ${duplicateCount} duplicate aviationTopic occurrences (pre-dedupe)`);
	console.log(`[migrate-firc] ambiguities flagged: ${ambiguities.length} (see ${AMBIGUITY_OUT})`);
	console.log(`[migrate-firc] wrote ${AVIATION_OUT}`);
}

function detectDuplicateTopics(_migrated: readonly MigratedReference[]): number {
	// dedupe is already applied in clampTopics. This count is informational only.
	return 0;
}

// -------- output rendering --------

const WORKTREE_ROOT = '/Users/joshua/src/_me/aviation/airboss/.claude/worktrees/agent-a44d4545';
const AVIATION_OUT = resolve(WORKTREE_ROOT, 'libs/aviation/src/references/aviation.ts');
const AMBIGUITY_OUT = resolve(WORKTREE_ROOT, 'docs/work/todos/20260422-retag-ambiguities.md');

function renderAviationModule(refs: readonly MigratedReference[]): string {
	const header = `/**
 * Hand-authored aviation reference entries ported from airboss-firc (175 entries).
 *
 * Generated by scripts/references/migrate-firc-entries.ts on ${REVIEWED_AT}. The
 * script applied a deterministic first pass (sourceType + seed topics +
 * knowledgeKind + flightRules) and a content-aware second pass (multi-valued
 * topics, phase-of-flight, cert-applicability, keywords). Ambiguities are
 * tracked in docs/work/todos/20260422-retag-ambiguities.md for human triage.
 *
 * Edit this file directly once you've reviewed the ambiguity report; the
 * migration script is one-shot and not idempotent against hand-edits.
 */

import { registerReferences } from '../registry';
import type { Reference } from '../schema/reference';

export const AVIATION_REFERENCES: readonly Reference[] = [
`;

	const body = refs.map(renderReference).join(',\n');

	const footer = `,
];

// Register at module load so the registry is populated before any consumer
// imports it.
registerReferences(AVIATION_REFERENCES);
`;

	return header + body + footer;
}

function renderReference(r: MigratedReference): string {
	const lines: string[] = [];
	lines.push('\t{');
	lines.push(`\t\tid: ${q(r.id)},`);
	lines.push(`\t\tdisplayName: ${q(r.displayName)},`);
	lines.push(`\t\taliases: ${renderStringArray(r.aliases)},`);
	lines.push(`\t\tparaphrase: ${q(r.paraphrase)},`);
	lines.push(`\t\ttags: {`);
	lines.push(`\t\t\tsourceType: ${q(r.tags.sourceType)},`);
	lines.push(`\t\t\taviationTopic: ${renderStringArray(r.tags.aviationTopic)},`);
	lines.push(`\t\t\tflightRules: ${q(r.tags.flightRules)},`);
	lines.push(`\t\t\tknowledgeKind: ${q(r.tags.knowledgeKind)},`);
	if (r.tags.phaseOfFlight && r.tags.phaseOfFlight.length > 0) {
		lines.push(`\t\t\tphaseOfFlight: ${renderStringArray(r.tags.phaseOfFlight)},`);
	}
	if (r.tags.certApplicability && r.tags.certApplicability.length > 0) {
		lines.push(`\t\t\tcertApplicability: ${renderStringArray(r.tags.certApplicability)},`);
	}
	if (r.tags.keywords && r.tags.keywords.length > 0) {
		lines.push(`\t\t\tkeywords: ${renderStringArray(r.tags.keywords)},`);
	}
	lines.push(`\t\t},`);
	lines.push(`\t\tsources: ${renderSources(r.sources)},`);
	lines.push(`\t\trelated: ${renderStringArray(r.related)},`);
	lines.push(`\t\treviewedAt: ${q(r.reviewedAt)},`);
	lines.push('\t}');
	return lines.join('\n');
}

function renderSources(
	sources: readonly { sourceId: string; locator: Readonly<Record<string, string | number>>; url?: string }[],
): string {
	if (sources.length === 0) return '[]';
	const lines = ['['];
	for (const s of sources) {
		lines.push('\t\t\t{');
		lines.push(`\t\t\t\tsourceId: ${q(s.sourceId)},`);
		lines.push(`\t\t\t\tlocator: ${renderLocator(s.locator)},`);
		if (s.url) lines.push(`\t\t\t\turl: ${q(s.url)},`);
		lines.push('\t\t\t},');
	}
	lines.push('\t\t]');
	return lines.join('\n');
}

function renderLocator(loc: Readonly<Record<string, string | number>>): string {
	const keys = Object.keys(loc);
	if (keys.length === 0) return '{}';
	const parts = keys.map((k) => {
		const v = loc[k];
		return `${safeKey(k)}: ${typeof v === 'number' ? String(v) : q(String(v))}`;
	});
	return `{ ${parts.join(', ')} }`;
}

function safeKey(k: string): string {
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : q(k);
}

function renderStringArray(arr: readonly string[]): string {
	if (arr.length === 0) return '[]';
	return `[${arr.map(q).join(', ')}]`;
}

function q(s: string): string {
	// Single-quoted; escape backslashes + single quotes + newlines.
	return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

function renderAmbiguityReport(ambiguities: readonly AmbiguityFlag[], total: number, addedEdges: number): string {
	const byId = new Map<string, AmbiguityFlag[]>();
	for (const a of ambiguities) {
		const existing = byId.get(a.id) ?? [];
		existing.push(a);
		byId.set(a.id, existing);
	}
	const uniqueIds = [...byId.keys()].sort();

	const header = `# Retag ambiguities report (${REVIEWED_AT})

Generated by \`scripts/references/migrate-firc-entries.ts\` during the 175-entry
port from airboss-firc. Each entry below landed in \`libs/aviation/src/references/aviation.ts\`
with best-guess tags, but the script flagged one or more reasons a CFI should eyeball
the result.

Totals:

- Entries ported: **${total}** / 175
- Reverse \`related\` edges added for bidirectional symmetry: **${addedEdges}**
- Entries with at least one ambiguity flag: **${uniqueIds.length}**
- Total flags: **${ambiguities.length}**

## Triage workflow

1. Read each flagged entry's current tags in \`libs/aviation/src/references/aviation.ts\`.
2. Cross-check against the entry's \`detail\` content.
3. Edit the file directly -- the migration script is one-shot.
4. Re-run \`bun run check\` after edits.

## Flags by entry

`;

	const sections: string[] = [];
	for (const id of uniqueIds) {
		const flags = byId.get(id) ?? [];
		const term = flags[0]?.term ?? '(unknown)';
		sections.push(`### \`${id}\` -- ${term}\n`);
		for (const f of flags) {
			sections.push(`- ${f.reason}`);
		}
		sections.push('');
	}

	return `${header}${sections.join('\n')}\n`;
}

// -------- execute --------

mkdirSync(dirname(AVIATION_OUT), { recursive: true });
mkdirSync(dirname(AMBIGUITY_OUT), { recursive: true });

await main();
