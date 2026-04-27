---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 26
section_title: Inside the CONUS
faa_pages: 26-5..26-10
section_number: 2
subsection_number: 4
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Inside the CONUS

A number is assigned sequentially with each issuance until the phenomenon ends. At 0000 UTC each day,
all continuing SIGMETs are renumbered to one, regardless of a continuation of the phenomena
(e.g., YANKEE 1, YANKEE 2, YANKEE 3).
26.2.3 SIGMET Standardization
SIGMETs follow these standards:
All heights or altitudes are referenced to above MSL, unless otherwise noted, and annotated using
the height in hundreds of feet, consisting of three digits (e.g., 040). For heights at or above 18,000 ft,
the level is preceded by “FL” (e.g., FL180).
References to latitude and longitude are in whole degrees and minutes following the model:
Nddmm or Sddmm, Wdddmm, or Edddmm with a space between latitude and longitude and a
hyphen between successive points (e.g., N3106 W07118—N3011 W7209).
Messages are prepared in abbreviated plain language using contractions from FAA
Order JO 7340.2, Contractions, for domestic products, and from ICAO Doc 8400, ICAO
Abbreviations and Codes, for international products issued for Oceanic FIRs. A limited number of
non-abbreviated words, geographical names, and numerical values of a self-explanatory nature may
also be used.
26.2.4 Inside the CONUS
26.2.4.1 Non-Convective SIGMET
26.2.4.1.1 Non-Convective SIGMET Issuance Criteria—CONUS
A SIGMET may be issued in the CONUS when any of the following conditions affect, or, in the judgment
of the forecaster, are expected to affect an area judged to have a significant impact on the safety of aircraft
operations:
Severe or greater turbulence (SEV TURB).
Severe icing (SEV ICE).
Widespread dust storm (WDSPR DS).
Widespread sandstorm (WDSPR SS).
Volcanic ash (VA).
26.2.4.1.2 Non-Convective SIGMET Issuance Time and Valid Period—CONUS
A SIGMET is an unscheduled product issued any time conditions reaching SIGMET criteria are occurring
or expected to occur within a four-hour period. A SIGMET can have a valid period up to, but not exceeding,
four hours. SIGMETs for continuing phenomena will be reissued at least every four hours as long as
SIGMET conditions continue to occur in the area of responsibility.
26.2.4.1.3 Non-Convective SIGMET Format and Example—CONUS
The content and order of elements in the SIGMET are as follows:
Series name and number.
Valid beginning and ending time (UTC).
List of states affected by the phenomena.

Location of phenomena delineated by high-altitude VOR coordinates covering the affected area
during the SIGMET valid time.
Phenomena description (e.g., SEV ICE).
Vertical extent (base and top), if appropriate.
Movement, if appropriate.
Intensity change (INTSF—intensifying, WKN—weakening, NC—no change).
Indication that the weather condition will continue during the four hours beyond the valid time of
the SIGMET.
SFOR UWS 100130
SIGMET ROMEO 1 VALID UNTIL 100530
OR WA
FROM SEA TO PDT TO EUG TO SEA
SEV TURB BTN FL280 AND FL350. CONDS CONTG BYD 0530Z.
Figure 26-4. Non-Convective SIGMET for the CONUS—Example
Table 26-1. Decoding a Non-Convective SIGMET for the CONUS
Line
Content
Description
SFO
SIGMET area identifier
R
SIGMET series
UWS
Product identifier
Issuance date/time UTC
Product type
ROMEO
SIGMET series name
Series issuance number
VALID UNTIL 100530
Ending valid date/time UTC
OR WA
Phenomenon location (states)
FROM SEA TO PDT TO EUG TO SEA
Phenomenon location
(high-altitude VOR coordinates)
SEV TURB BTN FL280 AND FL350.
CONDS CONTG BYD 1000Z
Phenomenon description

