---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 27
section_title: Watch Notification Messages
faa_pages: 27-59..27-63
section_number: 17
subsection_number: 4
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Watch Notification Messages

27.17.3 Extended Convective Forecast Product (ECFP)
The ECFP planning tool (see Figure 27-31) is a graphical representation of the forecast probability of
thunderstorms and is intended to support the long-range planning for convective constraints in the NAS.
The product identifies graphically where thunderstorms are expected through the next 72 hours over the
CONUS. Although the ECFP uses TCF-style graphics to facilitate ease of interpretation, the ECFP does
not forecast TCF criteria.
The development of the ECFP planning tool was a response to FAA and industry needs in planning for
weather hazards, specifically convection, one to three days in advance. To meet these planning needs, the
ECFP provides traffic planners and collaborators a quick look at where the probability of convection is
greatest. By utilizing TCF-style graphics, users familiar with the TCF can easily determine where traffic
constraints are most likely to occur over the next three days.
The ECFP is an automated forecast product issued by the AWC. It is issued four times a day at
approximately 0100, 0700, 1300, and 1900 UTC.

Figure 27-31. ECFP Example
27.17.4 Watch Notification Messages
The NWS SPC issues severe weather Watch Notification Messages to provide an area threat alert for the
aviation meteorology community to forecast organized severe thunderstorms that may produce tornadoes,
large hail, and/or convective damaging winds within the CONUS.

The SPC issues three types of Watch Notification Messages:
Aviation Watch Notification Message (SAW),
Public Severe Thunderstorm Watch Notification Message, and
Public Tornado Watch Notification Message.
The SAW was formerly known as the Alert Severe Weather Watch Bulletin (AWW), as well as the Severe
Weather Forecast Alert. The NWS no longer uses these titles or acronym for this product. The NWS uses
the acronym SAW for the Aviation Watch Notification Message but retains “AWW” in the product header
for processing by weather data systems. The NWS uses the acronym AWW for their Airport Weather
Warning product, which is a completely different product from the SAW (see Section 27.17.4.1).
The Severe Thunderstorm and Tornado Watch Notification Messages were formerly known as the Severe
Weather Watch Bulletins (WW). The NWS no longer uses that title or acronym for this product but retains
“WW” in the product header for processing by weather data systems.
It is important to note the difference between a Severe Thunderstorm (or Tornado) Watch and a Severe
Thunderstorm (or Tornado) Warning. A “watch” means severe weather is possible during the watch valid
time, while a “warning” means that severe weather has been observed or is expected within the hour. Only
the SPC issues Severe Thunderstorm and Tornado Watches, while only NWS WFOs issue Severe
Thunderstorm and Tornado Warnings.
27.17.4.1 Aviation Watch Notification Message (SAW)
The SPC issues the SAW to provide an area threat alert for the aviation meteorology community to forecast
organized severe thunderstorms that may produce tornadoes, large hail, and/or convective damaging winds
as indicated in Public Watch Notification Messages.
The SAW product is an approximation of the area in a watch. For the official area covered by a watch, see
the corresponding Public Watch product. To illustrate, Figure 27-32 is an example of the Aviation Watch
(polygon) compared to the Public Watch (shaded). Also, the SAW is easier to communicate verbally over
the radio and telephone than reciting the entire Public Watch product.

Figure 27-32. Aviation Watch (polygon) Compared to Public Watch (shaded) Example
The SPC will issue the SAW after the proposed convective watch area has been collaborated with the
impacted NWS WFOs defining the approximate areal outline of the watch.
SAWs are nonscheduled, event-driven products valid from the time of issuance to expiration or cancellation
time. Valid times are in UTC. SPC will correct watches for formatting and grammatical errors.
When tornadoes or severe thunderstorms have developed, the local NWS WFO will issue the warnings for
the storms.
27.17.4.1.1 Format and Example of a SAW
SPC forecasters may define the area as a rectangle or parallelogram (X miles either side of the line from
point A to point B, or X miles north and south or east and west of the line from point A to point B). Distances
of the axis coordinates should be in statute miles. The aviation coordinates referencing VOR locations and
state distances will be in nautical miles. Valid times will be in UTC. The watch half width will be in statute
miles. The SAW will contain hail size in inches or half inches (forecaster discretion for tornado watches
associated with hurricanes) surface and aloft, surface convective wind gusts in knots, maximum cloud tops
and the Mean Storm Motion Vector, and replacement information, if necessary.
WWUS30 KWNS 271559
SAW2
SPC AWW 271559
WW 568 TORNADO AR LA MS 271605Z - 280000Z
AXIS..65 STATUTE MILES EAST AND WEST OF LINE..

