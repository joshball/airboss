/**
 * Hand-authored `cites:` block for every lesson in the FAR-navigation
 * course (`course/regulations/`).
 *
 * The map is keyed by the lesson's repo-relative path. Each entry spells
 * out three lists:
 *
 *   - `acs_leaves`: PA ACS-6C codes the lesson teaches. Authored against
 *     the canonical FAA-S-ACS-6C document; codes that don't yet have a
 *     `study.syllabus_node` row in the seeded DB still validate (the
 *     project ingests the ACS area-by-area; only Area V is seeded today).
 *   - `knowledge_nodes`: slugs from `course/knowledge/<group>/<slug>`.
 *     Most regulatory lessons map only to the two seeded knowledge
 *     nodes (`regulations/currency-vs-proficiency` and
 *     `regulations/pilot-privileges-limitations`).
 *   - `handbook_sections`: airboss-ref:-shaped pointers (CFR sections,
 *     ACs, AIM paragraphs) the lesson cites and reads alongside.
 *
 * Authoring follows the WP spec rule "no `cites: []`": every lesson
 * carries at least one entry across the three lists. Where a lesson is
 * structural (e.g., "how to read a citation") and doesn't directly
 * teach a regulation, the citation set still grounds it -- pointing at
 * the regulatory architecture covered by the body.
 *
 * No `pending_review:` markers: the WP spec was overridden to drop the
 * ambiguous-leaf escape hatch. Where a lesson maps imperfectly to the
 * ACS, the closest applicable leaf is selected; the user reviews after.
 */

export interface LessonCites {
	knowledge_nodes: readonly string[];
	acs_leaves: readonly string[];
	handbook_sections: readonly string[];
}

/**
 * Per-lesson authored citations. Keyed by the lesson's path relative to
 * the repo root, without the leading `course/regulations/`.
 */