The SIGMET in Figure 26-4 is decoded as the following:
(Line 1) SIGMET ROMEO series issued for the San Francisco area at 0130 UTC on the 10th day
of the month.
(Line 2) This is the first issuance of the SIGMET ROMEO series and is valid until the 10th day of
the month at 0530 UTC.
(Line 3) The affected states within the San Francisco area are Oregon and Washington.
(Line 4) From Seattle, WA; to Pendleton, OR; to Eugene, OR; to Seattle, WA.
(Line 5) Severe turbulence between FL280 and FL350. Conditions continuing beyond 0530Z.
26.2.4.1.4 Non-Convective SIGMET Cancellations—CONUS
A CONUS Non-Convective SIGMET is cancelled when the phenomenon is no longer occurring, no longer
expected to occur, or has moved out of the area of responsibility.
26.2.4.1.5 Non-Convective SIGMET Amendments—CONUS
Amendments to CONUS Non-Convective SIGMETs are not issued. Instead, a new SIGMET is issued using
the next series number.
26.2.4.1.6 SIGMET (Non-Convective) Corrections—CONUS
Corrections to CONUS Non-Convective SIGMETs are issued as necessary. The corrected SIGMET is
identified by a “COR” located at the end of the first line after the issuance UTC date/time.
26.2.4.2 Convective SIGMET
Convective SIGMETs are issued for the CONUS instead of SIGMETs for thunderstorms. Any Convective
SIGMET implies severe or greater turbulence, severe icing, and LLWS.
Although the areas where the Convective SIGMETs apply may be shown graphically, such a graphical
depiction, the Convective SIGMET polygon is a “snapshot” that outlines the area (or line) of thunderstorms
at the issuance time of 55 minutes past each hour. During the valid time of the SIGMET, the area/line will
move according to the movement vector given in the SIGMET. For fast-moving areas or lines, they will
very likely end up outside the SIGMET polygon by the end of the hour. Slow-moving or stationary areas
or lines will likely remain in or very close to the original polygon. For additional clarification, the movement
“MOV FROM...” within the Convective SIGMET describes the current movement of the SIGMET area or
line. In cases when cell movements are different within the area, the SIGMET will include an additional
line that states “CELL MOV FROM.” Detailed information regarding the Convective SIGMET depiction
should be compared to the textual version for storm movement, velocity, cloud tops, and several other
important elements. Users should exercise caution as areas of convection and their associated polygons can
change and should only be used for strategic planning.

26.2.4.2.1 Convective SIGMET Routine Issuance Criteria
A Convective SIGMET will be issued when any of the following conditions are occurring, or, in the
judgment of the forecaster, are expected to occur:
A line of thunderstorms at least 60 mi long with thunderstorms affecting at least 40 percent of its
length.
An area of active thunderstorms judged to have a significant impact on the safety of aircraft
operations covering at least 40 percent of the area concerned and exhibiting a very strong radar
reflectivity intensity or a significant satellite or lightning signature.
Embedded or severe thunderstorm(s) expected to occur for more than 30 minutes during the valid
period, regardless of the size of the area.
26.2.4.2.2 Convective SIGMET Special Issuance Criteria
A special Convective SIGMET may be issued when any of the following criteria are occurring or, in the
judgment of the forecaster, are expected to occur for more than 30 minutes of the valid period:
Tornado, hail greater than or equal to ¾ in (at the surface), or wind gusts greater than or equal to
50 kt (at the surface) are reported.
Indications of rapidly changing conditions if, in the forecaster’s judgment, they are not sufficiently
described in existing Convective SIGMETs.
Special issuance is not required for a valid Convective SIGMET.
26.2.4.2.3 Convective SIGMET Issuance Time and Valid Period
Convective SIGMET bulletins for the eastern, central, and western regions of the CONUS (see Figure 26-5)
are issued on a scheduled basis, hourly at 55 minutes past the hour. Each bulletin contains all valid
Convective SIGMETs within the region. Convective SIGMETs are valid for two hours or until superseded
by the next hourly issuance. A Convective SIGMET bulletin must be transmitted each hour for each region.
When conditions do not meet or are not expected to meet Convective SIGMET criteria within a region at
the scheduled time of issuance, a “CONVECTIVE SIGMET...NONE” message is transmitted.

Figure 26-5. AWC Convective SIGMET Areas of Responsibility

26.2.4.2.4 Convective SIGMET Format and Example
Each Convective SIGMET bulletin includes one or more individually numbered Convective SIGMETs for
the region. The content and order of each bulletin is as follows:
Convective SIGMET series number and region letter (E, W, or C).
Valid ending time (UTC).
List of states affected by the phenomena.
Location of phenomena delineated by high-altitude VOR coordinates covering the affected area
during the SIGMET valid time.
Phenomena description (e.g., AREA SEV EMBD TS).
Movement (e.g., MOV FROM 26030KT).
Cloud top (e.g., TOPS ABV FL450).
Remarks (e.g., TORNADOES...HAIL TO 2.5 IN...WIND GUSTS TO 70KT POSS).
Note: Tropical cyclone information will be added to the remarks section of the CONUS Convective
SIGMETs when appropriate.

Figure 26-6. Convective SIGMET—Example