45ESE HEZ/NATCHEZ MS/ - 50N TUP/TUPELO MS/
..AVIATION COORDS.. 55NM E/W /18WNW MCB - 60E MEM/
HAIL SURFACE AND ALOFT..3 INCHES. WIND GUSTS..70 KNOTS. MAX TOPS TO 550. MEAN
STORM MOTION VECTOR 26030.
LAT...LON 31369169 34998991 34998762 31368948
THIS IS AN APPROXIMATION TO THE WATCH AREA. FOR A
COMPLETE DEPICTION OF THE WATCH SEE WOUS64 KWNS
FOR WOU2.
Table 27-15. Decoding an Aviation Weather Watch Notification Message
Line(s)
Content
Description
WWUS30 KWNS 271559
Communication header with issuance
date/time
SAW2
NWS product type (SAW) and
issuance number (2)
SPC
Issuing office
Product type
Issuance date/time
WW 568
TORNADO
AR LA MS
271605Z - 280000Z
Watch number
Watch type
States affected
Valid date/time period
AXIS..65 STATUTE MILES EAST AND WEST
OF A LINE...
Watch axis
45ESE HEZ/NATCHEZ MS/ - 50N
TUP/TUPELO MS/
Anchor points
…AVIATION COORDS..55NM E/W /18WNW MCB
- 60E MEM/
Aviation coordinates
8–9
HAIL SURFACE AND ALOFT…3 INCHES. WIND
GUSTS..70 KNOTS. MAX TOPS TO 550.
MEAN STORM MOTION VECTOR 26030.
Type, intensity, max tops and mean
storm motion using standard
contractions.
(blank line)

LAT...LON 31369169 34998991 4998762
Latitude and longitude coordinates
(blank line)

13–15
THIS IS AN APPROXIMATION TO THE WATCH
AREA. FOR A COMPLETE DEPICTION OF THE
WATCH SEE WOUS64 KWNS FOR WOU2.
Notice that this is an approximation
of the watch area and for users to
refer to the referenced product for the
actual area
27.17.4.2 Public Severe Thunderstorm Watch Notification Message
The SPC issues a Public Severe Thunderstorm Watch Notification Message when forecasting six or more
hail events of one inch (quarter-sized) diameter or greater or damaging winds of 50 kt (58 mph) or greater.
The forecast event minimum threshold is at least two hours over an area of at least 8,000 mi2. Below these
thresholds, the SPC, in collaboration with affected NWS offices, may issue a watch for smaller areas and

for shorter periods of time when conditions warrant, and for convective watches along coastlines, near the
Canadian border, and near the Mexican border.
A Public Severe Thunderstorm Watch Notification Message contains three bulleted blocks of information:
The geographic area of the watch,
The valid time of the watch, and
A description of the primary threats anticipated within the watch.
A plain text watch summary is included beneath the bulleted information followed by a more detailed
description of the area and axis of the watch.
The SPC includes the term “adjacent coastal waters” when the watch affects coastal waters adjacent to the
Pacific/Atlantic coast, the Gulf of America, or the Great Lakes. Adjacent coastal waters refers to a WFO’s
near-shore responsibility (out to 20 NM for oceans), except for convective watches.
The SPC issues a watch cancellation message when no counties, parishes, independent cities, and/or marine
zones remaining are in the watch area prior to the expiration time. The text of the message will specify the
number and area of the cancelled watch.
27.17.4.3 Public Tornado Watch Notification Message
The SPC issues a Public Tornado Watch Notification Message when forecasting two or more tornadoes or
any tornado that could produce EF-2 or greater damage. The forecast event minimum thresholds are at least
two hours over an area at least 8,000 mi2. Below these thresholds, the SPC, in collaboration with affected
NWS offices, may issue a watch for smaller areas and for shorter periods of time when conditions warrant,
and for convective watches along coastlines, near the Canadian border, and near the Mexican border.
A Public Tornado Watch Notification Message contains the following:
The area description and axis,
The watch expiration time,
The term “damaging tornadoes,”
A description of the largest hail size and strongest thunderstorm wind gusts expected,
The definition of the watch,
A call-to-action statement,
A list of other valid watches,
A brief discussion of meteorological reasoning, and
Technical information for the aviation community.
The SPC may enhance a Public Tornado Watch Notification Message by using the words “THIS IS A
PARTICULARLY DANGEROUS SITUATION” when there is a likelihood of multiple strong (damage of
EF-2 or EF-3) or violent (damage of EF-4 or EF-5) tornadoes.
The SPC includes the term “adjacent coastal waters” when the watch affects coastal waters adjacent to the
Pacific/Atlantic coast or the Gulf of America. Adjacent coastal waters refers to a WFO’s near-shore
responsibility (out to 20 NM for oceans), which includes portions of the Great Lakes.
The SPC issues a watch cancellation message whenever it cancels a watch prior to the expiration time. The
text of the message will specify the number and area of the cancelled watch.

