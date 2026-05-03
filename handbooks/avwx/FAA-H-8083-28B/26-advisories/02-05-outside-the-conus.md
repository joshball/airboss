---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 26
section_title: Outside the CONUS
faa_pages: 26-11..26-14
section_number: 2
subsection_number: 5
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Outside the CONUS

26.2.4.2.6 Convective SIGMET Cancellations
Convective SIGMETs are not cancelled but are superseded by the next Convective SIGMET in the series.
26.2.4.2.7 Convective SIGMET Amendments
Amended Convective SIGMETs are not issued. Instead, a new Convective SIGMET is issued for that
region.
26.2.4.2.8 Convective SIGMET Corrections
Corrections to Convective SIGMETs are issued as necessary. The corrected Convective SIGMET is
identified by a “COR” located at the end of the first line after the issuance UTC date/time.
26.2.5 Outside the CONUS
26.2.5.1 SIGMET Issuance Criteria—Outside the CONUS
U.S. SIGMETs outside the CONUS are issued when any of the following conditions affect or, in the
judgment of the forecaster, are expected to affect an area judged to have a significant impact on the safety
of aircraft operations:
Thunderstorm—of type below:*
o Obscured (OBSC TS).
o Embedded (EMBD TS).
o Widespread (WDSPR TS).
o Squall line (SQL TS).
o Isolated severe (ISOL SEV TS).
Severe turbulence (SEV TURB).
Severe icing (SEV ICE); with freezing rain (SEV ICE (FZRA)).
Widespread dust storm (WDSPR DS).
Widespread sandstorm (WDSPR SS).
Volcanic ash (VA).
Tropical cyclone (TC).
*Tornado (TDO), funnel cloud (FC), waterspout (WTSPT), and heavy hail (HVY GR) may be used as
further descriptions of the thunderstorm, as necessary.
26.2.5.2 SIGMET Issuance Time and Valid Period—Outside the CONUS
A SIGMET is an unscheduled product issued any time conditions reaching SIGMET criteria are occurring
or expected to occur within a four-hour period. A SIGMET outside the CONUS can have a valid period up
to, but not exceeding, four hours, except for volcanic ash (VA) and tropical cyclone (TC), which can be
valid up to six hours. SIGMETs for continuing phenomena will be reissued at least every four (or six) hours
as long as SIGMET conditions continue to occur in the area of responsibility.

26.2.5.3 SIGMET Format and Example—Outside the CONUS
SIGMETs outside the CONUS contain the following information, related to the specific phenomena and in
the order indicated:
Phenomenon and its description (e.g., SEV TURB).
An indication whether the information is observed, using “OBS” and/or “FCST.” The time of
observation will be given in UTC.
Location of the phenomenon referring to, where possible, the latitude and longitude and FLs
(altitude) covering the affected area during the SIGMET valid time. SIGMETs for volcanic ash
clouds and tropical cyclones contain the positions of the ash cloud, tropical cyclone center, and
radius of convection at the start of the valid time of the SIGMET.
Movement toward or expected movement using 16 points of the compass, with speed in knots, or
stationary, if appropriate.
Thunderstorm maximum height as FL.
Changes in intensity, using, as appropriate, the abbreviations for intensifying (INTSF), weakening
(WKN), or no change (NC).
Forecast position of the volcanic ash cloud or the center of the tropical cyclone at the end of the
validity period of the SIGMET message.

Figure 26-7. SIGMET Outside the CONUS—Example

Table 26-3. Decoding a SIGMET Outside of the CONUS
Line
Content
Description
WSPA07
ICAO communication header
PHFO
Issuance MWO
Issuance UTC date/time
SIGPAT
NWS AWIPS communication
header
KZAK
Area control center
Product type
TANGO
SIGMET series
Issuance number
VALID 010410/010800
Valid period UTC date/time
PHFO
Issuance office
OAKLAND OCEANIC FIR
FIR
FRQ TS OBS AND FCST WI 200NM
N3006 W14012 - N2012 W15016 CB
TOP FL400 MOV W 10KT WKN.
Phenomenon description
The SIGMET in Figure 26-7 is decoded as the following:
(Line 1) The WMO product header is WSPA07. Issued by the Honolulu MWO on the first day of
the month at 0410 UTC.
(Line 2) The NWS Advanced Weather Interactive Processing System (AWIPS) communication
header is SIGPAT.
(Line 3) For the Oakland ARTCC (KZAK). This is the second issuance of SIGMET Tango series,
valid from the 1st day of the month at 0410 UTC until the 1st day of the month at 0800 UTC, issued
by the Honolulu MWO.
(Line 4) Concerning the Oakland Oceanic FIR, frequent thunderstorms observed and forecast
within 200 NM of 30° and 6 minutes north; 140° and 12 minutes west; to 20° and 12 minutes north,
150° and 16 minutes west, cumulonimbus tops to FL400 moving west at 10 kt, weakening.
26.2.5.4 SIGMETs for Volcanic Ash (VA)—Outside the CONUS
A SIGMET for a volcanic ash cloud is issued for volcanic eruptions. A volcanic eruption is any volcanic
activity, including the emission of volcanic ash, regardless of the eruption’s magnitude. Initial volcanic ash
SIGMETs may be issued based on credible PIREPs in the absence of a VAA but are updated once a VAA
is issued. Volcanic ash SIGMETs will continue to be issued until the ash cloud is no longer occurring or
expected to occur.
SIGMETs for a volcanic ash cloud are valid up to six hours and provide an observed or forecast location of
the ash cloud at the beginning of the SIGMET. A six-hour forecast position for the ash cloud, valid at the
end of the validity period of the SIGMET message, is also included.

