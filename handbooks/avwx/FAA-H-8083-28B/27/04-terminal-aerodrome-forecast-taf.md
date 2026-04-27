---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 27
section_title: Terminal Aerodrome Forecast (TAF)
faa_pages: 27-6..27-21
section_number: 4
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Terminal Aerodrome Forecast (TAF)

Table 27-2. Wind and Temperature Aloft Forecast Periods
Model
Run
Product
Available
6-Hour Forecast
12-Hour Forecast
24-Hour Forecast
Valid
For Use
Valid
For Use
Valid
For Use
0000Z
~0200Z
0600Z
0200-0900Z
1200Z
0900-1800Z
0000Z
1800-0600Z
0600Z
~0800Z
1200Z
0800-1500Z
1800Z
1500-0000Z
0600Z
0000-1200Z
1200Z
~1400Z
1800Z
1400-2100Z
0000Z
2100-0600Z
1200Z
0600-1800Z
1800Z
~2000Z
0000Z
2000-0300Z
0600Z
0300-1200Z
1800Z
1200-0000Z
27.3 Graphical FB Wind and Temperature Aloft Forecast
Graphical depictions of FB Wind and Temperature Aloft Forecasts vary depending on the website. Details
and information on these graphical depictions can usually be found on the website’s help or information
page.
27.4 Terminal Aerodrome Forecast (TAF)
A TAF is a concise statement of the expected meteorological conditions significant to aviation for a
specified time period within 5 SM of the center of the airport’s runway complex (terminal). TAFs use the
same weather codes found in METARs (see Section 24.3). Temperature is not included in the NWS TAF,
operators may use temperature information from the LAMP/MOS product (see Section 27.16).
27.4.1 TAF Responsibility
TAFs are issued by NWS WFOs for nearly 700 U.S. airports. The majority of TAFs provide a 24-hour
forecast for the airport, while TAFs for some major airports provide a 30-hour forecast.
27.4.2 Generic Format of the Forecast Text of an NWS-Prepared TAF.
See Table 27-3 for the generic format of the NWS’ TAFs.

Table 27-3. Generic Format of the National Weather Service’s TAFs
or
TAF AMD
or
TAF COR

Type of report

CCCC
YYGGggZ
Y1Y1G1G1/Y2Y2G2G2
dddffGfmfmKT
Location identifier
Date/time of forecast
origin group
Valid period
Wind group

VVVV
w’w’
or
NSW
NsNsNshshshs
or
VVhshshs
or
SKC
WShwshwshws/dddftKT
Visibility group
Significant weather
group
Cloud and vertical
obscuration groups
Non-convective LLWS group

TTGGgg
Forecast change
indicator groups

FMY1Y1GGgg
TEMPO Y1Y1GG/YeYeGeGe
PROB30 Y1Y1GG/YeYeGeGe

From group
Temporary group
Probability group
27.4.2.1 Type of Report (TAF, TAF AMD, or TAF COR)
The report-type header always appears as the first element in the TAF and is produced in three forms: a
routine forecast (TAF), an amended forecast (TAF AMD), or a corrected forecast (TAF COR).
TAFs are amended whenever they become, in the forecaster’s judgment, unrepresentative of existing or
expected conditions, particularly regarding those elements and events significant to aircraft and airports.
An amended forecast is identified by TAF AMD (in place of TAF) on the first line of the forecast text.
Select airports have amendments routinely issued. See Table 27-7.

27.4.2.2 Location Identifier (CCCC)
After the line containing either TAF, TAF AMD, or TAF COR, each TAF begins with its four-letter ICAO
location identifier.
KDFW
Dallas-Fort Worth
PANC
Anchorage, Alaska
PHNL
Honolulu, Hawaii
27.4.2.3 Date/Time of Forecast Origin Group (YYGGggZ)
The date/time of the forecast origin group (YYGGggZ) follows the terminal’s location identifier. It contains
the day of the month in two digits (YY) and the time in four digits (GGgg in hours and minutes) in which
the forecast is completed and ready for transmission, with a Z appended to denote UTC. This time is entered
by the forecaster. A routine forecast, TAF, is issued 20 to 40 minutes before the beginning of its valid
period.
061737Z
The TAF was issued on the sixth day of the month at 1737 UTC.
121123Z
The TAF was issued on the 12th day of the month at 1123 UTC.
27.4.2.4 Valid Period (Y1Y1G1G1/Y2Y2G2G2)
The TAF valid period (Y1Y1G1G1/Y2Y2G2G2) follows the date/time of the forecast origin group. Scheduled
24- and 30-hour TAFs are issued four times per day, at 0000, 0600, 1200, and 1800Z. The first two digits
(Y1Y1) are the day of the month for the start of the TAF. The next two digits (G1G1) are the starting hour
(UTC). Y2Y2 is the day of the month for the end of the TAF, and the last two digits (G2G2) are the ending
hour (UTC) of the valid period. A forecast period that begins at midnight UTC is annotated as 00. If the
end time of a valid period is at midnight UTC, it is annotated as 24. For example, a 00Z TAF issued on the
9th of the month and valid for 24 hours would have a valid period of 0900/0924.
Whenever an amended TAF (TAF AMD) is issued, it supersedes and cancels the previous TAF. That is,
users should not wait until the start of the valid period indicated within the TAF AMD to begin using it.
Examples
1512/1612
The TAF is valid from the 15th day of the month at 1200 UTC until the 16th day of the month at 1200 UTC.
2306/2412
This is a 30-hour TAF valid from the 23rd day of the month at 0600 UTC until the 24th day of the month
at 1200 UTC.
0121/0218