![Figure 27-31. ECFP Example 
27.17.4 Watch Notification Messages 
The NWS SPC issues severe weather Watch Notification Messages to provide an area threat alert for the 
aviation meteorology community to forecast organized severe thunderstorms that may produce tornadoes, 
large hail, and/or convective damaging winds with](/handbooks/avwx/FAA-H-8083-28B/figures/fig-27-17-4-00-ecfp-example-27-17-4-watch-notification-messages.png)

![Figure 27-32. Aviation Watch (polygon) Compared to Public Watch (shaded) Example 
The SPC will issue the SAW after the proposed convective watch area has been collaborated with the 
impacted NWS WFOs defining the approximate areal outline of the watch. 
SAWs are nonscheduled, event-driven products valid from the time o](/handbooks/avwx/FAA-H-8083-28B/figures/fig-27-17-4-01-aviation-watch-polygon-compared-to-public-watch-.png)

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-17-4-00-decoding-an-aviation-weather-watch-notification-.html">
<table><caption>Table 27-15. Decoding an Aviation Weather Watch Notification Message 
Line(s) 
Content 
Description 
1 
WWUS30 KWNS 271559 
Communication header with issuance 
date/time 
2 
SAW2 
NWS product type (SA</caption><thead><tr><th>Line(s)</th><th>Content</th><th>Description</th></tr></thead><tbody><tr><td>Communication header with issuance
1 WWUS30 KWNS 271559
date/time</td><td></td><td></td></tr><tr><td>1</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>SAW2</td><td>NWS product type (SAW) and
issuance number (2)</td></tr><tr><td>2</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>SPC
AWW
271559</td><td>Issuing office
Product type
Issuance date/time</td></tr><tr><td>3</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>WW 568
TORNADO
AR LA MS
271605Z - 280000Z</td><td>Watch number
Watch type
States affected
Valid date/time period</td></tr><tr><td>4</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>AXIS..65 STATUTE MILES EAST AND WEST
OF A LINE...</td><td>Watch axis</td></tr><tr><td>5</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>45ESE HEZ/NATCHEZ MS/ - 50N
TUP/TUPELO MS/</td><td>Anchor points</td></tr><tr><td>6</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>…AVIATION COORDS..55NM E/W /18WNW MCB
- 60E MEM/</td><td>Aviation coordinates</td></tr><tr><td>7</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td>HAIL SURFACE AND ALOFT…3 INCHES. WIND
GUSTS..70 KNOTS. MAX TOPS TO 550.
MEAN STORM MOTION VECTOR 26030.</td><td>Type, intensity, max tops and mean
storm motion using standard
contractions.</td></tr><tr><td>8–9</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td>10</td><td>(blank line)</td><td></td></tr><tr><td></td><td>LAT...LON 31369169 34998991 4998762
31368948</td><td>Latitude and longitude coordinates</td></tr><tr><td>11</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr><tr><td>12</td><td>(blank line)</td><td></td></tr><tr><td></td><td>THIS IS AN APPROXIMATION TO THE WATCH
AREA. FOR A COMPLETE DEPICTION OF THE
WATCH SEE WOUS64 KWNS FOR WOU2.</td><td>Notice that this is an approximation
of the watch area and for users to
refer to the referenced product for the
actual area</td></tr><tr><td>13–15</td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>
</div>