Table 26-2. Decoding a Convective SIGMET for the CONUS
Line
Content
Description
MKC
Issuing office (AWC)
C
Region (East, Central, or West)
WST
Product identifier
Issuance date/time (DDHHMM)
CONVECTIVE SIGMET
Product type
Issuance number
C
Region (East, Central, or West)
VALID UNTIL 2055Z
Valid ending time (UTC)
ND SD
States/areas affected
FROM 90W MOT-GFK-ABR-90W MOT
Phenomenon location (high-altitude
VOR coordinates)
INTSFYG AREA SEV TS MOVG FROM
24045KT. TOPS ABV FL450. WIND
GUSTS TO 60KTS RPRTD.
TORNADOES…HAIL TO 2 IN… WIND
GUSTS TO 65KTS POSS ND PTN
Phenomenon description,
movement, cloud top, remarks
The Convective SIGMET in Figure 26-6 is decoded as the following:
(Line 1) Convective SIGMET issued for the central portion of the United States on the 22nd day
of the month at 1855Z.
(Line 2) This is the 20th Convective SIGMET issued on the 22nd day of the month for the central
United States as indicated by “20C.”
(Line 3) Valid until 2055Z.
(Line 4) The affected states are North Dakota and South Dakota.
(Line 5) From 90 NM west of Minot, ND; to Grand Forks, ND; to Aberdeen, SD; to 90 NM west
of Minot, ND.
(Line 6) An intensifying area of severe thunderstorms moving from 240° at 45 kt (to the northeast).
Thunderstorm tops above FL450. Wind gusts to 60 kt reported. Tornadoes, hail with diameter of
two inches, and wind gusts to 65 kt possible in the North Dakota portion.
26.2.4.2.5 Convective SIGMET Outlook
Each Convective SIGMET bulletin includes a two- to six-hour outlook at the end of the bulletin. The content
and order of each bulletin is as follows:
Beginning and ending valid times.
Location of expected Convective SIGMET issuances delineated by high-altitude VOR coordinates
for the outlook valid time.

![Figure 26-5. AWC Convective SIGMET Areas of Responsibility](/handbooks/avwx/FAA-H-8083-28B/figures/fig-26-2-4-00-awc-convective-sigmet-areas-of-responsibility.png)

![Figure 26-6. Convective SIGMET—Example](/handbooks/avwx/FAA-H-8083-28B/figures/fig-26-2-4-01-convective-sigmet-example.png)

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-26-2-4-00-decoding-a-non-convective-sigmet-for-the-conus-l.html">
<table><caption>Table 26-1. Decoding a Non-Convective SIGMET for the CONUS 
Line 
Content 
Description 
1 
SFO 
SIGMET area identifier 
R 
SIGMET series 
UWS 
Product identifier 
100130 
Issuance date/time UTC 
2 
SI</caption><thead><tr><th></th><th>Content</th><th></th></tr></thead><tbody><tr><td>Line</td><td></td><td>Description</td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>SFO</td><td>SIGMET area identifier</td></tr><tr><td>1</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>R</td><td>SIGMET series</td></tr><tr><td></td><td>UWS</td><td>Product identifier</td></tr><tr><td></td><td>100130</td><td>Issuance date/time UTC</td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>SIGMET</td><td>Product type</td></tr><tr><td>2</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>ROMEO</td><td>SIGMET series name</td></tr><tr><td></td><td>1</td><td>Series issuance number</td></tr><tr><td></td><td>VALID UNTIL 100530</td><td>Ending valid date/time UTC</td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>OR WA</td><td>Phenomenon location (states)</td></tr><tr><td>3</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>FROM SEA TO PDT TO EUG TO SEA</td><td>Phenomenon location
(high-altitude VOR coordinates)</td></tr><tr><td>4</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>SEV TURB BTN FL280 AND FL350.
CONDS CONTG BYD 1000Z</td><td>Phenomenon description</td></tr><tr><td>5</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-26-2-4-01-decoding-a-convective-sigmet-for-the-conus-line-.html">
<table><caption>Table 26-2. Decoding a Convective SIGMET for the CONUS 
Line 
Content 
Description 
1 
MKC 
Issuing office (AWC) 
C 
Region (East, Central, or West) 
WST 
Product identifier 
221855 
Issuance date/tim</caption><thead><tr><th>Line</th><th>Content</th><th>Description</th></tr></thead><tbody><tr><td>1</td><td>MKC</td><td>Issuing office (AWC)</td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>C</td><td>Region (East, Central, or West)</td></tr><tr><td></td><td>WST</td><td>Product identifier</td></tr><tr><td></td><td>221855</td><td>Issuance date/time (DDHHMM)</td></tr><tr><td>2</td><td>CONVECTIVE SIGMET</td><td>Product type</td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>20</td><td>Issuance number</td></tr><tr><td></td><td>C</td><td>Region (East, Central, or West)</td></tr><tr><td>3</td><td>VALID UNTIL 2055Z</td><td>Valid ending time (UTC)</td></tr><tr><td>4</td><td>ND SD</td><td>States/areas affected</td></tr><tr><td>5</td><td>FROM 90W MOT-GFK-ABR-90W MOT</td><td>Phenomenon location (high-altitude
VOR coordinates)</td></tr><tr><td></td><td></td><td></td></tr><tr><td>6</td><td>INTSFYG AREA SEV TS MOVG FROM
24045KT. TOPS ABV FL450. WIND
GUSTS TO 60KTS RPRTD.
TORNADOES…HAIL TO 2 IN… WIND
GUSTS TO 65KTS POSS ND PTN</td><td>Phenomenon description,
movement, cloud top, remarks</td></tr><tr><td></td><td></td><td></td></tr></tbody></table>
</div>