This is an amended TAF valid from the 1st day of the month at 2100 UTC until the second day of the month
at 1800 UTC.
0600/0624
This TAF is valid from the sixth day of the month at 0000 UTC until the sixth day of the month at 2400
UTC (or seventh day of the month at 0000 UTC).
27.4.2.5 Wind Group (dddffGfmfmKT)
The initial time period and any subsequent “from” (FM) groups begin with a mean surface wind forecast
(dddffGfmfmKT) for that period. Wind forecasts are expressed as the mean three-digit direction
(ddd, relative to true north) from which the wind is blowing, rounded to the nearest 10°, and the mean wind
speed in knots (ff) for the time period. If wind gusts are forecast (gusts are defined as rapid fluctuations in
wind speeds with a variation of 10 kt or more between peaks and lulls), they are indicated immediately after
the mean wind speed by the letter G, followed by the peak gust speed expected. KT is appended to the end
of the wind forecast group. Any wind speed of 100 kt or more will be encoded in three digits. Calm winds
are encoded as 00000KT.
The prevailing wind direction is forecast for any speed greater than or equal to 7 kt. When the prevailing
surface wind direction is variable (variations in wind direction of 30° or more), the forecast wind direction
is encoded as VRBffKT. Two conditions where this can occur are very light winds and convective activity.
Variable wind direction for very light winds must have a wind speed of 1 to 6 kt inclusive. For convective
activity, the wind group may be encoded as VRBffGfmfmKT, where Gfmfm is the maximum expected wind
gusts. VRB is not used in the non-convective LLWS group.
Squalls are forecast in the wind group as gusts (G) but must be identified in the significant weather group
with the code SQ.
23010KT
Wind from 230° “true” (southwest) at 10 kt.
28020G35KT
Wind from 280° “true” (west) at 20 kt gusting to 35 kt.
VRB05KT
Wind variable at 5 kt.
VRB15G30KT
Wind variable at 15 kt gusting to 30 kt due to forecast convective activity.
00000KT
Wind calm.
27.4.2.6 Visibility Group (VVVV)
The initial time period and any subsequent FM groups include a visibility forecast (VVVV) in statute miles
appended by the contraction SM.
When the prevailing visibility is forecast to be less than or equal to 6 SM, one or more significant weather
groups are included in the TAF. However, drifting dust (DRDU), drifting sand (DRSA), drifting snow
(DRSN), shallow fog (MIFG), partial fog (PRFG), and patchy fog (BCFG) may be forecast with
prevailing visibility greater than or equal to 7 SM.

When a whole number and a fraction are used to forecast visibility, a space is included between them
(e.g., 1 1/2SM). Visibility greater than 6 SM is encoded as P6SM.
If the visibility is not expected to be the same in different directions, prevailing visibility is used.
When volcanic ash (VA) is forecast in the significant weather group, visibility is included in the forecast,
even if it is unrestricted (P6SM). For example, an expected reduction of visibility to 10 SM by volcanic
ash is encoded in the forecast as P6SM VA.
Although not used by the NWS in U.S. domestic TAFs, the contraction CAVOK (ceiling and visibility
OK) may replace the visibility, weather, and sky condition groups if all of the following conditions are
forecast: visibility of 10 km (6 SM) or more; no clouds below 1,500 m (5,000 ft) or below the highest
minimum sector altitude (whichever is greater); no cumulonimbus; and no significant weather phenomena.
P6SM
Visibility unrestricted.
1 1/2SM
Visibility 1 and ½ SM.
4SM
Visibility 4 SM.
27.4.2.7 Significant Weather Group (w’w’ or NSW)
The significant weather group (w’w’ or NSW) consists of the appropriate qualifier(s) and weather
phenomenon contraction(s) or NSW (no significant weather).
If the initial forecast period and subsequent FM groups are not forecast to have explicit significant weather,
the significant weather group is omitted. NSW is not used in the initial forecast time period or FM groups.
One or more significant weather group(s) is (are) included when the visibility is forecast to be 6 SM or less.
The exceptions are volcanic ash (VA), low drifting dust (DRDU), low drifting sand (DRSA), low drifting
snow (DRSN), shallow fog (MIFG), partial fog (PRFG), and patchy fog (BCFG). Obstructions to vision
are only forecast when the prevailing visibility is less than 7 SM or, in the opinion of the forecaster, is
considered operationally significant.
Volcanic ash (VA) is always forecast when expected. When VA is included in the significant weather
group, visibility is included in the forecast as well, even if the visibility is unrestricted (P6SM).
NSW is used in place of significant weather only in a temporary (TEMPO) group to indicate when
significant weather [including in the vicinity (VC)] included in a previous subdivided group is expected
to end.
Multiple precipitation elements are encoded in a single group (e.g., -TSRASN). If more than one type of
precipitation is forecast, up to three appropriate precipitation contractions can be combined in a single group
(with no spaces) with the predominant type of precipitation being first. In this single group, the intensity
refers to the total precipitation and can be used with either one or no intensity qualifier, as appropriate. In
TAFs, the intensity qualifiers (light, moderate, and heavy) refer to the intensity of the precipitation and not
to the intensity of any thunderstorms associated with the precipitation.
Intensity is coded with precipitation types (except ice crystals and hail), including those associated with
thunderstorms and those of a showery nature (SH). No intensity is ascribed to blowing dust (BLDU),
blowing sand (BLSA), or blowing snow (BLSN). Only moderate or heavy intensity is ascribed to a
sandstorm (SS) and dust storm (DS).

