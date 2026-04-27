---
handbook: phak
edition: FAA-H-8083-25C
chapter_number: 13
section_title: Aviation Routine Weather Report (METAR)
faa_pages: 13-6
section_number: 5
subsection_number: 1
source_url: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf
---

# Aviation Routine Weather Report (METAR)

Aviation Routine Weather Report (METAR)
A METAR is an observation of current surface weather
reported in a standard international format. While the
METAR code has been adopted worldwide, each country is
allowed to make modifications to the code. Normally, these
differences are minor but necessary to accommodate local
procedures or particular units of measure. This discussion of
METAR covers elements used in the United States.
METARs are issued on a regularly scheduled basis unless
significant weather changes have occurred. A special
METAR (SPECI) can be issued at any time between routine
METAR reports.
METAR KGGG 161753Z AUTO 14021G26KT 3/4SM
+TSRA BR BKN008 OVC012CB 18/17 A2970 RMK
PRESFR
A typical METAR report contains the following information
in sequential order:
Type of report—there are two types of METAR
reports. The first is the routine METAR report that is
transmitted on a regular time interval. The second is
the aviation selected SPECI. This is a special report
that can be given at any time to update the METAR for
rapidly changing weather conditions, aircraft mishaps,
or other critical information.
Station identifier—a four-letter code as established by
the International Civil Aviation Organization (ICAO).
In the 48 contiguous states, a unique three-letter
identifier is preceded by the letter “K.” For example,
Gregg County Airport in Longview, Texas, is
identified by the letters “KGGG,” K being the country
designation and GGG being the airport identifier.
In other regions of the world, including Alaska and
Hawaii, the first two letters of the four-letter ICAO
identifier indicate the region, country, or state. Alaska
identifiers always begin with the letters “PA” and
Hawaii identifiers always begin with the letters “PH.”
Station identifiers can be found by calling the FSS, a
NWS office, or by searching various websites such
as DUATS and NOAA's Aviation Weather Aviation
Digital Data Services (ADDS).
Date and time of report—depicted in a six-digit group
(161753Z). The first two digits are the date. The last
four digits are the time of the METAR/SPECI, which
is always given in coordinated universal time (UTC).
A “Z” is appended to the end of the time to denote
the time is given in Zulu time (UTC) as opposed to
local time.
Modifier—denotes that the METAR/SPECI came from
an automated source or that the report was corrected. If
the notation “AUTO” is listed in the METAR/SPECI,
the report came from an automated source. It also lists
“AO1” (for no precipitation discriminator) or “AO2”
(with precipitation discriminator) in the “Remarks”
section to indicate the type of precipitation sensors
employed at the automated station.

When the modifier “COR” is used, it identifies a
corrected report sent out to replace an earlier report
that contained an error (for example: METAR KGGG
161753Z COR).
Wind—reported with five digits (14021KT) unless
the speed is greater than 99 knots, in which case the
wind is reported with six digits. The first three digits
indicate the direction the true wind is blowing from in
tens of degrees. If the wind is variable, it is reported
as “VRB.” The last two digits indicate the speed of
the wind in knots unless the wind is greater than 99
knots, in which case it is indicated by three digits. If
the winds are gusting, the letter “G” follows the wind
speed (G26KT). After the letter “G,” the peak gust
recorded is provided. If the wind direction varies more
than 60° and the wind speed is greater than six knots,
a separate group of numbers, separated by a “V,” will
indicate the extremes of the wind directions.
Visibility—the prevailing visibility (¾ SM) is reported
in statute miles as denoted by the letters “SM.” It is
reported in both miles and fractions of miles. At times,
runway visual range (RVR) is reported following the
prevailing visibility. RVR is the distance a pilot can
see down the runway in a moving aircraft. When RVR
is reported, it is shown with an R, then the runway
number followed by a slant, then the visual range
in feet. For example, when the RVR is reported as
R17L/1400FT, it translates to a visual range of 1,400
feet on runway 17 left.
7.
Weather—can be broken down into two different
categories: qualifiers and weather phenomenon
(+TSRA BR). First, the qualifiers of intensity,
proximity, and the descriptor of the weather are given.
The intensity may be light (–), moderate ( ), or heavy
(+). Proximity only depicts weather phenomena that
are in the airport vicinity. The notation “VC” indicates
a specific weather phenomenon is in the vicinity
of five to ten miles from the airport. Descriptors
are used to describe certain types of precipitation
and obscurations. Weather phenomena may be
reported as being precipitation, obscurations, and
other phenomena, such as squalls or funnel clouds.

Intensity or Proximity 1
Precipitation 3
Obscuration 4
Other 5
Descriptor 2
–
Light
     Moderate (no qualifier)
