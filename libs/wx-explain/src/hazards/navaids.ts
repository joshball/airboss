/**
 * Lightweight VOR navaid lookup for hazard FROM-point decoding.
 *
 * Convective SIGMETs / SVRs reference 3-letter VOR identifiers
 * (e.g. ENE = Kennebunk, ME). The decoder uses this map to enrich
 * FROM-points with the human-readable VOR name. Coverage focuses on
 * the navaids that anchor convective-SIGMET bulletins (CONUS).
 *
 * This is not a complete navaid registry; that lives in NASR data
 * (libs/spatial-engine/src/geography/) once it grows past the
 * xc-viewer seed regions. For now keep this list narrow and accurate;
 * unknown identifiers fall back to the raw token.
 */

interface NavaidLookup {
	name: string;
	stateOrRegion: string;
}

const NAVAIDS: Record<string, NavaidLookup> = {
	// Northeast
	ACK: { name: 'Nantucket', stateOrRegion: 'MA' },
	ALB: { name: 'Albany', stateOrRegion: 'NY' },
	BGR: { name: 'Bangor', stateOrRegion: 'ME' },
	BOS: { name: 'Boston', stateOrRegion: 'MA' },
	BWZ: { name: 'New Bedford', stateOrRegion: 'MA' },
	CMK: { name: 'Carmel', stateOrRegion: 'NY' },
	ENE: { name: 'Kennebunk', stateOrRegion: 'ME' },
	HFD: { name: 'Hartford', stateOrRegion: 'CT' },
	HTO: { name: 'Hampton', stateOrRegion: 'NY' },
	HUO: { name: 'Huguenot', stateOrRegion: 'NY' },
	JFK: { name: 'Kennedy', stateOrRegion: 'NY' },
	MPV: { name: 'Montpelier', stateOrRegion: 'VT' },
	MSS: { name: 'Massena', stateOrRegion: 'NY' },
	PVD: { name: 'Providence', stateOrRegion: 'RI' },
	PWM: { name: 'Portland', stateOrRegion: 'ME' },
	SAX: { name: 'Sparta', stateOrRegion: 'NJ' },
	SYR: { name: 'Syracuse', stateOrRegion: 'NY' },

	// Mid-Atlantic / Appalachia
	BVT: { name: 'Bradford', stateOrRegion: 'PA' },
	DCA: { name: 'Washington National', stateOrRegion: 'DC' },
	EKN: { name: 'Elkins', stateOrRegion: 'WV' },
	GQO: { name: 'Chattanooga', stateOrRegion: 'TN' },
	IAD: { name: 'Dulles', stateOrRegion: 'VA' },
	MRB: { name: 'Martinsburg', stateOrRegion: 'WV' },
	PSB: { name: 'Philipsburg', stateOrRegion: 'PA' },

	// Southeast
	CEW: { name: 'Crestview', stateOrRegion: 'FL' },
	CHS: { name: 'Charleston', stateOrRegion: 'SC' },
	EYW: { name: 'Key West', stateOrRegion: 'FL' },
	MGM: { name: 'Montgomery', stateOrRegion: 'AL' },
	MIA: { name: 'Miami', stateOrRegion: 'FL' },
	MLB: { name: 'Melbourne', stateOrRegion: 'FL' },
	MSL: { name: 'Muscle Shoals', stateOrRegion: 'AL' },
	OMN: { name: 'Ormond Beach', stateOrRegion: 'FL' },
	ORL: { name: 'Orlando', stateOrRegion: 'FL' },
	PBI: { name: 'Palm Beach', stateOrRegion: 'FL' },
	SAV: { name: 'Savannah', stateOrRegion: 'GA' },
	TLH: { name: 'Tallahassee', stateOrRegion: 'FL' },
	TRV: { name: 'Treasure', stateOrRegion: 'FL' },

	// Great Lakes / Midwest
	ASP: { name: 'Oscoda', stateOrRegion: 'MI' },
	BDF: { name: 'Bradford', stateOrRegion: 'IL' },
	DXO: { name: 'Detroit', stateOrRegion: 'MI' },
	FWA: { name: 'Fort Wayne', stateOrRegion: 'IN' },
	IND: { name: 'Indianapolis', stateOrRegion: 'IN' },
	LAN: { name: 'Lansing', stateOrRegion: 'MI' },
	ORD: { name: "O'Hare", stateOrRegion: 'IL' },
	STL: { name: 'St Louis', stateOrRegion: 'MO' },

	// Central / Plains
	DDD: { name: 'Port City', stateOrRegion: 'TX' },
	DSM: { name: 'Des Moines', stateOrRegion: 'IA' },
	MCI: { name: 'Kansas City', stateOrRegion: 'MO' },
	MSP: { name: 'Minneapolis', stateOrRegion: 'MN' },
	OKC: { name: 'Oklahoma City', stateOrRegion: 'OK' },
	OMA: { name: 'Omaha', stateOrRegion: 'NE' },
	SLN: { name: 'Salina', stateOrRegion: 'KS' },
	TUL: { name: 'Tulsa', stateOrRegion: 'OK' },

	// West / Mountain
	BIL: { name: 'Billings', stateOrRegion: 'MT' },
	DEN: { name: 'Denver', stateOrRegion: 'CO' },
	GEG: { name: 'Spokane', stateOrRegion: 'WA' },
	LAS: { name: 'Las Vegas', stateOrRegion: 'NV' },
	LAX: { name: 'Los Angeles', stateOrRegion: 'CA' },
	PDX: { name: 'Portland', stateOrRegion: 'OR' },
	PHX: { name: 'Phoenix', stateOrRegion: 'AZ' },
	SEA: { name: 'Seattle', stateOrRegion: 'WA' },
	SFO: { name: 'San Francisco', stateOrRegion: 'CA' },
	SLC: { name: 'Salt Lake City', stateOrRegion: 'UT' },
};

/** Returns the navaid lookup for an identifier, or null when unknown. */
export function lookupNavaid(id: string): NavaidLookup | null {
	return NAVAIDS[id.toUpperCase()] ?? null;
}