27.4.2.7.1 Exception for Encoding Multiple Precipitation Types
When more than one type of precipitation is forecast in a time period, any precipitation type associated with
a descriptor (e.g., FZRA) is encoded first in the precipitation group, regardless of the predominance or
intensity of the other precipitation types. Descriptors are not encoded with the second or third precipitation
type in the group. The intensity is associated with the first precipitation type of a multiple precipitation type
group. For example, a forecast of moderate snow and light freezing rain is coded as -FZRASN, although
the intensity of the snow is greater than the freezing rain.
Combinations of one precipitation and one non-precipitation weather phenomenon:
-DZ FG
Light drizzle and fog (obstruction that reduces visibility to less than 5/8 SM).
RA BR
Moderate rain and mist.
-SHRA FG
Light rain showers and fog.
+SN FG
Heavy snow and fog.
Combinations of more than one type of precipitation:
-RASN FG HZ
Light rain and snow (light rain predominant), fog, and haze.
TSSNRA
Thunderstorm with moderate snow and rain (moderate snow predominant).
FZRASNPL
Moderate freezing rain, snow, and ice pellets (freezing rain mentioned first due to the descriptor,
followed by other precipitation types in order of predominance).
SHSNPL
Moderate snow showers and ice pellets.
27.4.2.7.2 Thunderstorm Descriptor
The TS descriptor is treated differently than other descriptors in the following cases:
When nonprecipitating thunderstorms are forecast, TS may be encoded as the sole significant
weather phenomenon; and
When forecasting thunderstorms with freezing precipitation (FZRA or FZDZ), the TS descriptor
is included first, followed by the intensity and weather phenomena.

TS -FZRA
When a thunderstorm is included in the significant weather group (even using vicinity, VCTS), the cloud
group (NsNsNshshshs) includes a forecast cloud type of CB. See the following example for encoding VCTS.
-FZRA VCTS BKN010CB
27.4.2.7.3 Fog Forecast
A visibility threshold must be met before a forecast for fog (FG) is included in the TAF. When forecasting
a fog-restricted visibility from 5/8 to 6 SM, the phenomenon is coded as BR (mist). When a fog-restricted
visibility is forecast to result in a visibility of less than 5/8 SM, the code FG is used. The forecaster never
encodes weather obstruction as mist (BR) when the forecast visibility is greater than 6 SM (P6SM).
Fog-related terms are used as described in Table 27-4.
Table 27-4. TAF Fog Terms
Term
Description
Freezing Fog
(FZFG)
Any fog (visibility less than 5/8 SM) consisting predominantly of water
droplets at temperatures less than or equal to 32 °F (0°C), whether or not
rime ice is expected to be deposited. FZBR is not a valid significant weather
combination and will not be used in TAFs.
Shallow Fog
(MIFG)
The visibility at 6 ft AGL is greater than or equal to 5/8 SM and the apparent
visibility in the fog layer is less than 5/8 SM.
Patchy Fog
(BCFG)
Fog patches covering part of the airport. The apparent visibility in the fog
patch or bank is less than 5/8 SM, with the foggy patches extending to at
least 6 ft AGL.
Partial Fog
(PRFG)
A substantial part of the airport is expected to be covered by fog while the
remainder is expected to be clear of fog (e.g., a fog bank).
Note: MIFG, PRFG, and BCFG may be forecast with prevailing visibility of
P6SM.
1/2SM FG
Fog is reducing visibilities to less than 5/8 SM, therefore FG is used to encode the fog.
3SM BR
Fog is reducing visibilities to between 5/8 and 6 SM, therefore BR is used to encode the fog.
27.4.2.8 Vicinity (VC)
In the United States, vicinity (VC) is defined as a donut-shaped area between 5 SM and 10 SM from the
center of the airport’s runway complex. NWS TAFs may include a prevailing condition forecast of fog,
showers, and thunderstorms in the airport’s vicinity. A prevailing condition is defined as a greater than or

equal to 50 percent probability of occurrence for more than half of the subdivided forecast time period. VC
is not included in temporary (TEMPO) or probability (PROB) groups.
The significant weather phenomena in Table 27-5 are valid for use in prevailing portions of NWS’ TAFs
in combination with VC.
Table 27-5. TAF Use of Vicinity (VC)
Phenomenon
Coded
Fog*
VCFG
Shower(s)**
VCSH
Thunderstorm
VCTS
*Always coded as VCFG regardless of visibility in the obstruction,
and without qualification as to intensity or type (frozen or liquid).
**The VC group, if used, should be the last entry in any significant
weather group.
27.4.2.9 Cloud and Vertical Obscuration Groups (NsNsNshshshs or VVhshshs or SKC)
The initial time period and any subsequent FM groups include a cloud or obscuration group (NsNsNshshshs
or VVhshshs or SKC), used as appropriate to indicate the cumulative amount (NsNsNs) of all cloud layers
in ascending order and height (hshshs), to indicate vertical visibility (VVhshshs) into a surface-based
obstructing medium, or to indicate a clear sky (SKC). All cloud layers and obscurations are considered
opaque.
27.4.2.9.1 Cloud Group (NsNsNshshshs)
The cloud group (NsNsNshshshs) is used to forecast cloud amount as indicated in Table 27-6.
Table 27-6. TAF Sky Cover
Sky Cover Contraction
Sky Coverage
SKC
0 oktas
FEW
0 to 2 oktas
SCT
3 to 4 oktas
BKN
5 to 7 oktas
OVC
8 oktas
When 0 oktas of sky coverage are forecasted, the cloud group is replaced by SKC. The contraction CLR,
which is used in the METAR code, is not used in TAFs. TAFs for sites with an ASOS or AWOS contain
the cloud amount and/or obscurations, which the forecaster expects, not what is expected to be reported by
an ASOS/AWOS.

