/**
 * Authored dev-seed content for the Abby learner.
 *
 * Three domains, depth-first, CFR-cited. Cards mix recall and reasoning;
 * scenarios are 3-4 option decision reps with substantive whyNot rationales.
 *
 * Citations are quoted from the live 14 CFR Part 91 text (Cornell LII,
 * eCFR.gov) and from current FAA handbooks (PHAK FAA-H-8083-25C, Airplane
 * Flying Handbook FAA-H-8083-3C, AIM 2024). Where a regulation is summarized
 * rather than quoted, the citation is named at the end of the back text.
 *
 * The card / scenario shapes in this file are plain data; the seeder reads
 * them and inserts via the BC create paths plus the seed_origin marker.
 */

import {
	CARD_TYPES,
	type CardType,
	CONTENT_SOURCES,
	type ContentSource,
	DIFFICULTIES,
	type Difficulty,
	DOMAINS,
	type Domain,
	PHASES_OF_FLIGHT,
	type PhaseOfFlight,
} from '@ab/constants';

export interface SeedCard {
	front: string;
	back: string;
	domain: Domain;
	cardType: CardType;
	tags: string[];
	sourceType: ContentSource;
	sourceRef: string | null;
	nodeId: string | null;
}

export interface SeedScenarioOption {
	/** Stable id used by the scenario engine. */
	letter: 'a' | 'b' | 'c' | 'd';
	text: string;
	isCorrect: boolean;
	outcome: string;
	whyNot: string;
}

export interface SeedScenario {
	title: string;
	situation: string;
	options: readonly SeedScenarioOption[];
	teachingPoint: string;
	domain: Domain;
	difficulty: Difficulty;
	phaseOfFlight: PhaseOfFlight | null;
	regReferences: string[];
	nodeId: string | null;
}

// -----------------------------------------------------------------------------
// Personal cards for Abby (~18 across the three domains).
//
// Discovery-first pedagogy per ADR 011: lead with WHY where applicable.
// Citations point at the actual reg or handbook chapter. CFR § text is
// quoted verbatim from 14 CFR Part 91.
// -----------------------------------------------------------------------------

