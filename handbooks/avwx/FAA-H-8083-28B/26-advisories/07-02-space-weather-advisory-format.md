---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 26
section_title: Space Weather Advisory Format
faa_pages: 26-29..26-31
section_number: 7
subsection_number: 2
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Space Weather Advisory Format

Table 26-6. Space Weather Advisory Issuance Criteria
Effect
Sub-Effect
Parameter Used
Thresholds
Impact within
Advisory Area
MOD
SEV
MOD
SEV
GNSS
Amplitude
Scintillation
S4 (dimensionless)
0.5
0.8
Possible
degraded
service
Possible
unreliable
service
GNSS
Phase Scintillation Sigma-phi (radians)
0.4
0.7
GNSS
Vertical Total
Electron Content
(TEC)
TEC units
RADIATION
Effective dose
(microSieverts/hour)*
Possible increased dose rates
above normal levels
HF COM
Auroral
Absorption (AA)
Kp index
Possible
degraded
service
Possible
unreliable
service
HF COM
Polar Cap
Absorption (PCA)
dB from 30 MHz
riometer data
HF COM
Shortwave Fadeout
(SWF)
Solar X rays
(0.0–0.8 NM)
(W-m-2)
1×10-4
(X1)
1×10-3
(X10)
HF COM
Post-Storm
Depression
Maximum Usable
Frequency (MUF)
30%
50%
SATCOM
No threshold has been set for this effect
Possible
degraded
service
Possible
unreliable
service
*MOD advisories will only be issued when the MOD threshold is reached between FL250 and FL460.
SEV advisories will be issued when the SEV threshold is reached at any FL above FL250. For context, the
background effective dose rate at FL370 at very high latitudes is approximately 9 micro-Sieverts/hour during solar
minimum and 6 micro-Sieverts/hour during solar maximum. These rates decrease progressively toward the
equatorial regions to values approximately one quarter of what is observed at very high latitudes.
Note: SEV radiation is a rare event with only a few short-lived events occurring during an 11-year solar
cycle.
26.7.2 Space Weather Advisory Format
The Space Weather Advisory provides an observed or expected location for the impact and 6-, 12-, 18-,
and 24-hour forecasts. The advisory describes the affected part of the globe in one of three ways:
Six pre-defined latitude bands of width 30° shown in Table 26-7 (multiple bands may be given in
one advisory), followed by a longitude range in 15-degree increments;*
The term “DAYLIGHT SIDE,” meaning the extent of the planet that is in daylight; or
A polygon using latitude and longitude coordinates.
Note: *E18000-W18000 (or E180-W180) is used when the entire band is affected.

Table 26-7. Latitude Bands Used in Space Weather Advisories
Latitude Bands Used in Space Weather Advisories
High latitudes northern hemisphere (HNH)
N90 to N60
Middle latitudes northern hemisphere (MNH)
N60 to N30
Equatorial latitudes northern hemisphere (EQN)
N30 to equator
Equatorial latitudes southern hemisphere (EQS)
Equator to S30
Middle latitudes southern hemisphere (MSH)
S30 to S60
High latitudes southern hemisphere (HSH)
S60 to S90
By design, the vertical and temporal resolutions of the advisory are very coarse. The use of 30° latitude
bands, 15-degree longitude increments, 1,000-ft vertical increments (for radiation), and six-hour time
intervals will at times result in over-forecasting the affected airspace. In addition, while an entire latitude
band may be forecast to have MOD or SEV space weather, there will often be times that the effect does not
cover the entire width of the band or is intermittent or temporary. Users should refer to the remarks section
of the advisory for additional information. Users can also go to the center’s website, where a graphical
depiction of the space weather event may be provided along with additional information.
Changes to the Space Weather Advisory content and format are possible in the coming years as experience
is gained with the use of this product.
The Space Weather Advisory is not a replacement for the SWPC’s other products or the NOAA Space
Weather Scales, which continue to be provided by the SWPC. Refer to the SWPC’s website for information
on these products and the scales.

Table 26-8. Format of the Space Weather Advisory
Format
Explanation
Examples
Communication
header
Product’s coded identification for
the issuing centers. KWNP is the
SWPC, LFPW and YMMC are the
ACFJ, EFKL and EGRR are the
PECASUS, and ZBBB and UUAG
are the CRC.