Heights of clouds (hshshs) are forecast in hundreds of feet AGL.
The lowest level at which the cumulative cloud cover equals 5/8 or more of the celestial dome is understood
to be the forecast ceiling. For example, VV008, BKN008, or OVC008 all indicate an 800-ft ceiling.
27.4.2.9.2 Vertical Obscuration Group (VVhshshs)
The vertical obscuration group (VVhshshs) is used to forecast, in hundreds of feet AGL, the vertical
visibility (VV) into a surface-based total obscuration. VVhshshs is this ceiling at the height indicated in the
forecast. TAFs do not include forecasts of partial obscurations (i.e., FEW000, SCT000, or BKN000).
1SM BR VV008
Ceiling is 800 ft due to vertical visibility into fog.
27.4.2.9.3 Cloud Type (CB)
The only cloud type included in the TAF is CB. CB follows cloud or obscuration height (hshshs) without a
space whenever thunderstorms are included in the significant weather group (w’w’), even if thunderstorms
are only forecast in the vicinity (VCTS). CB can be included in the cloud group (NsNsNshshshs) or the
vertical obscuration group (VVhshshs) without mentioning a thunderstorm in the significant weather group
(w’w’). Therefore, situations may occur where nearly identical NsNsNshshshs or VVhshshs appear in
consecutive time periods, with the only change being the addition or elimination of CB in the forecast cloud
type.
1/2SM TSRA OVC010CB
Thunderstorms are forecast at the airport.
27.4.2.9.4 Non-Convective Low-Level Wind Shear (LLWS) Group (WShwshwshws/dddffKT)
Wind shear (WS) is defined as a rapid change in horizontal wind speed and/or direction, with distance
and/or a change in vertical wind speed and/or direction with height. A sufficient difference in wind speed,
wind direction, or both can severely impact airplanes, especially within 2,000-ft AGL because of limited
vertical airspace for recovery.
Forecasts of LLWS in the TAF refer only to non-convective LLWS from the surface up to and including
2,000-ft AGL. LLWS is always assumed to be present in convective activity. LLWS is included in TAFs
on an “as-needed” basis to focus the aircrew’s attention on LLWS problems that currently exist or are
expected. Non-convective LLWS may be associated with the following: frontal passage, inversion,
low-level jet, lee-side mountain effect, sea breeze front, Santa Ana winds, etc.
When LLWS conditions are expected, the non-convective LLWS code WS is included in the TAF as the
last group (after cloud forecast). Once in the TAF, the WS group remains the prevailing condition until the
next FM change group or the end of the TAF valid period if there are no subsequent FM groups. Forecasts
of non-convective LLWS are not included in TEMPO or PROB groups.

The format of the non-convective LLWS group is:
WShwshwshws/dddffKT
WS
Indicator for non-convective LLWS.
Hwshwshws
Height of the top of the wind shear layer in hundreds of feet AGL.
Ddd
True direction in 10-degree increments at the indicated height.
(VRB is not used for direction in the non-convective LLWS forecast.)
Ff
Speed in knots of the forecast wind at the indicated height.
KT
Unit indicator for wind.
TAF…13012KT…WS020/27055KT
Wind shear from the surface to 2,000 ft. Surface winds from 130° (southeast) at 12 kt changes to 270° (west)
at 55 kt at 2,000 ft.
In this example, the indicator WS is followed by a three-digit number that is the top of the wind shear layer.
LLWS is forecast to be present from the surface to this level. After the solidus (/), the five-digit wind group
is the wind direction and speed at the top of the wind shear layer. It is not a value for the amount of shear.
A non-convective LLWS forecast is included in the initial time period or an FM group in a TAF whenever:
One or more PIREPs are received of non-convective LLWS within 2,000 ft of the surface, at or in
the vicinity of the TAF airport, causing an indicated air speed loss or gain of 20 kt or more, and the
forecaster determines the report(s) reflect a valid non-convective LLWS event rather than
mechanical turbulence; or
Non-convective vertical wind shear of 10 kt or more per 100 ft in a layer more than 200 ft thick is
expected or reliably reported within 2,000 ft of the surface at, or in the vicinity of, the airport.
27.4.2.10 Forecast Change Indicator Groups
Forecast change indicator groups are contractions that are used to subdivide the forecast period (24 hours
for scheduled TAFs; less for amended or delayed forecasts) according to significant changes in the weather.
The forecast change indicators FM, TEMPO, and PROB are used when a change in any or all of the
forecast elements is expected.
27.4.2.10.1 From (FM) Group (FMYYGGgg)
The change group FMYYGGgg (voiced as “from”) is used to indicate when prevailing conditions are
expected to change significantly over a period of less than one hour. In these instances, the forecast is
subdivided into time periods using the contraction FM, followed, without a space, by six digits, the first
two of which indicate the day of the month and the final four indicate the time (in hours and minutes Z) the
change is expected to occur. While the use of a four-digit time in whole hours (e.g., 2100Z) is acceptable,
if a forecaster can predict changes and/or events with higher resolution, then more precise timing of the
change to the minute will be indicated. All forecast elements following FMYYGGgg relate to the period
of time from the indicated date and time (YYGGgg) to the end of the valid period of the terminal forecast,
or to the next FM if the terminal forecast valid period is divided into additional periods.
The FM group will be followed by a complete description of the weather (i.e., self-contained), and all
forecast conditions given before the FM group are superseded by those following the group. All elements
of the TAF (e.g., surface wind, visibility, significant weather, clouds, obscurations, and when expected,

non-convective LLWS) will be included in each FM group, regardless of if they are forecast to change or
not. For example, if forecast cloud and visibility changes warrant a new FM group but the wind does not,
the new FM group will include a wind forecast, even if it is the same as the most recently forecast wind.
The only exception to this involves the significant weather group. If no significant weather is expected in
the FM time period group, then significant weather group is omitted. A TAF may include one or more FM
groups, depending on the prevailing weather conditions expected. In the interest of clarity, each FM group
starts on a new line of forecast text, indented five spaces.
KDSM 022336Z 0300/0324 20015KT P6SM BKN015
FM030230 29020G35KT 1SM +SHRA OVC005
TEMPO 0303/0304 30030G45KT 3/4SM -SHSN
FM030500 31010G20KT P6SM SCT025...
A change in the prevailing weather is expected on the third day of the month at 0230 UTC and the third day
of the month at 0500 UTC.
KAPN 312330Z 0100/0124 13008KT P6SM SCT030
FM010320 31010KT 3SM -SHSN BKN015
FM010500 31010KT 1/4SM +SHSN VV007...
Note that the wind in the FM010500 group is the same as the previous FM group but is repeated since all
elements are to be included in a FM group.
27.4.2.10.2 Temporary (TEMPO) Group (TEMPO YYGG/YeYeGeGe)
The change-indicator group TEMPO YYGG/YeYeGeGe is used to indicate temporary fluctuations to
forecast meteorological conditions that are expected to:
Have a high percentage (greater than 50 percent) probability of occurrence;
Last for one hour or less in each instance; and
In the aggregate, cover less than half of the period YYGG to YeYeGeGe.
The first two digits (YY) are the day of the month for the start of the TEMPO. The next two digits (GG)
are the starting hour (UTC). After the solidus (/), the next two digits (YeYe) are the ending day of the month,
while the last two digits (GeGe) are the ending hour (UTC) of the TEMPO period.
Each TEMPO group is placed on a new line in the TAF. The TEMPO identifier is followed by a
description of all the elements in which a temporary change is forecast. A previously forecast element that
has not changed during the TEMPO period is understood to remain the same and will not be included in
the TEMPO group. Only those weather elements forecast to temporarily change are included in the
TEMPO group.
TEMPO groups will not include forecasts of either significant weather in the vicinity (VC) or
non-convective LLWS.
KDDC 221130Z 2212/2312 29010G25KT P6SM SCT025
TEMPO 2215/2217 30025G35KT 1 1/2SM SHRA BKN010...
In the example, all forecast elements in the TEMPO group are expected to be different than the prevailing
conditions. The TEMPO group is valid on the 22nd day of the month from 1500 UTC to 1700 UTC.