export const ABBY_CARDS: readonly SeedCard[] = [
	// --- VFR Weather Minimums (Abby's personal layer on top of the 12 course cards) ---
	{
		front:
			'Walk through the WHY of Special VFR: which problem does it solve, and what restriction does it accept in trade?',
		back: 'Special VFR exists because Class B/C/D/E surface areas can drop below the basic 1,000 ft ceiling / 3 SM visibility threshold while a flight still has plenty of legal escape margin (e.g. coastal stratus that thins inland). 14 CFR 91.157 lets ATC authorize you to enter or depart with 1 SM flight visibility, clear of clouds. The trade: you have explicitly given up the 500-1000-2000 cloud-clearance buffer that protects against IFR pop-outs, so ATC owns separation and you accept that the geometry may put an emerging IFR aircraft into your windscreen. Daytime only unless you hold an instrument rating AND the airplane is IFR-equipped (91.157(b)(3-4)).',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.REGULATION,
		tags: ['vfr-mins', 'special-vfr', '91.157', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-vfr-weather-minimums',
	},
	{
		front:
			'A METAR reports 4 SM and BKN015. You plan a VFR cross-country in Class E below 10,000 MSL. Are you legal? What is the trap?',
		back: 'Visibility is legal (3 SM minimum). The trap is the ceiling: Class E below 10,000 MSL requires 1,000 ft above clouds. If you are at 2,500 MSL and the ceiling reads 1,500 AGL (1,500 + field elevation), the broken layer may put you closer than 1,000 ft to bases on a quick climb to clear terrain or a cruise at typical 2,500 AGL. Legal does not mean smart - 91.155 is the floor, not a target. Plan altitude with the cloud clearance arithmetic done first.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.BASIC,
		tags: ['vfr-mins', 'class-e', '91.155', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-vfr-weather-minimums',
	},
	{
		front:
			'Why does 14 CFR 91.155 carve out a separate paragraph (b)(2) for "operating in the traffic pattern, within 1/2 mile of the runway, in Class G at night"?',
		back: 'Without the carve-out, the night Class G rule (3 SM, 500/1000/2000) would shut down a lot of legal night pattern work at airports that report 1-2 SM in fog or smoke but where the runway environment is fully visible. Congress + the FAA judged that an aircraft in a tight pattern at a known airport is in a different threat envelope than one transiting cross-country. The pattern exception is narrow: 1 SM, clear of clouds, AND the half-mile-of-runway box. Outside any leg of that, you are back to the standard mins.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.REGULATION,
		tags: ['vfr-mins', 'class-g', 'night', '91.155', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-vfr-weather-minimums',
	},

	// --- Airspace (~10 personal cards) ---
	{
		front:
			'You see a magenta dashed line ringing an airport on a sectional. What is it telling you, and where is the floor of that controlled airspace?',
		back: 'Magenta dashed = Class E surface area. Inside the dashed line, controlled airspace begins at the surface (rather than 700 or 1,200 AGL). The reason: instrument approaches terminate at the surface, and the surface area protects them from VFR traffic without ATC awareness. The floor is the ground; the top is whatever the chart annotation says (usually 700 AGL where the magenta vignette starts outside the dashed area).',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.BASIC,
		tags: ['airspace', 'class-e', 'sectional', 'surface-area', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		front:
			'Why is Mode C required within 30 NM of a Class B primary airport from the surface to 10,000 MSL (the "Mode C veil") even outside Class B itself?',
		back: '14 CFR 91.215(b)(2) extends the transponder + altitude reporting requirement past the Class B walls because the high traffic density of arrivals and departures spills well outside the published shelves. ATC needs altitude on every primary target close enough to be a factor for Class B traffic, not just on the ones inside the wall. The 30 NM ring is geometric - that is the rough horizon at which a 250 kt aircraft at FL100 reaches conflict altitude in roughly 7 minutes.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.REGULATION,
		tags: ['airspace', 'class-b', 'mode-c-veil', '91.215', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		front: 'What clearance / equipment is required to enter Class B vs. Class C vs. Class D in a Cessna 172?',
		back: "Class B: explicit ATC clearance to enter ('Cessna 12345, cleared into the Class B'), Mode C transponder, ADS-B Out, two-way comm. (14 CFR 91.131, 91.215, 91.225). Class C: two-way comm established (controller calls you back by call sign), Mode C, ADS-B Out within the lateral limits and above. (91.130, 91.215, 91.225). Class D: two-way comm established, no Mode C unless it overlies Class B/C/Mode-C-veil. (91.129). 'Two-way established' = controller used your full call sign. 'N12345 stand by' COUNTS; 'aircraft calling, stand by' DOES NOT.",
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.REGULATION,
		tags: ['airspace', 'class-b', 'class-c', 'class-d', '91.129', '91.130', '91.131', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		front:
			'You are looking at a sectional and see a hatched blue line surrounding a chunk of airspace labeled "MOA". You are VFR. What restrictions apply?',
		back: 'A Military Operations Area (MOA) is a Special Use Airspace whose purpose is to separate military training (often acrobatic, supersonic, or formation work) from IFR traffic. VFR aircraft are NOT prohibited from entering an active MOA - 14 CFR contains no rule against it - but the AIM (3-4-5) strongly recommends contacting the controlling agency for traffic info and exercising extreme caution. IFR traffic is rerouted around active MOAs by ATC; VFR is on its own. Active times are charted; FSS or the controlling ARTCC can confirm real-time status.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.BASIC,
		tags: ['airspace', 'special-use', 'moa', 'aim-3-4-5', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-special-use',
	},
	{
		front: 'Restricted areas (R-XXXX): are they a no-go for VFR? What is the actual rule and why?',
		back: '14 CFR 73.13 and 91.133: no person may operate inside a restricted area "contrary to the restrictions imposed" - which means it depends on whether the area is active. If the controlling agency has released the area (cold), VFR transit is legal. If active (hot), ATC clearance through the controlling agency is required, and absent that you must remain clear. The reason: restricted areas protect activities (gunnery, missile testing, drone ops) that are physically hazardous, not just inconvenient. "When in doubt, treat as hot" is the practical rule.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.REGULATION,
		tags: ['airspace', 'special-use', 'restricted', '91.133', '73.13', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-special-use',
	},
	{
		front: 'Why does Class A start at 18,000 MSL specifically? Why not 15,000 or 20,000?',
		back: 'Two reasons drove the choice. First, jet airliner cruise altitudes cluster between FL280 and FL410, so the IFR-only floor needs to sit well below typical cruise to capture climbs, descents, and step-climbs. Second, 18,000 MSL is the altitude above which 91.121 requires altimeters set to 29.92 (flight levels). The transition from local altimeter setting to standard pressure was already drawn at 18,000 for separation reasons, so making that the IFR-only line aligned the regulatory boundaries. Above 18,000 MSL, every aircraft is on the same altimeter datum and on an ATC clearance.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.BASIC,
		tags: ['airspace', 'class-a', '91.121', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		front:
			'In Class C, the inner core typically goes from surface to 4,000 ft AGL with a 5 NM radius, and the outer shelf from 1,200 ft AGL to 4,000 AGL with a 10 NM radius. What is the actual basis for those shapes?',
		back: 'They mirror the radar coverage and approach geometry the controller actually uses. The 5 NM inner core captures the high-density arrival/departure cone where ATC is sequencing IFR traffic to the runway. The 10 NM shelf at 1,200 AGL captures the descent path of arriving traffic from the en-route system. Above 4,000 AGL, the airspace becomes Class E (or occasionally Class B/A if appropriate); ATC has handed traffic off. The shape is engineered around the protected operation, not chosen for tidy numbers.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.BASIC,
		tags: ['airspace', 'class-c', 'geometry', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		front: 'What is a TRSA, and why is participation voluntary?',
		back: 'A Terminal Radar Service Area (TRSA) is a leftover legacy designation - airspace around an airport with radar service but not enough traffic / equipment to justify Class B or C. Charted with solid black rings on a sectional. Participation is voluntary because Congress only authorized mandatory radar separation around the airspace classes themselves. ATC will provide separation between participating IFR and participating VFR; non-participating VFR aircraft are unsequenced and must self-separate. AIM 3-5-6.',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.BASIC,
		tags: ['airspace', 'trsa', 'aim-3-5-6', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'airspace-classes-and-dimensions',
	},

	// --- Emergency Procedures (~5 personal cards) ---
	{
		front:
			'Why is "fly the airplane first" the universal first step in every emergency checklist? What is the underlying failure mode?',
		back: 'Pilots in emergencies fixate on the malfunction (cause analysis, troubleshooting, comm) and stop scanning attitude/airspeed/altitude. CFIT and stall-spin during emergency handling are two of the largest accident categories. "Aviate, navigate, communicate" forces the priority hierarchy: keep the airplane in a survivable flight path before touching anything else. PHAK 17-2 frames it as the "control of the aircraft" cognitive load that must be reserved before the pilot has spare capacity for diagnosis.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		cardType: CARD_TYPES.BASIC,
		tags: ['emergencies', 'aviate-navigate-communicate', 'phak-17', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'proc-engine-failure-after-takeoff',
	},
	{
		front:
			'Engine failure on takeoff at 200 AGL. Why is "do not turn back to the runway" the doctrine, and at what altitude does the calculation start to favor a return?',
		back: 'Below ~700-1000 AGL, a 180-degree turn back to the runway eats more altitude than a single-engine airplane has, AND it bleeds airspeed because pilots reflexively pull to compensate for the visual sight-picture during the turn. Stall-spin in the turn is the primary killer. The "impossible turn" research (NASA, Aopa, AC 61-67) puts the break-even well above 700 ft for typical light aircraft and shows the failure mode is loss of control, not loss of runway. Doctrine: land within 30 degrees of straight ahead. Altitude check is altitude-specific to airplane and density altitude; 1,000 AGL is a common conservative floor.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		cardType: CARD_TYPES.BASIC,
		tags: ['emergencies', 'efato', 'impossible-turn', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: 'proc-engine-failure-after-takeoff',
	},
	{
		front:
			'Best glide speed in a Cessna 172R is roughly 65 KIAS. What is the underlying physics, and why does it change with weight?',
		back: 'Best glide is the speed at which L/D is maximum - the slowest descent angle, NOT the slowest descent rate. Below it, induced drag dominates; above it, parasite drag dominates. The crossover (L/D max) sits at a specific angle of attack, and that AoA corresponds to one specific airspeed at one specific weight. Lighter weight means a lower stall speed AND a lower best-glide speed (square-root relation: weight ratio ^ 0.5). For a 2,300-lb 172R at gross, ~65 KIAS; at 1,800 lb, closer to ~58 KIAS. The published number assumes max gross.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		cardType: CARD_TYPES.BASIC,
		tags: ['emergencies', 'best-glide', 'aerodynamics', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
	},
	{
		front:
			'Electrical fire in flight: why is the master switch the FIRST item, before pulling individual breakers or cycling avionics?',
		back: 'An electrical fire is fed by current. Pulling individual breakers leaves you guessing which circuit is the source - meanwhile the fire propagates. Killing the master removes ALL bus voltage simultaneously and is the only deterministic way to remove the energy source. After the fire is out (smell + visual), THEN you can attempt to identify and isolate via individual breakers and bring the master back up if needed. C172 POH section 3 (Emergency Procedures) lists Master OFF as item 1 of the electrical fire checklist precisely for this reason.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		cardType: CARD_TYPES.MEMORY_ITEM,
		tags: ['emergencies', 'electrical-fire', 'memory-item', 'c172', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
	},
	{
		front:
			'Alternator failure in cruise (alternator light, ammeter showing discharge): how much battery time do you actually have, and what gets shed first?',
		back: 'Typical light-aircraft battery sized for 30 minutes of starter cranks and minimum-load contingency. With everything on (radios, lights, transponder, autopilot, panel), you are looking at 20-30 minutes before voltage drops below the threshold where avionics start dropping out asymmetrically (some at 10V, some at 9V). Shed in priority order: external lights -> autopilot -> non-essential avionics -> NAV2 -> COM2 -> pitot heat IF NOT in icing. Keep COM1, NAV1, transponder, and one comm radio. Tell ATC, pick the nearest suitable airport, and land before the bus voltage drops far enough that the radios go silent mid-pattern.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		cardType: CARD_TYPES.BASIC,
		tags: ['emergencies', 'alternator-failure', 'electrical', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
	},
	{
		front:
			'You smell something hot during cruise but see no smoke and the ammeter looks normal. What is the first thing to do, and why is "wait and see" wrong?',
		back: "Hot smell with no visible smoke = fire is incipient or in a hidden compartment. By the time smoke appears, propagation is well underway. The first action is to communicate (PAN/MAYDAY as conditions warrant), divert toward the nearest airport, and start systematic isolation: avionics master off (then cycle), cabin heat off (carbon monoxide is invisible and a hot-rubber smell often means a heater/exhaust leak), check the ammeter and cycle the alternator. 'Wait and see' converts a recoverable diversion into a forced landing. PHAK 17-9.",
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		cardType: CARD_TYPES.BASIC,
		tags: ['emergencies', 'fire', 'in-flight-fire', 'phak-17', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
	},
	{
		front: 'Partial power loss vs. complete engine failure: why is the partial case often more dangerous?',
		back: "Complete failure forces a clear decision tree (best glide, field selection, restart attempts, emergency declaration). Partial power gives the illusion of options - 'maybe it'll catch, maybe I can stretch to that better airport' - and pilots burn altitude/airspeed margin gambling on a recovery that doesn't come. The deceptive failure mode is critical airspeed: pilots who stretch a partial-power glide drop below best-glide trying to maintain altitude and stall. Doctrine: treat partial power as if it were complete and pick a field NOW; any added thrust is a bonus, not a plan.",
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		cardType: CARD_TYPES.BASIC,
		tags: ['emergencies', 'partial-power', 'decision-making', 'abby-personal'],
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
	},
];

// -----------------------------------------------------------------------------
// Scenarios (16 total)
// -----------------------------------------------------------------------------

export const ABBY_SCENARIOS: readonly SeedScenario[] = [
	// --- VFR Weather Minimums (6) ---
	{
		title: 'Marginal VFR cross-country -- Class E, 4 SM, BKN015',
		situation:
			'You are a VFR pilot 35 NM into a 90 NM cross-country at 3,500 MSL in Class E (field elevation along the route averages 1,000 MSL). Your destination AWOS reports 4 SM in haze, ceiling 1,500 broken, no precip. The next reporting station 20 NM ahead reports 3 SM, BKN012. Density altitude is normal. You are 25 minutes from your destination at current groundspeed.',
		options: [
			{
				letter: 'a',
				text: 'Continue: 3 SM is the legal minimum and you are still legal at both stations.',
				isCorrect: false,
				outcome:
					'Visibility is dropping ahead and the ceiling is forcing you to operate inside the 1,000 ft above-clouds requirement at typical pattern altitudes.',
				whyNot:
					'"Legal" sets the floor, not the operating envelope. The trend is toward worse, not better, and at BKN012 with a 1,000 ft above-clouds requirement you would need to operate below 200 AGL to remain legal in Class E -- which is below the 91.119 minimum safe altitude.',
			},
			{
				letter: 'b',
				text: 'Climb to 5,500 MSL (VFR cruise) to clear the broken layer and continue.',
				isCorrect: false,
				outcome:
					'Above the layer puts you at the mercy of holes at the destination and removes your visual reference for diversion.',
				whyNot:
					'VFR-on-top is not a recognized clearance for VFR-only pilots, and operating above a broken layer with deteriorating reports ahead is the textbook setup for a continued-VFR-into-IMC accident. You also cannot legally maintain 1,000 ft above clouds at 5,500 if the layer extends near or above that.',
			},
			{
				letter: 'c',
				text: 'Divert to the nearest airport with reported VFR conditions and reassess on the ground.',
				isCorrect: true,
				outcome: 'You land at a known-good field with margin in fuel, daylight, and decision capacity.',
				whyNot: '',
			},
			{
				letter: 'd',
				text: 'Request Special VFR from the destination tower for the last 10 NM.',
				isCorrect: false,
				outcome: 'Special VFR is not available at uncontrolled fields and is conditional on ATC workload.',
				whyNot:
					'Special VFR per 91.157 is for entering or departing a Class B/C/D/E SURFACE area when conditions are below basic VFR there. It is not a tool to keep a deteriorating cruise leg legal in Class E airspace. The destination here may not even have a SVFR-issuing controller, and SVFR does not raise the actual visibility.',
			},
		],
		teachingPoint:
			"VFR weather minimums describe the legal floor for the airspace you are in - they are not a target. The decision point is where the trend, not the current report, places you outside an operationally safe envelope. PHAK 17 (ADM) and the 'continued VFR into IMC' accident chain repeatedly show that the failure is not 'pilot was illegal' but 'pilot was legal up to the moment of impact.'",
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.155', '14 CFR 91.157', '14 CFR 91.119', 'PHAK Ch 17'],
		nodeId: 'airspace-vfr-weather-minimums',
	},
	{
		title: 'Class B entry without explicit clearance',
		situation:
			"You are inbound to a satellite airport that lies under the Class B shelf at 3,000 MSL. The Class B floor along your route is 4,000 MSL. You contact Approach: 'Approach, Cessna 12345 with you, 4,500 MSL, request flight following to KXYZ.' Approach replies, 'Cessna 12345, squawk 4521, ident.' You squawk and ident. Approach has not used the words 'cleared into the Class B.'",
		options: [
			{
				letter: 'a',
				text: 'Descend to 3,500 MSL to remain below the Class B shelf, continue toward destination.',
				isCorrect: true,
				outcome: 'You stay legal and continue under flight following beneath the shelf.',
				whyNot: '',
			},
			{
				letter: 'b',
				text: 'Continue at 4,500 MSL: the squawk-and-ident response constitutes a Class B clearance.',
				isCorrect: false,
				outcome: 'You enter Class B without a clearance and have just busted the airspace.',
				whyNot:
					'14 CFR 91.131(a)(1) requires "an ATC clearance from the ATC facility having jurisdiction" - the standard phraseology is "cleared into the Class B airspace." A squawk code assignment is not a clearance. Class B does not work like Class C, where two-way communication is enough.',
			},
			{
				letter: 'c',
				text: 'Reply to Approach: "Approach, 12345, just confirming we are NOT cleared into Class B at this time." Continue at 4,500 MSL.',
				isCorrect: false,
				outcome: 'You acknowledged you do not have a clearance and continued anyway -- still a bust.',
				whyNot:
					'Asking does not absolve you of being inside the airspace. The defensive move is to descend or turn out, not to confirm the lack of clearance and continue.',
			},
			{
				letter: 'd',
				text: 'Climb to 5,500 MSL to overfly the Class B shelf cleanly, continue.',
				isCorrect: false,
				outcome: 'You enter Class B from below as the shelf top is typically 10,000 MSL.',
				whyNot:
					'Class B usually extends from 4,000 MSL up to 10,000 MSL on the satellite shelf in this scenario. Climbing INTO it without a clearance is the same violation, just from a different vector.',
			},
		],
		teachingPoint:
			'Class B entry requires the explicit phraseology "cleared into the Class B." Anything short of that - flight following codes, "stand by", "radar contact" - is not a clearance. AIM 4-1-18 is explicit on this. When in doubt, descend or turn before the lateral or vertical limit.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.BEGINNER,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.131', 'AIM 4-1-18'],
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		title: 'Class G night pattern -- 1.5 SM in mist',
		situation:
			'You are at a non-towered field in Class G airspace at night, doing pattern work for night-currency. The field reports 1.5 SM in mist with sky clear. You are turning crosswind, pattern altitude 1,000 AGL. The field elevation is 800 MSL.',
		options: [
			{
				letter: 'a',
				text: 'Continue the pattern -- night Class G requires 3 SM and 500/1000/2000, you are illegal but it is your home field and you know the area.',
				isCorrect: false,
				outcome: 'You continue an illegal night operation. The reg is not a ceiling on familiarity.',
				whyNot: '14 CFR 91.155 night Class G mins are 3 SM, 500/1000/2000 - and you do not meet those.',
			},
			{
				letter: 'b',
				text: 'Continue: the 91.155(b)(2) pattern exception lets you operate at 1 SM clear of clouds within 1/2 mile of the runway in the pattern.',
				isCorrect: true,
				outcome: 'You complete the pattern within the legal exception.',
				whyNot: '',
			},
			{
				letter: 'c',
				text: 'Continue but only do straight-ins from now on, since the 1/2 mile rule is shaped around the runway centerline.',
				isCorrect: false,
				outcome: 'You misread the rule and add unnecessary risk by abandoning the standard pattern.',
				whyNot:
					'The 91.155(b)(2) exception applies to the airport traffic pattern as flown - downwind, base, final - within 1/2 mile of the runway, not just to straight-in approaches. Standard pattern legs at typical TPA distances stay inside the box.',
			},
			{
				letter: 'd',
				text: 'Land immediately and re-launch in the morning -- 91.155 has no exception for night Class G operations.',
				isCorrect: false,
				outcome: 'You miss out on a legal training opportunity by misremembering the exception.',
				whyNot:
					'The exception exists explicitly for this case. 91.155(b)(2): night Class G, 1/2 mile of runway, pattern, 1 SM clear of clouds.',
			},
		],
		teachingPoint:
			'The pattern exception in 91.155(b)(2) is narrow but real. It does NOT extend to cross-country operations near the field, departures past the 1/2 mile box, or daytime (which is already 1 SM clear of clouds anyway). Memorize as an exception, not as a rule.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.LANDING,
		regReferences: ['14 CFR 91.155'],
		nodeId: 'airspace-vfr-weather-minimums',
	},
	{
		title: 'Class E transition at 9,500 vs 10,500 MSL',
		situation:
			'You are crossing a mountainous segment at cruise. ATC suggests 10,500 MSL for VFR. The current reported visibility is 5 SM with scattered cloud tops near 9,000 and a layer of broken cirrus around 22,000. Your route at 10,500 will keep you between the lower scattered tops and the cirrus.',
		options: [
			{
				letter: 'a',
				text: 'Accept 10,500 MSL: 5 SM visibility meets Class E above 10,000 MSL minimums.',
				isCorrect: false,
				outcome: 'You take an altitude that puts you in the wrong VFR mins envelope by 500 ft.',
				whyNot:
					'14 CFR 91.155 requires 5 SM AT OR ABOVE 10,000 MSL. 10,500 MSL is above 10,000 MSL, so 5 SM is exactly the floor - but the cloud-clearance requirement is now 1,000/1,000/1 SM, and with cirrus broken at 22,000 your horizontal clearance to layered clouds becomes the constraint. Acceptance with no thought to that geometry is the trap.',
			},
			{
				letter: 'b',
				text: 'Decline 10,500, request 9,500 MSL: same VFR cruise direction parity, stays under the 10,000 MSL boundary, 3 SM and 500/1000/2000 mins apply.',
				isCorrect: true,
				outcome: 'You operate at the lower-mins regime and have margin against the cirrus layer.',
				whyNot: '',
			},
			{
				letter: 'c',
				text: 'Accept 10,500 MSL: the cirrus layer is at 22,000 so cloud clearance is not a factor.',
				isCorrect: false,
				outcome: 'You ignore that visibility above 10,000 must be 5 SM minimum.',
				whyNot:
					'The visibility requirement, not just the cloud clearance, changes at 10,000 MSL. 5 SM is the floor; if 5 SM is what you have, you are AT the limit, with no margin for haze thickening or sun-angle effects in cruise.',
			},
			{
				letter: 'd',
				text: 'Accept 10,500 MSL but plan to descend to 9,500 if visibility drops below 5 SM.',
				isCorrect: false,
				outcome: 'Reactive descent in cruise is not a plan; it is a justification.',
				whyNot:
					'Once you are above 10,000 MSL with 5 SM, any drop puts you immediately illegal. "Plan to descend" with no specific trigger or alternative is a thin defense for taking the higher cruise. Choose the altitude that is legal in the worst-case visibility you can foresee, not the best-case.',
			},
		],
		teachingPoint:
			'The 10,000 MSL cliff in 91.155 reflects the closure-rate change above the 250 kt speed cap of 91.117. When ATC offers a VFR cruise altitude, your job is to verify the entire envelope of mins applies - not just visibility, but cloud clearance and the trend in both. Cardinal rule: never accept an altitude whose mins you are at right now in cruise; build in margin.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.155', '14 CFR 91.117', '14 CFR 91.159'],
		nodeId: 'airspace-vfr-weather-minimums',
	},
	{
		title: 'Special VFR request -- Class D at dusk',
		situation:
			'You are arriving at a Class D primary airport at 1830 local, 30 minutes before official sunset. The tower reports 2 SM in haze, ceiling 800 broken. You are 8 NM out. You hold a Private Pilot Airplane Single-Engine Land certificate, no instrument rating. The airplane is IFR-equipped (you do not fly it IFR).',
		options: [
			{
				letter: 'a',
				text: 'Request Special VFR from the tower; daytime SVFR mins are 1 SM flight visibility, clear of clouds.',
				isCorrect: true,
				outcome: 'Tower issues SVFR and sequences you for landing.',
				whyNot: '',
			},
			{
				letter: 'b',
				text: 'Continue VFR and ask the tower for a SVFR amendment if you cannot find the airport.',
				isCorrect: false,
				outcome: 'You enter Class D without VFR mins, no SVFR, and now have a violation in progress.',
				whyNot:
					'You are not legal to enter Class D under basic VFR (3 SM, 500/1000/2000) given the report. Entering without a clearance is the violation; asking for SVFR after the fact does not retroactively cure it. Request SVFR before entering the surface area.',
			},
			{
				letter: 'c',
				text: 'Divert to the alternate; you are not instrument-rated and SVFR is not available to you.',
				isCorrect: false,
				outcome: 'You burn fuel on a diversion that was not actually required.',
				whyNot:
					'Daytime SVFR (until official sunset) is available to any properly certificated pilot in any properly equipped airplane (91.157). Night SVFR additionally requires the pilot to be instrument-rated and the airplane to be IFR-equipped. You are 30 minutes before sunset; daytime SVFR is on the table.',
			},
			{
				letter: 'd',
				text: 'Request Special VFR: night SVFR rules apply since it is dusk, requiring instrument rating and IFR equipment.',
				isCorrect: false,
				outcome: 'You unnecessarily reject SVFR by misreading the day/night line.',
				whyNot:
					'"Night" in 91.157 means after the end of evening civil twilight (per 91.151 / 14 CFR 1.1 night-flight definitions). Dusk before official sunset is daytime for SVFR purposes. Get a current sunset/twilight time, do not eyeball it.',
			},
		],
		teachingPoint:
			'SVFR is a tool for getting in and out of a surface area when basic VFR is not available there but escape margin exists. Daytime/night distinction is statutory: civil twilight, not subjective light level. Always request before you enter the surface area, never after.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.APPROACH,
		regReferences: ['14 CFR 91.157', '14 CFR 91.155', 'AIM 4-4-6'],
		nodeId: 'airspace-vfr-weather-minimums',
	},
	{
		title: 'Class G to Class E transition with descending ceiling',
		situation:
			'Cross-country at 2,500 MSL. Field elevation along your route averages 1,000 MSL. You are currently in Class G (Class E base 1,200 AGL) but in 12 NM you cross into a region with Class E base 700 AGL. Reported visibility 2.5 SM in haze, sky clear at the source station; the destination 25 NM ahead reports 3 SM, BKN015. Day VFR.',
		options: [
			{
				letter: 'a',
				text: 'Continue: 2.5 SM is below the 3 SM Class E requirement but you have 12 NM to descend or divert.',
				isCorrect: false,
				outcome: 'You acknowledge the bust ahead and continue toward it as a plan.',
				whyNot:
					'The bust is the moment you cross into the Class E airspace at 2.5 SM visibility. "I have time to fix it" is the wrong framing - the corrective action needs to be initiated NOW so you reach the boundary already legal.',
			},
			{
				letter: 'b',
				text: 'Descend now to 1,500 MSL (just below 700 AGL Class E base in the upcoming sector) and continue at Class G mins.',
				isCorrect: false,
				outcome: 'You drop to 500 AGL near terrain that may have obstructions and traffic.',
				whyNot:
					'14 CFR 91.119 requires 500 ft from any structure or person in non-congested areas, and 1,000 ft over congested areas. 1,500 MSL = 500 AGL with no margin for obstacles. Even if briefly legal as Class G mins, you are flirting with both 91.119 and CFIT terrain risk for the sake of a marginal-VFR cruise.',
			},
			{
				letter: 'c',
				text: 'Reverse course to a known-VFR field behind you, land, reassess.',
				isCorrect: true,
				outcome: 'You return to a field where mins are met and have full decision capacity on the ground.',
				whyNot: '',
			},
			{
				letter: 'd',
				text: 'Climb to 4,500 MSL to gain visibility from above the haze.',
				isCorrect: false,
				outcome:
					'Haze visibility from above looks better than slant-range visibility for landing; you have not solved the problem.',
				whyNot:
					'Haze layers commonly extend up to 6-8,000 MSL. Climbing into it usually does not improve flight visibility (haze is omnidirectional) and removes your ability to descend through it later if conditions worsen. The destination ceiling at 1,500 AGL still requires you to descend through that visibility floor for landing.',
			},
		],
		teachingPoint:
			'Airspace boundaries are altitude-dependent and the applicable mins change with terrain elevation under you. When the trend is "deteriorating" and the floor is approaching, the right move is reversal to known-good conditions, not lateral or vertical maneuvering inside the marginal envelope.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.ADVANCED,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.155', '14 CFR 91.119'],
		nodeId: 'airspace-vfr-weather-minimums',
	},

	// --- Airspace recognition + entry (6) ---
	{
		title: 'Two-way comm "established" -- Class C entry',
		situation:
			"Inbound to a Class C primary airport from 18 NM out at 4,500 MSL. You call: 'Cherokee 12345, 18 miles south, 4,500, with information Hotel.' The controller responds: 'Aircraft calling Approach, stand by.'",
		options: [
			{
				letter: 'a',
				text: 'Continue toward the Class C surface area; the response constitutes two-way communication established.',
				isCorrect: false,
				outcome: 'You enter without two-way comm established.',
				whyNot:
					'"Aircraft calling, stand by" does NOT use your full call sign and does not constitute two-way communication established (AIM 3-2-3, AIM 4-1-17). The controller has not acknowledged you specifically. Continue inbound and you are inside Class C illegally.',
			},
			{
				letter: 'b',
				text: 'Hold outside the surface area, repeat the call after 30-60 seconds, do not enter until the controller addresses you by call sign.',
				isCorrect: true,
				outcome: 'You wait for "Cherokee 12345, Approach, ..." before crossing the boundary.',
				whyNot: '',
			},
			{
				letter: 'c',
				text: 'Squawk 1200, do not enter Class C, divert to a non-towered satellite field underneath the shelf.',
				isCorrect: false,
				outcome: 'Unnecessary diversion before you have made even one more call.',
				whyNot:
					'"Aircraft calling, stand by" is not a denial - it is a "wait." The standard procedure is to hold off and try again, not to abort the destination.',
			},
			{
				letter: 'd',
				text: 'Enter Class C; FAR 91.130 only requires the pilot to attempt two-way communication, not to receive a confirmation.',
				isCorrect: false,
				outcome: 'You enter without comm established.',
				whyNot:
					"14 CFR 91.130(c)(1) requires two-way communication BE ESTABLISHED, not merely attempted. The longstanding FAA interpretation: the controller must respond using the aircraft's call sign before the aircraft may enter (AIM 3-2-3, AIM 4-1-17).",
			},
		],
		teachingPoint:
			'Class C is "comm established," NOT "comm attempted." The legal test: did the controller acknowledge you by full or partial call sign? "Cherokee 345, stand by" -> yes. "Aircraft calling, stand by" -> no. When in doubt, hold outside the boundary and retry.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.BEGINNER,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.130', 'AIM 3-2-3', 'AIM 4-1-17'],
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		title: 'Mode C veil -- transponder failure at 8 NM',
		situation:
			'You are 8 NM from a Class B primary airport at 4,500 MSL, en route to a satellite field. Your Mode C transponder fails (no altitude reporting). ADS-B Out is operational. You are inside the 30 NM Mode C veil. Class B floor in this sector is 4,000 MSL.',
		options: [
			{
				letter: 'a',
				text: 'Continue: ADS-B Out provides the position and altitude data Mode C would have, so the spirit of 91.215 is met.',
				isCorrect: false,
				outcome: 'You continue under a transponder-failure case without coordinating with ATC.',
				whyNot:
					'14 CFR 91.215(d) does provide deviation authority - but only via ATC authorization. ADS-B Out being operational is operationally relevant but not a unilateral substitute. The pilot must REQUEST a deviation; you have not.',
			},
			{
				letter: 'b',
				text: 'Squawk 7600, descend below 1,200 AGL where the Mode C veil does not apply.',
				isCorrect: false,
				outcome:
					'Squawking 7600 (lost comm) misrepresents the failure type, and the Mode C veil applies regardless of altitude up to 10,000 MSL.',
				whyNot:
					'7600 is for two-way comm failure, not transponder failure. The Mode C veil applies from the surface to 10,000 MSL within 30 NM (91.215(b)(2)) - "below 1,200 AGL" is irrelevant. There is no reading of the rule that lets you descend out of it.',
			},
			{
				letter: 'c',
				text: 'Contact ATC, declare the transponder failure, request a deviation per 91.215(d), and proceed as authorized.',
				isCorrect: true,
				outcome: 'ATC authorizes a route or altitude that accommodates the failure.',
				whyNot: '',
			},
			{
				letter: 'd',
				text: 'Land at the nearest airport immediately; transponder failure inside the Mode C veil mandates a precautionary landing.',
				isCorrect: false,
				outcome: 'Overreaction. The reg has a specific deviation path that does not require an emergency landing.',
				whyNot:
					'91.215(d) provides for ATC-authorized deviation in transponder failure, including continued operation outside or to the destination. A precautionary landing is reserved for cases where deviation is not granted or where airworthiness is otherwise compromised.',
			},
		],
		teachingPoint:
			"91.215(d) is the textbook 'request a deviation from ATC' case. The pilot's job is to communicate the failure, ask for the deviation, and comply with the issued instructions. ADS-B Out being operational is good news but is not self-authorizing; ATC is the gatekeeper.",
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.215', '14 CFR 91.225'],
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		title: 'Restricted area -- "is it active right now?"',
		situation:
			"You are planning a VFR flight that crosses R-2515 (a charted restricted area). The chart shows the operating times as 'Continuous, by NOTAM.' Your most recent FAA NOTAM check shows no active NOTAM affecting R-2515 today. Briefer 2 hours ago confirmed cold.",
		options: [
			{
				letter: 'a',
				text: 'Plan the route through R-2515: cold is cold, briefing confirms it.',
				isCorrect: false,
				outcome: 'Status changes happen and "cold 2 hours ago" is not "cold now."',
				whyNot:
					'Restricted areas can activate on short notice. The standard practice for "Continuous, by NOTAM" airspace is to verify status with the controlling agency immediately before transit, then maintain comm with the controlling ARTCC, not just rely on a 2-hour-old briefing.',
			},
			{
				letter: 'b',
				text: 'Plan the route around R-2515; it is not worth the workload regardless of status.',
				isCorrect: false,
				outcome: 'You add unnecessary distance/fuel for a legitimately legal transit.',
				whyNot:
					'When the area is verified cold, transit is fully legal and a reasonable savings of distance/fuel/time. "Always avoid" is overcautious and removes a tool from your toolkit; the right standard is "verify just before, communicate during."',
			},
			{
				letter: 'c',
				text: 'Plan the route through R-2515; en route, contact the controlling ARTCC to verify status before crossing the boundary, and continue if cold or reroute if hot.',
				isCorrect: true,
				outcome: 'You verify in real time and either transit or divert based on what is actually true.',
				whyNot: '',
			},
			{
				letter: 'd',
				text: 'File IFR for the trip; restricted areas only restrict VFR operations.',
				isCorrect: false,
				outcome: 'IFR does not auto-grant access to restricted areas.',
				whyNot:
					'Restricted areas (14 CFR 73, 91.133) restrict ALL operations, IFR or VFR, when active. ATC will route IFR around active restricted areas; filing IFR does not give you a magic key.',
			},
		],
		teachingPoint:
			'"Continuous, by NOTAM" restricted areas require live verification, not historical. The standard discipline: pre-flight check, contact the controlling agency en route, get a real-time confirmation. Cold restricted areas are LEGAL to transit; the obligation is on the pilot to confirm status, not to avoid them reflexively.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.PREFLIGHT,
		regReferences: ['14 CFR 73.13', '14 CFR 91.133', 'AIM 3-4-3'],
		nodeId: 'airspace-special-use',
	},
	{
		title: 'TFR pop-up -- presidential movement',
		situation:
			"You are 35 NM into a 60 NM cross-country at 4,500 MSL. ATC contacts you on flight following: 'Cherokee 12345, advisories: a 30 NM radius TFR has just been issued centered on the destination airport, surface to 17,999. Effective 30 minutes from now.'",
		options: [
			{
				letter: 'a',
				text: 'Continue at current speed; you will arrive 8 minutes before the TFR effective time, well within margin.',
				isCorrect: false,
				outcome: '8 minutes is not an operational margin -- it is the entire cushion.',
				whyNot:
					'TFR effective times are firm and the issuing authority can amend them earlier. An 8-minute margin assumes nothing changes, including wind, ATC sequencing, or amendment of the TFR. The arithmetic is too tight for an unrecoverable bust.',
			},
			{
				letter: 'b',
				text: 'Land at the nearest suitable airport NOW, well outside the eventual TFR; reassess on the ground.',
				isCorrect: true,
				outcome: 'You land with margin and decide on next leg with full information.',
				whyNot: '',
			},
			{
				letter: 'c',
				text: 'Reverse course back to the departure field, expecting the TFR will be lifted in a few hours.',
				isCorrect: false,
				outcome: 'Burn fuel for the round trip when a closer landing is available.',
				whyNot:
					'Reverse to departure is fine if no closer suitable field exists, but in this scenario you are already 35 NM into the trip and there are likely closer airports. Choose the option that minimizes time-to-ground when a TFR is closing in.',
			},
			{
				letter: 'd',
				text: 'Climb above 17,999 to overfly the TFR at FL180+.',
				isCorrect: false,
				outcome: 'FL180 requires Class A (IFR), an instrument rating, and clearance you do not have.',
				whyNot:
					'14 CFR 71.33 / 91.135: at and above 18,000 MSL is Class A, IFR-only, requires an IFR clearance. A VFR pilot in a piston single is not climbing into Class A. The "surface to 17,999" TFR shape is built precisely to deny that escape.',
			},
		],
		teachingPoint:
			"Pop-up TFRs (presidential movement, security, disaster response) issue with little notice. The pilot's first move is to maximize ground time before effective: the field you can reach in 10 minutes is better than the field you might reach in 40. Once on the ground, full information replaces guesswork.",
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.ADVANCED,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.137', '14 CFR 91.141', '14 CFR 99.7'],
		nodeId: 'airspace-special-use',
	},
	{
		title: 'Class D after tower closes',
		situation:
			"You arrive at a Class D primary airport at 2230 local. The tower closed at 2200 local (charted as 'Tower 1200-2200'). The ATIS still broadcasts. Visibility 10, sky clear, wind 280 at 8.",
		options: [
			{
				letter: 'a',
				text: 'Class D rules still apply: contact the tower frequency for entry clearance.',
				isCorrect: false,
				outcome: 'Tower is closed; nobody is listening on the tower freq.',
				whyNot:
					"When the tower is closed, the airspace reverts (typically to Class E or Class G depending on the chart). The Class D label only applies during the tower's published operating hours.",
			},
			{
				letter: 'b',
				text: 'Class D rules no longer apply; treat the airspace as Class E or Class G per the chart, broadcast intentions on CTAF.',
				isCorrect: true,
				outcome: 'You enter under uncontrolled-field procedures.',
				whyNot: '',
			},
			{
				letter: 'c',
				text: 'Class D rules still apply but become "advisory" -- announce on tower freq for the controller staffing the closeout shift.',
				isCorrect: false,
				outcome: 'There is no advisory tower mode and no closeout staffing.',
				whyNot:
					'The tower is either open (Class D rules with an active controller) or closed (airspace reverts). There is no in-between. The Chart Supplement and AFD entries spell out the operating hours.',
			},
			{
				letter: 'd',
				text: "Land using a straight-in 27 approach without a CTAF call -- without a tower, runway selection is the pilot's choice and the field is empty by visual inspection.",
				isCorrect: false,
				outcome: 'You skip the standard non-towered procedures and risk a NORDO conflict.',
				whyNot:
					'Non-towered field procedure is to broadcast position/intentions on CTAF (AIM 4-1-9), use the standard left traffic pattern unless otherwise published, and listen for other traffic. "Field looks empty" is not a substitute - other aircraft may be NORDO, low, or arriving from a non-visible quadrant.',
			},
		],
		teachingPoint:
			"Tower hours are part of the airspace definition. When the tower is closed, the airspace reverts to whatever the chart shows beneath the Class D box -- look for the magenta dashed (Class E surface) or the magenta vignette (Class E starting at 700 AGL) or no shading (Class G). Always plan ahead for whether you'll arrive before or after tower closure.",
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.BEGINNER,
		phaseOfFlight: PHASES_OF_FLIGHT.APPROACH,
		regReferences: ['14 CFR 91.129', 'AIM 3-2-5', 'AIM 4-1-9'],
		nodeId: 'airspace-classes-and-dimensions',
	},
	{
		title: 'Reading airspace from a sectional -- magenta vignette',
		situation:
			'You are flight planning over an area on a sectional chart. The chart shows a magenta vignetted boundary (faded magenta band, no dashed line) surrounding the planned route. There is no airport symbol within. Your planned cruise is 2,500 MSL; field elevations along the route average 800 MSL.',
		options: [
			{
				letter: 'a',
				text: 'Magenta vignette = Class E starting at 700 AGL. At 2,500 MSL = 1,700 AGL, you are in Class E. VFR mins 3 SM / 500-1000-2000.',
				isCorrect: true,
				outcome: 'Correct interpretation; plan VFR mins accordingly.',
				whyNot: '',
			},
			{
				letter: 'b',
				text: 'Magenta vignette = Class E starting at the surface. At 2,500 MSL you are in Class E. Same mins.',
				isCorrect: false,
				outcome: 'You confuse vignette with dashed line; the surface-area Class E is the wrong reading.',
				whyNot:
					'Magenta DASHED line = Class E surface area. Magenta VIGNETTE (faded shading) = Class E base 700 AGL. Different shape on the chart, different floor; mixing them up means you assume controlled airspace begins at the ground when it actually starts above you.',
			},
			{
				letter: 'c',
				text: 'Magenta vignette = Class G airspace boundary. At 2,500 MSL you are in Class G. VFR mins 1 SM / clear of clouds (day).',
				isCorrect: false,
				outcome: 'You assume Class G when you are in Class E and apply the wrong VFR mins.',
				whyNot:
					'Magenta vignette IS controlled airspace; the inside of the vignette is Class E from 700 AGL. The Class G in this area lies BELOW the 700 AGL Class E base, not at cruise altitude.',
			},
			{
				letter: 'd',
				text: 'Magenta vignette = Class B / Class C airspace floor. At 2,500 MSL, you are below it. Apply Class G mins.',
				isCorrect: false,
				outcome: 'You confuse two unrelated chart conventions.',
				whyNot:
					'Class B is a solid blue boundary with floor/ceiling labels in shelves. Class C is solid magenta with shelf annotations. Magenta vignette is specifically the Class E base 700 AGL convention.',
			},
		],
		teachingPoint:
			'Reading sectional charts well is a skill in itself. Magenta dashed = Class E surface area. Magenta vignette = Class E base 700 AGL. Blue vignette = Class E base 1,200 AGL. Solid blue = Class B. Solid magenta = Class C. Solid black with magenta tick marks = Class D. Memorize the symbology so you can read airspace from the chart in 2 seconds, not 30.',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.BEGINNER,
		phaseOfFlight: PHASES_OF_FLIGHT.PREFLIGHT,
		regReferences: ['Chart User Guide (FAA)', 'AIM 3-2'],
		nodeId: 'airspace-classes-and-dimensions',
	},

	// --- Emergency Procedures (4) ---
	{
		title: 'EFATO at 400 AGL on a 5,000 ft runway',
		situation:
			"You depart RWY 36 (5,000 ft long) in a Cessna 172 at near-gross weight. Density altitude is 4,500 ft. At 400 AGL on the upwind, the engine produces a sudden, severe power loss to roughly 30%. You are 50 ft above the trees ahead, with open fields to the left and right and a road off the nose at about 11 o'clock.",
		options: [
			{
				letter: 'a',
				text: 'Turn back to RWY 18 -- you have 400 AGL and the runway is right behind you.',
				isCorrect: false,
				outcome: 'Stall-spin during the 180. The "impossible turn" failure mode.',
				whyNot:
					'400 AGL is well below the typical break-even altitude for a 172 to complete a 180-degree return at 4,500 ft DA. Pilots reflexively pull during the turn, drop below best glide, and stall in the bank. This is the highest-fatality emergency-handling error in light aircraft.',
			},
			{
				letter: 'b',
				text: 'Continue straight ahead, modify the flight path within 30 degrees of the nose, pick the best survivable surface (open field), best glide, land.',
				isCorrect: true,
				outcome: 'Controlled forced landing into a survivable surface.',
				whyNot: '',
			},
			{
				letter: 'c',
				text: 'Aggressively pull up to trade airspeed for altitude, gain enough altitude to make a normal pattern back to RWY 36.',
				isCorrect: false,
				outcome: 'Energy management failure; you stall.',
				whyNot:
					'A "zoom climb" trades airspeed for altitude one-for-one only at 100% efficiency, and you cannot get above stall speed at the apex with 30% power. You arrive at the apex with no airspeed and no altitude margin.',
			},
			{
				letter: 'd',
				text: 'Push over to maintain best-glide and try a low-altitude restart attempt while gliding straight ahead.',
				isCorrect: false,
				outcome:
					'Restart attempts at low altitude burn the most precious resource (altitude) without solving the immediate problem.',
				whyNot:
					'A 30% power loss is producing thrust but is not landable cruise power. Step 1 is "fly the airplane and pick a field." Restart attempts (carb heat, mixture, mag check) come AFTER the field is picked and the airplane is configured for landing. Wrong order.',
			},
		],
		teachingPoint:
			'EFATO doctrine: land within 30 degrees of straight ahead unless the aircraft is at or above the break-even altitude AND the pilot has demonstrated the maneuver. Best glide -> field -> restart attempts -> committed landing. Aviate before troubleshooting. AC 61-83K Topic 5; AOPA "Impossible Turn" research.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.ADVANCED,
		phaseOfFlight: PHASES_OF_FLIGHT.TAKEOFF,
		regReferences: ['14 CFR 91.3', 'AC 61-83K', 'PHAK Ch 17'],
		nodeId: 'proc-engine-failure-after-takeoff',
	},
	{
		title: 'Partial power loss in cruise -- magneto miss',
		situation:
			'Cruise at 6,500 MSL over flat farmland. The engine develops a rough running condition; RPM drops 200 below nominal. Carb-heat application produces no change. Switching to L mag produces a further drop and significant roughness. R mag alone produces moderate roughness with the same 200 RPM deficit. The fuel pressure and oil temp are normal.',
		options: [
			{
				letter: 'a',
				text: 'Run on the better mag (R), declare an emergency, divert to the nearest suitable airport.',
				isCorrect: true,
				outcome: 'You preserve as much power as available and land at a known airport.',
				whyNot: '',
			},
			{
				letter: 'b',
				text: 'Stay on BOTH; the engine is producing more power on BOTH than on either single mag.',
				isCorrect: false,
				outcome: 'You ignore the diagnostic information that says one mag is failed.',
				whyNot:
					'A magneto miss in flight indicates one mag system has failed (fouled plug, broken lead, internal mag failure). Continuing on BOTH means the failed mag is still wired in; if its failure mode is "intermittent firing," it can foul a cylinder fully and propagate. Single-mag operation removes the failed system. The single-mag RPM drop is the diagnostic, not the operating point.',
			},
			{
				letter: 'c',
				text: 'Apply full mixture rich and continue at altitude; the issue may clear with richer combustion.',
				isCorrect: false,
				outcome: 'You delay the diversion while running on a known-failing mag system.',
				whyNot:
					'Partial-power doctrine: treat as a forced landing in slow motion. Once the mag has identified the failure, the priority is to get to ground at a chosen airport, not to extend cruise time hoping it clears. Mixture adjustment is a possible cause for some roughness but does not resolve a mag failure.',
			},
			{
				letter: 'd',
				text: 'Reduce throttle to idle and pitch for best glide; you have 6,500 ft AGL of altitude to glide to a runway.',
				isCorrect: false,
				outcome: 'Throwing away thrust prematurely converts a divert to a forced landing.',
				whyNot:
					'The engine is still producing power, just at reduced output and roughness. Throttling to idle voluntarily gives up the residual thrust you could use to extend glide range or maintain altitude over rougher terrain. The "treat partial power as failure" advice does NOT mean "shut the engine down"; it means "do not gamble that it will recover."',
			},
		],
		teachingPoint:
			'Partial power loss is more dangerous than complete failure because it preserves the illusion of options. Doctrine: pick a field NOW (or a divert airport, given altitude), use whatever thrust the engine still gives you to extend, and prepare for the engine to quit at any moment. Mag failure specifically: run on the better mag, divert, do not "fix it" in the air.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.ADVANCED,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.3', 'PHAK Ch 7', 'C172 POH'],
		nodeId: null,
	},
	{
		title: 'Smoke in the cockpit at 4,000 MSL',
		situation:
			'You are at 4,000 MSL in cruise. White smoke begins to come from behind the panel. No visible fire. Smell is electrical (burning insulation). Avionics master is on; the GPS, autopilot, and com radios are operating normally.',
		options: [
			{
				letter: 'a',
				text: 'MASTER OFF immediately; declare emergency on a backup com or 121.5; descend; vent the cabin; if smoke clears, attempt selective restoration via individual breakers.',
				isCorrect: true,
				outcome: 'Source of fire energy removed; smoke clears; controlled descent and divert.',
				whyNot: '',
			},
			{
				letter: 'b',
				text: 'Pull individual breakers one at a time until the smoke source is identified, leaving the master on so the radios stay up.',
				isCorrect: false,
				outcome: 'Smoke continues to propagate while you methodically isolate.',
				whyNot:
					'Time-to-fire-out is the critical variable. Pulling individual breakers takes minutes; killing the master is one action and removes ALL bus power immediately. C172 POH and most light-aircraft POHs are explicit: master off is item 1 of the electrical fire checklist precisely because diagnosing while it spreads is the wrong trade.',
			},
			{
				letter: 'c',
				text: 'Turn off the avionics master only; that should isolate the radio stack which is the most likely source.',
				isCorrect: false,
				outcome: 'You assume diagnosis without evidence; the source could be elsewhere on the bus.',
				whyNot:
					'Avionics master only kills the avionics bus. The source could be elsewhere (alternator, regulator, lighting, pitot heat, autopilot servo). Until you know, kill all of it. Avionics master alone is selective; main master is decisive.',
			},
			{
				letter: 'd',
				text: "Open the door slightly to vent the smoke and continue to the destination -- it's only 18 NM out.",
				isCorrect: false,
				outcome: 'Smoke continues to be generated faster than it vents; you are gambling.',
				whyNot:
					'"It is only 18 NM out" is the textbook get-there-itis framing in an emergency. The right answer is to land at the NEAREST suitable airport, not the planned destination. Venting is a comfort measure; it does not solve the source of the fire.',
			},
		],
		teachingPoint:
			'Electrical fire memory item: MASTER OFF first. The energy source is electrical current; remove that and the fire stops feeding. Comm and navigation losses are recoverable; an in-flight cabin fire is not. POH section 3 (Emergency Procedures) for the specific airplane controls the exact step list, but every light-aircraft POH agrees on master-off-first.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.3', 'C172 POH §3', 'PHAK Ch 17'],
		nodeId: null,
	},
	{
		title: 'Alternator failure -- low voltage on a night cross-country',
		situation:
			'Night cross-country at 7,500 MSL, 65 NM into a 110 NM trip. The ALT light illuminates and the ammeter shows discharge. Voltmeter reads 12.4 V and dropping. Outside is dark; nearest airport is 18 NM behind, next-nearest is 28 NM ahead at the destination. Battery is older but condition is unknown to the pilot. No icing.',
		options: [
			{
				letter: 'a',
				text: 'Continue 28 NM to the destination -- the battery should hold for that distance and you have flight following on com1.',
				isCorrect: false,
				outcome: 'The battery may not hold; voltage is already dropping.',
				whyNot:
					'Battery time at full draw can be as short as 20 minutes for an older or undersized battery. 28 NM at typical 110 KGS is roughly 15 minutes -- with no margin for slowdown, sequencing, or holding. The 18 NM divert behind is closer AND known. Choosing the longer leg banks on best-case battery condition.',
			},
			{
				letter: 'b',
				text: 'Reverse to the 18 NM airport behind; shed non-essential loads (autopilot, NAV2, COM2, panel/landing lights until needed); declare an emergency; land.',
				isCorrect: true,
				outcome: 'You arrive with battery margin and on a known field.',
				whyNot: '',
			},
			{
				letter: 'c',
				text: 'Reset the alternator field switch (off/on) and continue current heading; if it does not reset within 30 seconds, then divert.',
				isCorrect: false,
				outcome: '30 seconds of "wait and see" while voltage drops further is not a plan.',
				whyNot:
					"An alternator field reset is a legitimate POH step (C172 POH lists it for ALT light troubleshooting). The mistake is in keeping the destination as the plan while you do it -- if the reset fails, the resulting battery time is now smaller because you've burned 30 seconds at full load. Set up the divert FIRST, troubleshoot WHILE diverting.",
			},
			{
				letter: 'd',
				text: 'Climb to extend glide range to the destination in case of a total electrical loss followed by an engine event.',
				isCorrect: false,
				outcome: 'You add workload, fuel burn, and oxygen exposure for a non-existent threat.',
				whyNot:
					'Electrical failure does not cause an engine-driven failure in a piston aircraft -- the magnetos run independently of the bus. The right concern is "no radios, no transponder, no nav, no panel lighting in the dark," not engine reliability. Climbing has no bearing on those concerns.',
			},
		],
		teachingPoint:
			'Alternator failure on a night cross-country is a time-pressured divert decision. Battery time is finite and unknown; the right answer is to shed loads aggressively, divert to the nearest suitable, and not try to push the destination unless it is genuinely the closest field. Communicate while you still have radios; once the battery dies, you are NORDO and unlit in the dark.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.CRUISE,
		regReferences: ['14 CFR 91.3', '14 CFR 91.205', 'C172 POH §3'],
		nodeId: null,
	},
];