26.2.5.5 SIGMETs for Tropical Cyclone (TC)—Outside the CONUS
SIGMETs for a tropical cyclone (which includes a hurricane, typhoon (western Pacific), and tropical storm)
may be issued for non-frontal synoptic-scale cyclones meeting the following criteria:
Originates over tropical or subtropical waters with organized convection and definite cyclonic
surface wind circulation.
Wind speeds reach 35 kt independent of the wind averaging time used by the TCAC.
SIGMETs for tropical cyclones will be valid up to six hours. SIGMETs for tropical cyclones will include
two positions. The first position will be the observed position of the center of the tropical cyclone, taken
from the TCA. The second position will be the forecast position of the center of the tropical cyclone valid
at the end of the SIGMET period, which will coincide with the six-hour forecast position in the TCA.
In addition to the two storm positions, SIGMETs will include associated convection when applicable.
SIGMETs will be reissued at least every six hours while the tropical cyclone winds remain or are expected
to remain above 34 kt.
26.2.5.6 SIGMET Cancellation—Outside the CONUS
SIGMETs are cancelled when the phenomenon is no longer occurring or expected to occur.
26.2.5.7 SIGMET Amendments—Outside the CONUS
SIGMET amendments will not be issued. Instead, the next SIGMET in the series is issued to accomplish
the update. The valid time of the new SIGMET is reset to reflect the new four-hour valid period (six-hour
period for volcanic ash and tropical cyclone SIGMETs).
26.2.5.8 SIGMET Corrections—Outside the CONUS
Corrections to SIGMETs are issued as necessary. This is done by issuing a new SIGMET in the series,
which advances the SIGMET number and cancels the previous SIGMET.
26.2.5.8.1 SIGMET for Volcanic Ash Example—Outside the CONUS
WVNT06 KKCI 082030
TJZS SIGMET FOXTROT 2 VALID 082030/090230 KKCISAN JUAN FIR VA FROM SOUFRIERE HILLS LOC 1642N06210W
VA CLD OBS AT 2030Z WI N1730 W06400 - N1700 W06300 - N1650 W06300 - N1710 W06400
- N1730 W06400. SFC/060. MOV W 15KT. FCST 0230Z VA CLD APRX N1730 W06500 - N1700
W06300 - N1650 W06300 - N1710 W06500 - N1730 W06500.
The ICAO communication header for this product is WVNT06. It is a SIGMET issued by the AWC (KKCI)
in Kansas City, MO, on the eighth day of the month at 2030 UTC. This is the second issuance of SIGMET
series Foxtrot valid from the 8th day of the month at 2030 UTC until the 9th day of the month at 0230 UTC.
Within the San Juan Oceanic FIR, volcanic ash from the Soufriere Hills volcano located at 16°/42 minutes
north, 62°/10 minutes west. Volcanic ash cloud observed at 2030 UTC within an area bounded by
17°/30 minutes north, 64°/00 minutes west to 17°/00 minutes north, 63°/00 minutes west to 16°/50 minutes
north, 63°/00 minutes west to 17°/10 minutes north, 64°/00 minutes west to 17°/30 minutes north,
64°/00 minutes west. From the surface to 6,000 ft MSL. Moving to the west at 15 kt. Forecast at 0230 UTC,
volcanic ash cloud located approximately at 17°/30 minutes north, 65°/00 minutes west to 17°/00 minutes
north, 63°/00 minutes west to 16°/50 minutes north, 63°/00 minutes west to 17°/10 minutes north,
65°/00 minutes west to 17°/30 minutes north, 65°/00 minutes west.

![Figure 26-7. SIGMET Outside the CONUS—Example](/handbooks/avwx/FAA-H-8083-28B/figures/fig-26-2-5-00-sigmet-outside-the-conus-example.png)

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-26-2-5-00-decoding-a-sigmet-outside-of-the-conus-line-cont.html">
<table><caption>Table 26-3. Decoding a SIGMET Outside of the CONUS 
Line 
Content 
Description 
1 
WSPA07 
ICAO communication header 
PHFO 
Issuance MWO 
010410 
Issuance UTC date/time 
2 
SIGPAT 
NWS AWIPS communica</caption><thead><tr><th>Line</th><th>Content</th><th>Description</th></tr></thead><tbody><tr><td>1 WSPA07 ICAO communication header
PHFO Issuance MWO
010410 Issuance UTC date/time</td><td></td><td></td></tr><tr><td></td><td>PHFO</td><td>Issuance MWO</td></tr><tr><td></td><td>010410</td><td>Issuance UTC date/time</td></tr><tr><td>2</td><td>SIGPAT</td><td>NWS AWIPS communication
header</td></tr><tr><td>3</td><td>KZAK</td><td>Area control center</td></tr><tr><td></td><td>SIGMET</td><td>Product type</td></tr><tr><td></td><td>TANGO</td><td>SIGMET series</td></tr><tr><td></td><td>2</td><td>Issuance number</td></tr><tr><td></td><td>VALID 010410/010800</td><td>Valid period UTC date/time</td></tr><tr><td></td><td>PHFO</td><td>Issuance office</td></tr><tr><td>4</td><td>OAKLAND OCEANIC FIR</td><td>FIR</td></tr><tr><td></td><td>FRQ TS OBS AND FCST WI 200NM
N3006 W14012 - N2012 W15016 CB
TOP FL400 MOV W 10KT WKN.</td><td>Phenomenon description</td></tr></tbody></table>
</div>