KSEA 091125Z 0912/1012 19008KT P6SM SCT010 BKN020 OVC090
TEMPO 0912/0915 -RA SCT010 BKN015 OVC040...
In this example the visibility is not forecast in the TEMPO group. Therefore, the visibility is expected to
remain the same (P6SM) as forecast in the prevailing conditions group. Also, note that in the TEMPO
0912/0915 group, all three cloud layers are included, although the lowest layer is not forecast to change
from the initial time period.
27.4.2.10.3 Probability (PROB) Group (PROB30 YYGG/YeYeGeGe)
The probability group (PROB30 YYGG/YeYeGeGe) is only used by NWS forecasters to forecast a
low-probability occurrence (30 percent chance) of a thunderstorm or precipitation event and its associated
weather and obscuration elements (e.g., wind, visibility, and/or sky condition) at an airport.
The PROB30 group is the forecaster’s assessment of probability of occurrence of the weather event that
follows it. The first two digits (YY) are the day of the month for the start of the PROB30. The next
two digits (GG) are the starting hour (UTC). After the solidus (/), the next two digits (YeYe) are the ending
day of the month, while the last two digits (GeGe) are the ending hour (UTC) of the PROB30 period.
PROB30 is the only PROB group used in NWS’ TAFs.
Note: The U.S. military and international TAFs may use the PROB40 (40 percent chance) group as well.
The PROB30 group is located within the same line of the prevailing condition group, continuing on the
line below if necessary.
Only one PROB30 group may be used in the initial forecast period and in any subsequent FM groups. Note
that the U.S. military and international TAFs do not have these restrictions.
PROB30 groups do not include forecasts of significant weather in the vicinity (VC) or non-convective
LLWS.
FM012100 18015KT P6SM SCT050 PROB30 0123/0201 2SM TSRA OVC020CB
In this example, the PROB30 group is valid on the 1st day of the month at 2300 UTC to the second day of
the month at 0100 UTC.
27.4.2.10.4 TAFs for Joint-Use (Joint Civilian/Military) Airports
The TAF format at some joint-use airports is different from the NWS TAF format as follows:
Visibility is in meters instead of statute miles.
o Example: BECMG 0504/0505 21006KT 9000 BR SKC QNH3005INS.
Includes a forecast of the lowest barometric altimeter setting (QNH) during the forecast period in
inches of mercury.
o Example: BECMG 0504/0505 21006KT 9000 BR SKC QNH3005INS.
Includes a forecast of the maximum temperature (in whole degrees Celsius) and expected time of
occurrence.
o Example: BECMG 0511/0512 16005KT 9999 NSW SKC QNH3006INS TX28/0420Z
TN22/0410Z.
Includes a forecast of the minimum temperature (in whole degrees Celsius) and expected time of
occurrence.