+   Heavy
VC in the vicinity
MI   Shallow
BC  Patches
DR  Low drifting
BL  Blowing
SH  Showers
TS  Thunderstorms
FZ   Freezing
PR  Partial
DZ Drizzle
RA Rain
SN Snow
SG Snow grains
IC Ice crystals (diamond dust)
PL Ice pellets
GR Hail
GS Small hail or snow pellets
UP *Unknown precipitation
BR Mist
FG Fog
FU Smoke
DU Dust
SA Sand
HZ Haze
PY Spray
VA Volcanic ash
PO  Dust/sand whirls
SQ Squalls
FC  Funnel cloud
+FC Tornado or waterspout
SS Sandstorm
DS Dust storm
The weather groups are constructed by considering columns 1–5 in this table in sequence:
intensity, followed by descriptor, followed by weather phenomena (e.g., heavy rain showers(s) is coded as +SHRA).
* Automated stations only
Qualifier
Weather Phenomena
Figure 13-5. Descriptors and weather phenomena used in a typical METAR.
Contraction
SKC, CLR, FEW
FEW
SCT
BKN
OVC
Sky Cover
Less than 1∕8 (Clear)
1∕8–2∕8 (Few)
³∕8–4∕8 (Scattered)
5∕8–7∕8 (Broken)
8∕8 or (Overcast)
Figure 13-6. Reportable contractions for sky condition.
Descriptions of weather phenomena as they begin or
end and hailstone size are also listed in the “Remarks”
sections of the report. [Figure 13-5]
8.
Sky condition—always reported in the sequence of
amount, height, and type or indefinite ceiling/height
(vertical visibility) (BKN008 OVC012CB, VV003).
The heights of the cloud bases are reported with a
three-digit number in hundreds of feet AGL. Clouds
above 12,000 feet are not detected or reported by an
automated station. The types of clouds, specifically
towering cumulus (TCU) or cumulonimbus (CB)
clouds, are reported with their height. Contractions
are used to describe the amount of cloud coverage and
obscuring phenomena. The amount of sky coverage is
reported in eighths of the sky from horizon to horizon.
[Figure 13-6]
9.
Temperature and dew point—the air temperature and
dew point are always given in degrees Celsius (C) or
(18/17). Temperatures below 0 °C are preceded by
the letter “M” to indicate minus.
10. Altimeter setting—reported as inches of mercury
("Hg) in a four-digit number group (A2970). It is
always preceded by the letter “A.” Rising or falling
pressure may also be denoted in the “Remarks”
sections as “PRESRR” or “PRESFR,” respectively.
11. Zulu time—a term used in aviation for UTC, which
places the entire world on one time standard.
12. Remarks—the remarks section always begins with the
letters “RMK.” Comments may or may not appear in
this section of the METAR. The information contained
in this section may include wind data, variable
visibility, beginning and ending times of particular
phenomenon, pressure information, and various other
information deemed necessary. An example of a
remark regarding weather phenomenon that does not
fit in any other category would be: OCNL LTGICCG.
This translates as occasional lightning in the clouds
and from cloud to ground. Automated stations also use
the remarks section to indicate the equipment needs
maintenance.
METAR KGGG 161753Z AUTO 14021G26KT 3/4SM
+TSRA BR BKN008 OVC012CB 18/17 A2970 RMK
PRESFR

XXX
UA
/OV
/TM
/FL
/TP
/SK
/WX
/TA
/WV
/TB
/IC
/RM
3-letter station identifier
Routine PIREP, UUA-Urgent PIREP.
Location
Time
Altitude/flight level
Type aircraft
Sky cover/cloud layers
Weather
Air temperature in celsius (C)
Wind
Turbulence
Icing
Remarks
Nearest weather reporting location to the reported phenomenon
Use 3-letter NAVAID idents only.
 a. Fix: /OV ABC, /OV ABC 090025.
 b. Fix: /OV ABC 045020-DEF, /OV ABC-DEF-GHI
4 digits in UTC: /TM 0915.
3 digits for hundreds of feet. If not known, use UNKN: /FL095, /FL310, /FLUNKN.
4 digits maximum. If not known, use UNKN: /TP L329, /TP B727, /TP UNKN.
Describe as follows:
 a. Height of cloud base in hundreds of feet. If unknown, use UNKN.
 b. Cloud cover symbol.
 c. Height of cloud tops in hundreds of feet.
Flight visibility reported first:
Use standard weather symbols:
/WX FV02SM RA HZ, /WX FV01SM TSRA.
If below zero, prefix with a hyphen: /TA 15, /TA M06.
Direction in degrees magnetic north and speed in six digits:
/WV270045KT, WV 280110KT.
Use standard contractions for intensity and type (use CAT or CHOP when
appropriate). Include altitude only if different from /FL, /TB EXTRM, /TB
LGT-MOD BLO 090.
Describe using standard intensity and type contractions. Include altitude only if
different than /FL: /IC LGT-MOD RIME, /IC SEV CLR 028-045.
Use free form to clarify the report and type hazardous elements first:
/RM LLWS -15KT SFC-030 DURC RY22 JFK.
Encoding Pilot Weather Reports (PIREPS)
Figure 13-7. PIREP encoding and decoding.
Explanation:
Routine METAR for Gregg County Airport for the 16th
day of the month at 1753Z automated source. Winds are
140 at 21 knots gusting to 26. Visibility is ¾ statute mile.
Thunderstorms with heavy rain and mist. Ceiling is broken
at 800 feet, overcast at 1,200 feet with cumulonimbus clouds.
Temperature 18 °C and dew point 17 °C. Barometric pressure
is 29.70 "Hg and falling rapidly.