FNXX01 is for GNSS, FNXX02 is
for HF COM, FNXX03 is for
Radiation, and FNXX04 is for
SATCOM.
FNXX01 KWNP
FNXX01 LFPW
FNXX01 YMMC
FNXX01 EFKL
FNXX02 EGRR
FNXX03 UUAG
FNXX04 ZBBB
SWX ADVISORY
Space Weather (SWX) Advisory.
SWX ADVISORY
STATUS:
Status indicator (optional) for test or
exercise.
TEST
EXER
DTG:
Date and time of origin, in
YYYYMMDD/HHMMZ.
20190418/0100Z
SWXC:
Name of the Space Weather
Advisory Center (SWXC).
ACFJ
PECASUS
SWPC
CRC
ADVISORY NR:
Advisory number (NR).
2019/9
NR RPLC:
Advisory number being replaced by
this advisory (optional).
2019/8
SWX EFFECT:
Space weather effect.
HF COM MOD
HF COM SEV
SATCOM MOD
SATCOM SEV
GNSS MOD
GNSS SEV
RADIATION MOD
RADIATION SEV
OBS (or FCST)
SWX:
Observed (OBS) or expected
(FCST) space weather effect
date/time, location, and altitudes
(altitudes are only used in the
radiation advisory).
18/0100Z EQN W18000-W12000
18/0100Z HNH HSH E180-W180 ABV
FL370
18/0100Z DAYLIGHT SIDE
18/0100Z NO SWX EXP
FCST SWX
+6 HR:
6-hour forecast. Date/time, location,
and altitudes.
Same as above
FCST SWX
+12 HR:
12-hour forecast. Date/time,
location, and altitudes.
Same as above
FCST SWX
+18 HR:
18-hour forecast. Date/time,
location, and altitudes.
Same as above
FCST SWX
+24 HR:
24-hour forecast. Date/time,
location, and altitudes.
Same as above

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-26-7-2-00-space-weather-advisory-issuance-criteria-effect-.html">
<table><caption>Table 26-6. Space Weather Advisory Issuance Criteria 
Effect 
Sub-Effect 
Parameter Used 
Thresholds 
Impact within 
Advisory Area 
MOD 
SEV 
MOD 
SEV 
GNSS 
Amplitude 
Scintillation 
S4 (dimensionles</caption><thead><tr><th></th><th></th><th></th><th></th><th></th><th>Impact within</th><th></th></tr></thead><tbody><tr><td></td><td></td><td></td><td>Thresholds</td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td>Advisory Area</td><td></td></tr><tr><td>Effect</td><td>Sub-Effect</td><td>Parameter Used</td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td>MOD</td><td>SEV</td><td>MOD</td><td>SEV</td></tr><tr><td>Amplitude
GNSS S4 (dimensionless) 0.5 0.8
Scintillation
Possible Possible
GNSS Phase Scintillation Sigma-phi (radians) 0.4 0.7
degraded unreliable
Vertical Total service service
GNSS Electron Content TEC units 125 175
(TEC)</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>GNSS</td><td>Phase Scintillation</td><td>Sigma-phi (radians)</td><td>0.4</td><td>0.7</td><td></td><td></td></tr><tr><td>GNSS</td><td>Vertical Total
Electron Content
(TEC)</td><td>TEC units</td><td>125</td><td>175</td><td></td><td></td></tr><tr><td>RADIATION</td><td></td><td>Effective dose
(micro-
Sieverts/hour)*</td><td>30</td><td>80</td><td>Possible increased dose rates
above normal levels</td><td></td></tr><tr><td>HF COM</td><td>Auroral
Absorption (AA)</td><td>Kp index</td><td>8</td><td>9</td><td>Possible
degraded
service</td><td>Possible
unreliable
service</td></tr><tr><td>HF COM</td><td>Polar Cap
Absorption (PCA)</td><td>dB from 30 MHz
riometer data</td><td>2</td><td>5</td><td></td><td></td></tr><tr><td>HF COM</td><td>Shortwave Fadeout
(SWF)</td><td>Solar X rays
(0.0–0.8 NM)
(W-m-2)</td><td>1×10-4
(X1)</td><td>1×10-3
(X10)</td><td></td><td></td></tr><tr><td>HF COM</td><td>Post-Storm
Depression</td><td>Maximum Usable
Frequency (MUF)</td><td>30%</td><td>50%</td><td></td><td></td></tr><tr><td>SATCOM</td><td>No threshold has been set for this effect</td><td></td><td></td><td></td><td>Possible
degraded
service</td><td>Possible
unreliable
service</td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-26-7-2-01-latitude-bands-used-in-space-weather-advisories-.html">
<table><caption>Table 26-7. Latitude Bands Used in Space Weather Advisories 
Latitude Bands Used in Space Weather Advisories 
High latitudes northern hemisphere (HNH) 
N90 to N60 
Middle latitudes northern hemisphere</caption><thead><tr><th></th><th></th></tr></thead><tbody><tr><td>Latitude Bands Used in Space Weather Advisories</td><td></td></tr><tr><td></td><td></td></tr><tr><td>High latitudes northern hemisphere (HNH)</td><td>N90 to N60</td></tr><tr><td>Middle latitudes northern hemisphere (MNH)</td><td>N60 to N30</td></tr><tr><td>Equatorial latitudes northern hemisphere (EQN)</td><td>N30 to equator</td></tr><tr><td>Equatorial latitudes southern hemisphere (EQS)</td><td>Equator to S30</td></tr><tr><td>Middle latitudes southern hemisphere (MSH)</td><td>S30 to S60</td></tr><tr><td>High latitudes southern hemisphere (HSH)</td><td>S60 to S90</td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-26-7-2-02-format-of-the-space-weather-advisory-format-expl.html">
<table><caption>Table 26-8. Format of the Space Weather Advisory 
Format 
Explanation 
Examples 
Communication 
header 
Product’s coded identification for 
the issuing centers. KWNP is the 
SWPC, LFPW and YMMC are th</caption><thead><tr><th>Format</th><th>Explanation</th><th>Examples</th></tr></thead><tbody><tr><td>Communication
header</td><td>Product’s coded identification for
the issuing centers. KWNP is the
SWPC, LFPW and YMMC are the
ACFJ, EFKL and EGRR are the
PECASUS, and ZBBB and UUAG
are the CRC.
FNXX01 is for GNSS, FNXX02 is
for HF COM, FNXX03 is for
Radiation, and FNXX04 is for
SATCOM.</td><td>FNXX01 KWNP
FNXX01 LFPW
FNXX01 YMMC
FNXX01 EFKL
FNXX02 EGRR
FNXX03 UUAG
FNXX04 ZBBB</td></tr><tr><td>SWX ADVISORY</td><td>Space Weather (SWX) Advisory.</td><td>SWX ADVISORY</td></tr><tr><td>STATUS:</td><td>Status indicator (optional) for test or
exercise.</td><td>TEST
EXER</td></tr><tr><td>DTG:</td><td>Date and time of origin, in
YYYYMMDD/HHMMZ.</td><td>20190418/0100Z</td></tr><tr><td>SWXC:</td><td>Name of the Space Weather
Advisory Center (SWXC).</td><td>ACFJ
PECASUS
SWPC
CRC</td></tr><tr><td>ADVISORY NR:</td><td>Advisory number (NR).</td><td>2019/9</td></tr><tr><td>NR RPLC:</td><td>Advisory number being replaced by
this advisory (optional).</td><td>2019/8</td></tr><tr><td>SWX EFFECT:</td><td>Space weather effect.</td><td>HF COM MOD
HF COM SEV
SATCOM MOD
SATCOM SEV
GNSS MOD
GNSS SEV
RADIATION MOD
RADIATION SEV</td></tr><tr><td>OBS (or FCST)
SWX:</td><td>Observed (OBS) or expected
(FCST) space weather effect
date/time, location, and altitudes
(altitudes are only used in the
radiation advisory).</td><td>18/0100Z EQN W18000-W12000
18/0100Z HNH HSH E180-W180 ABV
FL370
18/0100Z DAYLIGHT SIDE
18/0100Z NO SWX EXP</td></tr><tr><td>FCST SWX
+6 HR:</td><td>6-hour forecast. Date/time, location,
and altitudes.</td><td>Same as above</td></tr><tr><td>FCST SWX
+12 HR:</td><td>12-hour forecast. Date/time,
location, and altitudes.</td><td>Same as above</td></tr><tr><td>FCST SWX
+18 HR:</td><td>18-hour forecast. Date/time,
location, and altitudes.</td><td>Same as above</td></tr><tr><td>FCST SWX
+24 HR:</td><td>24-hour forecast. Date/time,
location, and altitudes.</td><td>Same as above</td></tr></tbody></table>
</div>