o Example: TN22/0410Z BECMG 0511/0512 16005KT 9999 NSW SKC QNH3006INS
TX28/0420Z TN22/0410Z.
27.4.3 TAF Examples
KPIR 111140Z 1112/1212 13012KT P6SM BKN100 WS020/35035KT
TEMPO 1112/1114 5SM BR
FM111500 16015G25KT P6SM SCT040 BKN250
FM120000 14012KT P6SM BKN080 OVC150 PROB30 1200/1204 3SM TSRA BKN030CB
FM120400 14008KT P6SM SCT040 OVC080 TEMPO 1204/1208 3SM TSRA OVC030CB
Terminal Aerodrome Forecast.
KPIR
Pierre, South Dakota.
Prepared on the 11th day of the month at 1140 UTC.
1112/1212
Valid from the 11th day of the month at 1200 UTC until the
12th day of the month at 1200 UTC.
13012KT
Wind 130° true at 12 kt.
P6SM
Visibility greater than 6 SM.
BKN100
Ceiling 10,000 ft broken.
WS020/35035KT
Wind shear at 2,000 ft, wind from 350° true at 35 kt.
TEMPO 1112/1114
Temporary conditions between the 11th day of the month at
1200 UTC and the 11th day of the month at 1400 UTC.
5SM
Visibility 5 SM.
BR
Mist.
FM111500
From the 11th day of the month at 1500 UTC.
16015G25KT
Wind 160° true at 15 kt gusting to 25 kt.
P6SM
Visibility greater than 6 SM.
SCT040 BKN250
4,000 ft scattered, ceiling 25,000 ft broken.
FM120000
From the 12th day of the month at 0000Z.
14012KT
Wind 140° true at 12 kt.
P6SM
Visibility greater than 6 SM.
BKN080 OVC150
Ceiling 8,000 ft broken, 15,000 ft overcast.
PROB30 1200/1204
30 percent probability between the 12th day of the month at
0000 UTC and the 12th day of the month at 0400 UTC.
3SM
Visibility 3 SM.
TSRA
Thunderstorm with moderate rain showers.
BKN030CB
Ceiling 3,000 ft broken with cumulonimbus.
FM120400
From the 12th day of the month at 0400 UTC.

14008KT
Wind 140° true at 8 kt.
P6SM
Visibility greater than 6 SM.
SCT040 OVC080
4,000 ft scattered, ceiling 8,000 ft overcast.
TEMPO 1204/1208
Temporary conditions between the 12th day of the month at
0400 UTC and the 12th day of the month at 0800 UTC.
3SM
Visibility 3 SM.
TSRA
Thunderstorms with moderate rain showers.
OVC030CB
Ceiling 3,000 ft overcast with cumulonimbus.
TAF AMD
KEYW 131555Z 1316/1412 VRB03KT P6SM VCTS SCT025CB BKN250
TEMPO 1316/1318 2SM TSRA BKN020CB
FM131800 VRB03KT P6SM SCT025 BKN250 TEMPO 1320/1324 1SM TSRA OVC010CB
FM140000 VRB03KT P6SM VCTS SCT020CB BKN120 TEMPO 1408/1412 BKN020CB
TAF AMD
Amended Terminal Aerodrome Forecast.
KEYW
Key West, Florida.
131555Z
Prepared on the 13th day of the month at 1555 UTC.
1316/1412
Valid from the 13th day of the month at 1600 UTC until the
14th day of the month at 1200 UTC
VRB03KT
Wind variable at 3 kt.
P6SM
Visibility greater than 6 SM.
VCTS
Thunderstorms in the vicinity.
SCT025CB BKN250
2,500 ft scattered with cumulonimbus, ceiling 25,000 ft
broken.
TEMPO 1316/1318
Temporary conditions between the 13th day of the month at
1600 UTC and the 13th day of the month at 1800 UTC.
2SM
Visibility 2 SM.
TSRA
Thunderstorms with moderate rain showers.
BKN020CB
Ceiling 2,000 ft broken with cumulonimbus.
FM131800
From the 13th day of the month at 1800 UTC.
VRB03KT
Wind variable at 3 kt.
P6SM
Visibility greater than 6 SM.
SCT025 BKN250
2,500 ft scattered, ceiling 25,000 ft broken.
TEMPO 1320/1324
Temporary conditions between the 13th day of the month at
2000 UTC and the 14th day of the month at 0000 UTC.
1SM
Visibility 1 SM.
TSRA
Thunderstorms with moderate rain showers.

OVC010CB
Ceiling 1,000 ft overcast with cumulonimbus.
FM140000
From the 14th day of the month at 0000 UTC.
VRB03KT
Variable wind at 3 kt.
P6SM
Visibility greater than 6 SM.
VCTS
Thunderstorms in the vicinity.
SCT020CB BKN120
2,000 ft scattered with cumulonimbus, ceiling 12,000 ft
broken.
TEMPO 1408/1412
Temporary conditions between the 14th day of the month at
0800 UTC and the 14th day of the month at 1200 UTC.
BKN020CB
Ceiling 2,000 ft broken with cumulonimbus.
27.4.4 Issuance
Scheduled TAFs prepared by NWS offices are issued at least four times a day, every six hours. Some
locations have amendments routinely issued three hours after the initial issuance. The issuance schedule is
shown in Table 27-7.The issuance of a new TAF cancels any previous TAF for the same location.
Table 27-7. TAF Issuance Schedule
Scheduled Issuance
Valid Period
End Time for
30 Hour
Issuance Window
0000 UTC
0000 to 0000
0600 UTC
2320 to 2340 UTC
0300 UTC (AMD)
0300 to 0000 UTC
0600 UTC

0600 UTC
0600 to 0600
1200 UTC
0520 to 0540 UTC
0900 UTC (AMD)
0900 to 0600 UTC
1200 UTC

1200 UTC
1200 to 1200
1800 UTC
1120 to 1140 UTC
1500 UTC (AMD)
1500 to 1200 UTC
1800 UTC

1800 UTC
1800 to 1800
0000 UTC
1720 to 1740 UTC
2100 UTC (AMD)
2100 to 1800 UTC
0000 UTC