export const LESSON_CITES: Readonly<Record<string, LessonCites>> = {
	// =====================================================================
	// Week 1 -- Architecture of Title 14
	// =====================================================================
	'week-01-architecture/01-title-14-shape.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2', 'PA.I.A.K3'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91',
			'airboss-ref:regs/cfr-14/61',
			'airboss-ref:regs/cfr-14/141',
			'airboss-ref:regs/cfr-49/830',
		],
	},
	'week-01-architecture/02-how-to-read-a-citation.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91/103', 'airboss-ref:regs/cfr-14/91'],
	},
	'week-01-architecture/03-companion-documents.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.E.K1'],
		handbook_sections: [
			'airboss-ref:aim/1-1-1',
			'airboss-ref:ac/00-6/b',
			'airboss-ref:ac/61-65/j',
			'airboss-ref:regs/cfr-49/830',
		],
	},
	'week-01-architecture/04-the-pilot-the-flight-the-operation.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61', 'airboss-ref:regs/cfr-14/91', 'airboss-ref:regs/cfr-14/141'],
	},
	// =====================================================================
	// Week 2 -- Part 61 deep (the pilot)
	// =====================================================================
	'week-02-part-61-deep/01-subpart-walk.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations', 'regulations/currency-vs-proficiency'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2', 'PA.I.A.K3'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61', 'airboss-ref:regs/cfr-14/61/3', 'airboss-ref:regs/cfr-14/61/103'],
	},
	'week-02-part-61-deep/02-aeronautical-experience.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/109',
			'airboss-ref:regs/cfr-14/61/129',
			'airboss-ref:regs/cfr-14/61/65',
			'airboss-ref:regs/cfr-14/61/51',
		],
	},
	'week-02-part-61-deep/03-currency-vs-recency-vs-proficiency.md': {
		knowledge_nodes: ['regulations/currency-vs-proficiency'],
		acs_leaves: ['PA.I.A.K3'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/56',
			'airboss-ref:regs/cfr-14/61/57',
			'airboss-ref:regs/cfr-14/61/58',
			'airboss-ref:ac/61-98/d',
		],
	},
	'week-02-part-61-deep/04-flight-review-and-equivalents.md': {
		knowledge_nodes: ['regulations/currency-vs-proficiency'],
		acs_leaves: ['PA.I.A.K3'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61/56', 'airboss-ref:ac/61-98/d', 'airboss-ref:ac/61-65/j'],
	},
	'week-02-part-61-deep/05-ifr-currency.md': {
		knowledge_nodes: ['regulations/currency-vs-proficiency'],
		acs_leaves: ['PA.I.A.K3'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/57',
			'airboss-ref:regs/cfr-14/61/65',
			'airboss-ref:regs/cfr-14/61/51',
		],
	},
	'week-02-part-61-deep/06-medical-certificates.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K2'],
		handbook_sections: ['airboss-ref:regs/cfr-14/67', 'airboss-ref:regs/cfr-14/68', 'airboss-ref:regs/cfr-14/61/23'],
	},
	// =====================================================================
	// Week 3 -- Part 61 CFI (subpart H, endorsements, FOI)
	// =====================================================================
	'week-03-part-61-cfi/01-subpart-h-walk.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/181',
			'airboss-ref:regs/cfr-14/61/189',
			'airboss-ref:regs/cfr-14/61/195',
			'airboss-ref:regs/cfr-14/61/197',
		],
	},
	'week-03-part-61-cfi/02-eligibility-and-experience.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/183',
			'airboss-ref:regs/cfr-14/61/187',
			'airboss-ref:regs/cfr-14/61/65',
		],
	},
	'week-03-part-61-cfi/03-privileges-and-limitations.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/193',
			'airboss-ref:regs/cfr-14/61/195',
			'airboss-ref:regs/cfr-14/61/89',
		],
	},
	'week-03-part-61-cfi/04-renewal.md': {
		knowledge_nodes: ['regulations/currency-vs-proficiency'],
		acs_leaves: ['PA.I.A.K3'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61/197', 'airboss-ref:regs/cfr-14/61/199'],
	},
	'week-03-part-61-cfi/05-endorsements.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K2', 'PA.I.A.K3'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61/31', 'airboss-ref:regs/cfr-14/61/189', 'airboss-ref:ac/61-65/j'],
	},
	// =====================================================================
	// Week 4 -- Part 91 general + flight rules
	// =====================================================================
	'week-04-part-91-general-and-flight-rules/01-pic-authority-and-careless-reckless.md': {
		knowledge_nodes: ['procedures/emergency-authority', 'procedures/adm-hazardous-attitudes'],
		acs_leaves: ['PA.I.H.K1', 'PA.IX.A.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91/3', 'airboss-ref:regs/cfr-14/91/13'],
	},
	'week-04-part-91-general-and-flight-rules/02-airworthiness-and-preflight.md': {
		knowledge_nodes: ['flight-planning/vfr-cross-country'],
		acs_leaves: ['PA.I.B.K1', 'PA.I.B.K2', 'PA.I.D.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/103',
			'airboss-ref:regs/cfr-14/91/7',
			'airboss-ref:regs/cfr-14/91/213',
		],
	},
	'week-04-part-91-general-and-flight-rules/03-occupant-rules-and-right-of-way.md': {
		knowledge_nodes: ['airspace/classes-and-dimensions'],
		acs_leaves: ['PA.III.B.K1', 'PA.I.E.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/105',
			'airboss-ref:regs/cfr-14/91/107',
			'airboss-ref:regs/cfr-14/91/113',
			'airboss-ref:regs/cfr-14/91/123',
		],
	},
	'week-04-part-91-general-and-flight-rules/04-vfr-weather-and-altitudes.md': {
		knowledge_nodes: ['airspace/vfr-weather-minimums', 'airspace/classes-and-dimensions'],
		acs_leaves: ['PA.I.E.K1', 'PA.I.E.K2', 'PA.I.C.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/155',
			'airboss-ref:regs/cfr-14/91/159',
			'airboss-ref:regs/cfr-14/91/119',
		],
	},
	'week-04-part-91-general-and-flight-rules/05-ifr-rules.md': {
		knowledge_nodes: ['flight-planning/ifr-cross-country'],
		acs_leaves: ['PA.I.E.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/167',
			'airboss-ref:regs/cfr-14/91/169',
			'airboss-ref:regs/cfr-14/91/175',
			'airboss-ref:regs/cfr-14/91/185',
		],
	},
	'week-04-part-91-general-and-flight-rules/06-equipment-supplemental-rules.md': {
		knowledge_nodes: ['flight-planning/vfr-cross-country'],
		acs_leaves: ['PA.I.B.K1', 'PA.I.B.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/126',
			'airboss-ref:regs/cfr-14/91/127',
			'airboss-ref:regs/cfr-14/91/130',
			'airboss-ref:regs/cfr-14/91/131',
			'airboss-ref:regs/cfr-14/91/135',
		],
	},
	// =====================================================================
	// Week 5 -- Part 91 equipment + maintenance
	// =====================================================================
	'week-05-part-91-equipment-and-maintenance/01-documents-and-required-equipment.md': {
		knowledge_nodes: ['flight-planning/vfr-cross-country'],
		acs_leaves: ['PA.I.B.K1', 'PA.I.B.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/9',
			'airboss-ref:regs/cfr-14/91/203',
			'airboss-ref:regs/cfr-14/91/205',
		],
	},
	'week-05-part-91-equipment-and-maintenance/02-elt-lights-inoperative-equipment.md': {
		knowledge_nodes: ['flight-planning/vfr-cross-country'],
		acs_leaves: ['PA.I.B.K1', 'PA.I.B.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/207',
			'airboss-ref:regs/cfr-14/91/209',
			'airboss-ref:regs/cfr-14/91/213',
		],
	},
	'week-05-part-91-equipment-and-maintenance/03-transponder-and-ads-b.md': {
		knowledge_nodes: ['airspace/classes-and-dimensions'],
		acs_leaves: ['PA.I.B.K1', 'PA.I.E.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/215',
			'airboss-ref:regs/cfr-14/91/225',
			'airboss-ref:regs/cfr-14/91/227',
		],
	},
	'week-05-part-91-equipment-and-maintenance/04-maintenance-responsibilities-and-inspections.md': {
		knowledge_nodes: ['flight-planning/vfr-cross-country'],
		acs_leaves: ['PA.I.B.K1', 'PA.I.B.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/403',
			'airboss-ref:regs/cfr-14/91/405',
			'airboss-ref:regs/cfr-14/91/407',
			'airboss-ref:regs/cfr-14/91/409',
			'airboss-ref:regs/cfr-14/91/411',
			'airboss-ref:regs/cfr-14/91/413',
			'airboss-ref:regs/cfr-14/91/417',
			'airboss-ref:regs/cfr-14/43',
		],
	},
	'week-05-part-91-equipment-and-maintenance/05-altimeter-transponder-record-checks.md': {
		knowledge_nodes: ['flight-planning/vfr-cross-country'],
		acs_leaves: ['PA.I.B.K1', 'PA.I.B.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/411',
			'airboss-ref:regs/cfr-14/91/413',
			'airboss-ref:regs/cfr-14/91/417',
			'airboss-ref:regs/cfr-14/43/appendix-e',
		],
	},
	// =====================================================================
	// Week 6 -- Part 91 special ops
	// =====================================================================
	'week-06-part-91-special-ops/01-special-flight-ops.md': {
		knowledge_nodes: ['airspace/special-use'],
		acs_leaves: ['PA.I.E.K1', 'PA.I.E.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/137',
			'airboss-ref:regs/cfr-14/91/139',
			'airboss-ref:regs/cfr-14/91/141',
			'airboss-ref:regs/cfr-14/91/143',
			'airboss-ref:regs/cfr-14/91/147',
		],
	},
	'week-06-part-91-special-ops/02-restricted-limited-experimental.md': {
		knowledge_nodes: ['airspace/special-use'],
		acs_leaves: ['PA.I.E.K1', 'PA.I.B.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91/313', 'airboss-ref:regs/cfr-14/91/319'],
	},
	'week-06-part-91-special-ops/03-large-turbine-and-rvsm.md': {
		knowledge_nodes: ['airspace/classes-and-dimensions'],
		acs_leaves: ['PA.I.E.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91/180', 'airboss-ref:regs/cfr-14/91/189'],
	},
	'week-06-part-91-special-ops/04-foreign-and-fractional.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91/703', 'airboss-ref:regs/cfr-14/91/1001'],
	},
	'week-06-part-91-special-ops/05-walking-part-91.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.B.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91'],
	},
	// =====================================================================
	// Week 7 -- Parts 141 and 135
	// =====================================================================
	'week-07-parts-141-and-135/01-part-141-structure.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/141',
			'airboss-ref:regs/cfr-14/141/1',
			'airboss-ref:regs/cfr-14/141/55',
		],
	},
	'week-07-parts-141-and-135/02-part-141-as-a-cfi.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: ['airboss-ref:regs/cfr-14/141', 'airboss-ref:regs/cfr-14/141/85'],
	},
	'week-07-parts-141-and-135/03-part-135-and-119.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/119', 'airboss-ref:regs/cfr-14/135'],
	},
	'week-07-parts-141-and-135/04-part-145-and-121-locate.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.B.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/145', 'airboss-ref:regs/cfr-14/121'],
	},
	// =====================================================================
	// Week 8 -- Companion documents
	// =====================================================================
	'week-08-companion-documents/01-aim-as-expected-knowledge.md': {
		knowledge_nodes: ['airspace/classes-and-dimensions'],
		acs_leaves: ['PA.I.E.K1', 'PA.I.E.K2', 'PA.III.A.K1'],
		handbook_sections: ['airboss-ref:aim/1-1-1', 'airboss-ref:aim/3-1-1', 'airboss-ref:aim/4-1-1'],
	},
	'week-08-companion-documents/02-advisory-circulars.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.E.K1'],
		handbook_sections: [
			'airboss-ref:ac/00-6/b',
			'airboss-ref:ac/00-45/h',
			'airboss-ref:ac/61-65/j',
			'airboss-ref:ac/91-21.1/d',
		],
	},
	'week-08-companion-documents/03-chief-counsel-interpretations.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61/51', 'airboss-ref:regs/cfr-14/61/57'],
	},
	'week-08-companion-documents/04-other-titles-and-49-cfr.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.IX.A.K1', 'PA.IX.D.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-49/830', 'airboss-ref:regs/cfr-49/1552'],
	},
	'week-08-companion-documents/05-where-the-real-answer-lives.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/51',
			'airboss-ref:regs/cfr-14/61/113',
			'airboss-ref:regs/cfr-14/91/13',
			'airboss-ref:regs/cfr-14/91/103',
			'airboss-ref:regs/cfr-14/91/123',
			'airboss-ref:regs/cfr-14/91/185',
		],
	},
	// =====================================================================
	// Week 9 -- Enforcement + NTSB Part 830
	// =====================================================================
	'week-09-enforcement/01-compliance-program-vs-enforcement.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations', 'procedures/adm-hazardous-attitudes'],
		acs_leaves: ['PA.I.H.K1', 'PA.IX.A.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91/13', 'airboss-ref:regs/cfr-14/61/15'],
	},
	'week-09-enforcement/02-enforcement-action-pipeline.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.IX.A.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/91/13', 'airboss-ref:regs/cfr-14/61/15'],
	},
	'week-09-enforcement/03-asrs-asap-and-self-disclosure.md': {
		knowledge_nodes: ['procedures/adm-hazardous-attitudes'],
		acs_leaves: ['PA.I.H.K1', 'PA.IX.A.K1'],
		handbook_sections: ['airboss-ref:ac/00-46/f'],
	},
	'week-09-enforcement/04-career-enders.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.IX.A.K1', 'PA.I.A.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/15',
			'airboss-ref:regs/cfr-14/61/16',
			'airboss-ref:regs/cfr-14/91/17',
			'airboss-ref:regs/cfr-14/91/19',
		],
	},
	'week-09-enforcement/05-ntsb-part-830.md': {
		knowledge_nodes: ['procedures/emergency-authority'],
		acs_leaves: ['PA.IX.A.K1', 'PA.IX.D.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-49/830/5',
			'airboss-ref:regs/cfr-49/830/10',
			'airboss-ref:regs/cfr-49/830/15',
		],
	},
	'week-09-enforcement/06-deviations-and-remedial-training.md': {
		knowledge_nodes: ['procedures/emergency-authority'],
		acs_leaves: ['PA.IX.A.K1', 'PA.IX.A.K2'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/3',
			'airboss-ref:regs/cfr-14/91/123',
			'airboss-ref:regs/cfr-14/91/13',
		],
	},
	// =====================================================================
	// Week 10 -- Capstone (integrative)
	// =====================================================================
	'week-10-capstone/01-how-the-capstone-works.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations', 'regulations/currency-vs-proficiency'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2', 'PA.I.A.K3'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61', 'airboss-ref:regs/cfr-14/91'],
	},
	'week-10-capstone/02-the-four-canonical-scenarios.md': {
		knowledge_nodes: [
			'regulations/pilot-privileges-limitations',
			'regulations/currency-vs-proficiency',
			'procedures/emergency-authority',
		],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K3', 'PA.IX.A.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/61/56',
			'airboss-ref:regs/cfr-14/61/57',
			'airboss-ref:regs/cfr-14/91/3',
			'airboss-ref:regs/cfr-14/91/13',
		],
	},
	'week-10-capstone/03-self-assessment-and-reflection.md': {
		knowledge_nodes: ['procedures/adm-hazardous-attitudes', 'regulations/currency-vs-proficiency'],
		acs_leaves: ['PA.I.H.K1', 'PA.I.A.K3'],
		handbook_sections: ['airboss-ref:ac/60-22/-', 'airboss-ref:regs/cfr-14/61/56'],
	},
	// =====================================================================
	// Orals (cumulative scenarios -- no `week` field; treated as standalone
	// lessons that span the whole course)
	// =====================================================================
	'orals/friend-flight-review.md': {
		knowledge_nodes: ['regulations/currency-vs-proficiency', 'regulations/pilot-privileges-limitations'],
		acs_leaves: ['PA.I.A.K3', 'PA.I.A.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61/56', 'airboss-ref:regs/cfr-14/61/59'],
	},
	'orals/gear-up-night-ifr.md': {
		knowledge_nodes: ['procedures/emergency-authority', 'flight-planning/ifr-cross-country'],
		acs_leaves: ['PA.IX.A.K1', 'PA.IX.D.K1'],
		handbook_sections: [
			'airboss-ref:regs/cfr-14/91/3',
			'airboss-ref:regs/cfr-14/91/13',
			'airboss-ref:regs/cfr-49/830/5',
		],
	},
	'orals/night-ifr-passenger.md': {
		knowledge_nodes: ['regulations/currency-vs-proficiency', 'flight-planning/ifr-cross-country'],
		acs_leaves: ['PA.I.A.K3', 'PA.I.E.K1'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61/57', 'airboss-ref:regs/cfr-14/91/167'],
	},
	'orals/ppl-applies-for-ir.md': {
		knowledge_nodes: ['regulations/pilot-privileges-limitations', 'flight-planning/ifr-cross-country'],
		acs_leaves: ['PA.I.A.K1', 'PA.I.A.K2'],
		handbook_sections: ['airboss-ref:regs/cfr-14/61/65', 'airboss-ref:regs/cfr-14/61/51'],
	},
};

/**
 * Returns the authored citation block for a lesson. Throws when the path
 * isn't covered (the validator surfaces this as the "missing cites" error).
 */
export function getLessonCites(lessonRelativePath: string): LessonCites {
	const cites = LESSON_CITES[lessonRelativePath];
	if (cites === undefined) {
		throw new Error(`No authored cites for lesson: ${lessonRelativePath}`);
	}
	return cites;
}

export function hasLessonCites(lessonRelativePath: string): boolean {
	return LESSON_CITES[lessonRelativePath] !== undefined;
}