27.4.4.1 Minimum Observational Criteria for Routine TAF Issuance and Continuation
The NWS forecaster must have certain information for the preparation and scheduled issuance of each
individual TAF. Although integral to the TAF writing process, a complete surface (METAR/SPECI)
observation is not needed. Forecasters use the “total observation concept” to write TAFs with data including
nearby surface observations, radar, satellite, radiosonde, model data, aircraft, and other sources.
If information sources, such as surface observations, are missing, unreliable, or not complete, forecasters
will append AMD NOT SKED to the end of a TAF. The use of AMD NOT SKED indicates the forecaster
has enough data, using the total observation concept, to issue a forecast, but will not provide updates. This
allows airport operations to continue using a valid TAF.

In rare situations where observations have been missing for extended periods of time (i.e., more than one
TAF cycle of six hours) and the total observation concept cannot provide sufficient information, the TAF
may be suspended by the use of NIL TAF.
27.4.4.2 Sites with Scheduled Part-Time Observations
For TAFs with less than 24-hour observational coverage, the TAF will be valid to the end of the routine
scheduled forecast period even if observations cease prior to that time. The time observations are scheduled
to end and/or resume will be indicated by expanding the AMD NOT SKED statement. Expanded
statements will include the observation ending time (AFT Y1Y1HHmm, e.g., AFT 120200), the scheduled
observation resumption time (TIL Y1Y1HHmm, e.g., TIL 171200Z) or the period of observation
unavailability (Y1Y1HH/YeYehh, e.g., 2502-2512). TIL will be used only when the beginning of the
scheduled TAF valid period coincides with the time of the last observation or when observations are
scheduled to resume prior to the next scheduled issuance time. When used, these remarks will immediately
follow the last forecast group. If a routine TAF issuance is scheduled to be made after observations have
ceased, but before they resume, the remark AMD NOT SKED will immediately follow the valid period
group of the scheduled issuance. After sufficient data using the total observation concept has been received,
the AMD NOT SKED remark will be removed.
Examples of Scheduled Part-Time Observations TAFs:
TAF AMD
KRWF 150202Z 1502/1524 {TAF text}
AMD NOT SKED 1505Z-1518Z=
No amendments will be available between the 15th day of the month at 0500 UTC and the 15th day of the
month at 1800 UTC due to lack of a complete observational set between those times.
TAF AMD
KPSP 190230Z 1903/1924 {TAF text}
AMD NOT SKED=
Amendments are not scheduled.
27.4.4.3 Automated Observing Sites Requiring Part-Time Augmentation
TAFs for automated stations without present weather and obstruction to vision information and have no
augmentation or only part-time augmentation are prepared using the procedures for part-time manual
observation sites detailed in the previous section, with one exception. This exception is the remark used
when the automated system is unattended. Specifically, the time an augmented automated system is
scheduled to go into unattended operation and/or the time augmentation resumes is included in a remark
unique to automated observing sites: AMD LTD TO CLD VIS AND WIND (AFT YYHHmm, or TIL
YYhhmm, or YYHH-YYhh), where YY is the date, HHmm is the time, in hours and minutes, of last
augmented observation, and hhmm is the time, in hours and minutes, the second complete observation is
expected to be received. This remark, which does not preclude amendments for other forecast elements, is
appended to the last scheduled TAF issued prior to the last augmented observation. It will also be appended
to all subsequent amendments until augmentation resumes.
The AMD LTD TO (elements specified) remark is a flag for users and differs from the AMD NOT SKED
AFT Z remark for part-time manual observation sites. AMD LTD TO means users should expect
amendments only for those elements and the times specified.
TAF AMD
KCOE 150202Z 1502/1524 text
AMD LTD TO CLD VIS AND WIND 1505-1518=

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-4-00-wind-and-temperature-aloft-forecast-periods-mode.html">
<table><caption>Table 27-2. Wind and Temperature Aloft Forecast Periods 
Model 
Run 
Product 
Available 
6-Hour Forecast
12-Hour Forecast
24-Hour Forecast
Valid 
For Use 
Valid 
For Use 
Valid 
For Use 
0000Z 
~0200Z</caption><thead><tr><th></th><th></th><th>6-Hour Forecast</th><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody><tr><td>Model
Run</td><td></td><td></td><td></td><td>12-Hour Forecast</td><td></td><td>24-Hour Forecast</td><td></td></tr><tr><td></td><td>Product</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td>Available</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>Valid</td><td>For Use</td><td>Valid</td><td>For Use</td><td>Valid</td><td>For Use</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>0600Z</td><td>0200-0900Z</td><td>1200Z</td><td>0900-1800Z</td><td>0000Z</td><td>1800-0600Z</td></tr><tr><td>0000Z</td><td>~0200Z</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>1200Z</td><td>0800-1500Z</td><td>1800Z</td><td>1500-0000Z</td><td>0600Z</td><td>0000-1200Z</td></tr><tr><td>0600Z</td><td>~0800Z</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>1800Z</td><td>1400-2100Z</td><td>0000Z</td><td>2100-0600Z</td><td>1200Z</td><td>0600-1800Z</td></tr><tr><td>1200Z</td><td>~1400Z</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>0000Z</td><td>2000-0300Z</td><td>0600Z</td><td>0300-1200Z</td><td>1800Z</td><td>1200-0000Z</td></tr><tr><td>1800Z</td><td>~2000Z</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-4-01-generic-format-of-the-national-weather-service-s.html">
<table><caption>Table 27-3. Generic Format of the National Weather Service’s TAFs 
TAF  
or  
TAF AMD  
or  
TAF COR 
  
  
  
Type of report 
  
CCCC 
YYGGggZ 
Y1Y1G1G1/Y2Y2G2G2 
dddffGfmfmKT 
Location identifier 
D</caption><thead><tr><th></th><th></th><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody><tr><td>TAF
or
TAF AMD
or
TAF COR</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>Type of report</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>CCCC YYGGggZ Y Y G G /Y Y G G dddffGf f KT
1 1 1 1 2 2 2 2 m m
Location identifier Date/time of forecast Valid period Wind group
origin group</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>VVVV w’w’ NNNhhh WSh h h /dddftKT
s s s s s s ws ws ws
or or
NSW VVhhh
s s s
or
SKC
Visibility group Significant weather Cloud and vertical Non-convective LLWS group
group obscuration groups</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>TTGGgg
Forecast change
indicator groups</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>FMY Y GGgg TEMPO Y Y GG/Y Y G G PROB30 Y Y GG/Y Y G G
1 1 1 1 e e e e 1 1 e e e e
From group Temporary group Probability group</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-4-02-table-27-4-taf-fog-terms-term-description-freezi.html">
<table><caption>Table 27-4. 
Table 27-4. TAF Fog Terms 
Term 
Description 
Freezing Fog 
(FZFG) 
Any fog (visibility less than 5/8 SM) consisting predominantly of water 
droplets at temperatures less than or equal to</caption><thead><tr><th>Term</th><th>Description</th></tr></thead><tbody><tr><td></td><td>Any fog (visibility less than 5/8 SM) consisting predominantly of water
droplets at temperatures less than or equal to 32 °F (0°C), whether or not
rime ice is expected to be deposited. FZBR is not a valid significant weather
combination and will not be used in TAFs.</td></tr><tr><td>Freezing Fog</td><td></td></tr><tr><td>(FZFG)</td><td></td></tr><tr><td></td><td></td></tr><tr><td>Shallow Fog</td><td>The visibility at 6 ft AGL is greater than or equal to 5/8 SM and the apparent
visibility in the fog layer is less than 5/8 SM.</td></tr><tr><td>(MIFG)</td><td></td></tr><tr><td></td><td>Fog patches covering part of the airport. The apparent visibility in the fog
patch or bank is less than 5/8 SM, with the foggy patches extending to at
least 6 ft AGL.</td></tr><tr><td>Patchy Fog</td><td></td></tr><tr><td>(BCFG)</td><td></td></tr><tr><td></td><td></td></tr><tr><td></td><td>A substantial part of the airport is expected to be covered by fog while the
remainder is expected to be clear of fog (e.g., a fog bank).
Note: MIFG, PRFG, and BCFG may be forecast with prevailing visibility of
P6SM.</td></tr><tr><td>Partial Fog</td><td></td></tr><tr><td>(PRFG)</td><td></td></tr><tr><td></td><td></td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-4-03-taf-use-of-vicinity-vc-phenomenon-coded-fog-vcfg.html">
<table><caption>Table 27-5. TAF Use of Vicinity (VC) 
Phenomenon 
Coded 
Fog* 
VCFG 
Shower(s)** 
VCSH 
Thunderstorm 
VCTS 
*Always coded as VCFG regardless of visibility in the obstruction, 
and without qualificatio</caption><thead><tr><th>Phenomenon</th><th>Coded</th></tr></thead><tbody><tr><td>Fog* VCFG</td><td></td></tr><tr><td>Shower(s)**</td><td>VCSH</td></tr><tr><td>Thunderstorm</td><td>VCTS</td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-4-04-taf-use-of-vicinity-vc-phenomenon-coded-fog-vcfg.html">
<table><caption>Table 27-5. TAF Use of Vicinity (VC) 
Phenomenon 
Coded 
Fog* 
VCFG 
Shower(s)** 
VCSH 
Thunderstorm 
VCTS 
*Always coded as VCFG regardless of visibility in the obstruction, 
and without qualificatio</caption><thead><tr><th>Sky Cover Contraction</th><th>Sky Coverage</th></tr></thead><tbody><tr><td>SKC 0 oktas</td><td></td></tr><tr><td>FEW</td><td>0 to 2 oktas</td></tr><tr><td>SCT</td><td>3 to 4 oktas</td></tr><tr><td>BKN</td><td>5 to 7 oktas</td></tr><tr><td>OVC</td><td>8 oktas</td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-4-05-the-issuance-of-a-new-taf-cancels-any-previous-t.html">
<table><caption>Table 27-7.The issuance of a new TAF cancels any previous TAF for the same location. 
Table 27-7. TAF Issuance Schedule 
Scheduled Issuance 
Valid Period 
End Time for 
30 Hour 
Issuance Window 
0000</caption><thead><tr><th></th><th>Valid Period</th><th></th><th></th></tr></thead><tbody><tr><td>Scheduled Issuance</td><td></td><td>End Time for</td><td></td></tr><tr><td></td><td></td><td></td><td>Issuance Window</td></tr><tr><td></td><td></td><td>30 Hour</td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td>0000 UTC</td><td>0000 to 0000</td><td>0600 UTC</td><td>2320 to 2340 UTC</td></tr><tr><td>0300 UTC (AMD)</td><td>0300 to 0000 UTC</td><td>0600 UTC</td><td></td></tr><tr><td>0600 UTC</td><td>0600 to 0600</td><td>1200 UTC</td><td>0520 to 0540 UTC</td></tr><tr><td>0900 UTC (AMD)</td><td>0900 to 0600 UTC</td><td>1200 UTC</td><td></td></tr><tr><td>1200 UTC</td><td>1200 to 1200</td><td>1800 UTC</td><td>1120 to 1140 UTC</td></tr><tr><td>1500 UTC (AMD)</td><td>1500 to 1200 UTC</td><td>1800 UTC</td><td></td></tr><tr><td>1800 UTC</td><td>1800 to 1800</td><td>0000 UTC</td><td>1720 to 1740 UTC</td></tr><tr><td>2100 UTC (AMD)</td><td>2100 to 1800 UTC</td><td>0000 UTC</td><td></td></tr></tbody></table>
</div>
