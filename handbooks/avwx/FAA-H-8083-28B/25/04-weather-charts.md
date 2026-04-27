---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 25
section_title: Weather Charts
faa_pages: 25-2..25-17
section_number: 4
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Weather Charts

We recognize that in today’s world, an increasing amount of analyzed weather information is available
from multiple sources. These sources provide a wide range of meteorological data, such as surface
observations, radar, and satellite imagery, and use advanced techniques to combine these inputs into
accurate, high-resolution weather analyses products. These high-resolution analyses products can provide
METAR-equivalent data (ceiling, visibility, temperature, dew point pressure, wind direction, wind speed)
across grid that extend well beyond airport locations.
Analyzed Surface Weather information refers to weather data from sources other than the currently
approved ground-based ASOS and AWOS weather reporting systems. Alternate sources may include:
Model-derived, gridded estimates of current conditions,
In situ observations from novel data sources, such as UAS or weather cameras, and
Surface sensors that are currently not approved for producing METARs.
FAA Flight Standards has investigated the use of Analyzed Weather Information since 2015 as an
alternative source of weather information when elements are missing from ASOS and AWOS reports. In
May of 2024, Flight Standards completed a Safety Risk Management Panel (SRMP) to assess the risk of
using Analyzed Weather Information (for all required weather elements) for Part 121 and 135 operations
when sensed weather is not available (i.e., no ASOS/AWOS sensor) or missing (i.e., incomplete weather
information from an ASOS/AWOS METAR). The Safety Risk Management Document (SRMD) concludes
that implementation of identified mitigations to address performance variability of the analyzed weather
information (to include latency and geographic variability), all hazards would be reduced to a low risk level,
equivalent to current operational standards in the NAS regarding Weather Information. Results of the
SRMP supports a path forward to enable the use of Analyzed Weather as an approved source of weather
information when weather information is not available from an ASOS or AWOS.
At terminal locations that provide METARs, occasionally the information required for flight operations is
missing and this impacts the ability to sustain operations. Improved back-up information from an approved
weather source is required for efficiency and to sustain safe operations. In an effort to mitigate these
disruptions, since 2015, Flight Standards approved the use of NWS Real-Time Mesoscale Analysis
(RTMA) for operators to use temperature information at airports where an ASOS/AWOS has failed. In
early 2024, Flight Standards also approved the use of Altimeter Setting (pressure) information at airports
where an ASOS/AWOS has failed. More details on RTMA are in Section 25.7.
With the assumption that a METAR is representative of weather within five miles of the terminal area
where the METAR is taken, this equates to two percent of Alaska and three percent of the lower 48
contiguous United States having “Certified Weather” information from “Approved Sources” at airports
where a METAR is produced. Certified weather systems from approved sources are too expensive to fill
these gaps across the NAS. However, utilizing existing FAA certified sensors from approved sources with
these other various types of meteorological data from multiple sources could easily help fill this gap.
25.2 Weather Charts
A weather chart is a map on which data and analyses are presented that describe the state of the atmosphere
over a large area at a given moment in time.
The possible variety of such charts is enormous, but in meteorological history there has been a more or less
standard set of charts, including surface charts and the constant-pressure charts of the upper atmosphere.
Because weather systems are three dimensional (3D), both surface and upper air charts are needed. Surface
weather charts depict weather on a constant-altitude (usually sea level) surface, while upper air charts depict
weather on constant-pressure surfaces.

The NWS produces many weather charts that support the aviation community.
25.2.1 Weather Observation Sources
Weather analysis charts can be based on observations from a variety of data sources (see Figure 25-1),
including:
Land surface [e.g., ASOS, AWOS, and the National Mesonet].
Marine surface [e.g., ship, buoy, Coastal-Marine Automated Network (C-MAN), and tide gauge].
Sounding [e.g., radiosonde, dropsonde, pibal, profiler, and Doppler weather radar Velocity
Azimuth Display (VAD) wind profile].
Aircraft [e.g., AIREPs and PIREPs), AMDAR, and Aircraft Communications Addressing and
Reporting System (ACARS)].
Satellite [e.g., GOES sensors that provide temperature, moisture, and wind (through cloud
movement)].
Note: Human observers can augment automated reports.

Figure 25-1. Weather Observation Sources
25.2.2 Analysis
Analysis is the drawing and interpretation of the patterns of various elements on a weather chart. It is an
essential part of the forecast process. If meteorologists do not know what is currently occurring, it is nearly
impossible to predict what will happen in the future. Computers have been able to analyze weather charts
for many years and are commonly used in the process. However, computers cannot interpret what they
analyze. Thus, many meteorologists still perform a subjective analysis of weather charts when needed.
25.2.2.1 Analysis Procedure
The analysis procedure is similar to drawing in a dot-to-dot coloring book. Just as one would draw a line
from one dot to the next, analyzing weather charts is similar in that lines of equal values, or isopleths, are
drawn between dots representing various elements of the atmosphere. An isopleth is a broad term for any
line on a weather map connecting points with equal values of a particular atmospheric variable. See Table
25-1 for common isopleths.

Table 25-1. Common Isopleths
Isopleth
Variable
Definition
Isobar
Pressure
A line connecting points of equal or constant pressure.
Contour Line (also
called Isoheight)
Height
A line of constant elevation above MSL of a defined surface,
typically a constant-pressure surface.
Isotherm
Temperature
A line connecting points of equal or constant temperature.
Isotach
Wind Speed
A line connecting points of equal wind speed.
Isohume
Humidity
A line drawn through points of equal humidity.
Isodrosotherm
Dewpoint
A line connecting points of equal dewpoint.
The weather chart analysis procedure begins with a map of the plotted data, which is to be analyzed
(see Figure 25-2). It is assumed that bad or obviously incorrect data has been removed before beginning the
analysis process. At first, the chart will appear to be a big jumble of numbers. However, when the analysis
procedure is complete, patterns will appear, and significant weather features will be revealed.
25.2.2.1.1 Step 1: Determine the Optimal Contour Interval and Values to be Analyzed
The first step in the weather chart analysis procedure is to identify the maxima and minima data values and
their ranges to determine the optimal contour interval and values to be analyzed. The best contour interval
will contain enough contours to identify significant weather features, but not so many that the chart becomes
cluttered. Each weather element has a standard contour interval on NWS weather charts, but these values
can be adjusted in other analyses as necessary.

Figure 25-2. Analysis Procedure Step 1: Determine the Optimal Contour Interval and Values to be Analyzed

Every contour value must be evenly divisible by the contour interval. So, for example, if the contour interval
is every four units, a 40-unit contour is all right, but a 41-unit contour is not. In the surface pressure analysis
example shown in Figure 25-2, an isobar analysis will be performed beginning at a value of 992 mb and
using a contour interval of four mb, which is standard on the NWS Surface Analysis Chart.
25.2.2.1.2 Step 2: Draw the Isopleths and Extrema
The second step is to draw the isopleths and extrema (maxima and minima) using the beginning contour
value and contour interval chosen in the first step (see Figure 25-3). It is usually easiest to begin drawing
an isopleth either at the edge of the data domain (edge of the chart) or at a data point that matches the
isopleth value being drawn. Interpolation must often be used to draw isopleths between data points and
determine the extrema. “Interpolate” means to estimate a value within an interval between known values.
When drawing isopleths and extrema on a weather chart, certain rules must be followed:
1. The analysis must remain within the data domain. Analysis must never be drawn beyond
the edge of the chart where there are no data points. That would be guessing.
2. Isopleths must not contain waves and kinks between two data points. This would indicate
a feature too small to be supported by the data. Isopleths should be smooth and drawn
generally parallel to each other.
3. When an isopleth is complete, all data values must be higher than the isopleth’s value on
one side of the line and lower on the other.
4. A closed-loop isopleth must contain an embedded extremum (maximum or minimum).
5. When a maximum (minimum) is identified, data values must decrease (increase) in all
directions away from it.
6. Isopleths can never overlap, intersect, or cross over extrema. It is impossible for one
location to have more than one data value simultaneously.
7. Each isopleth must be labeled. A label must be drawn wherever an isopleth exits the data
domain. For closed-loop isopleths, a break in the loop must be created where a label can
be drawn. For very long and/or complex isopleths, breaks should be created where
additional labels can be drawn, as necessary.
8. Extrema must be labeled. Extrema are often denoted by an “x” embedded within a circle.
Beneath the label, the analyzed value of the field must be written and underlined.
9. Isopleths and labels should not be drawn over the data point values. If necessary, breaks
in the isopleths should be created so that the data point values can still be read.

Figure 25-3. Analysis Procedure Step 2: Draw the Isopleths and Extrema
25.2.2.1.3 Step 3: Identify Significant Weather Features
The third (and final) step is to interpret significant weather features. The conventional labels for extrema
are H (high) and L (low) for pressure and height, W (warm) and K (cold) for temperature (they stand for
the German words for warm and cold), and X (maxima) and N (minima) for all other elements. Tropical
storms, hurricanes, and typhoons are low-pressure systems with their names and central pressures denoted.
Troughs, ridges, and other significant features are often identified as well.
For surface analysis charts, positions and types of fronts are shown by symbols in Figure 25-4. The symbols
on the front indicate the type of front and point in the direction toward which the front is moving. Two short
lines across a front indicate a change in front type.

Table 25-2 provides the most common weather chart symbols. In the surface pressure analysis in Figure
25-4, a high, low, trough, and ridge have been identified.

1  4
1  4

Table 25-2. Common Weather Chart Symbols
Feature
Symbol
Definition
Low

A minimum of atmospheric pressure in two dimensions (closed
isobars) on a surface chart, or a minimum of height (closed
contours) on a constant-pressure chart. Also known as a cyclone.
High

A maximum of atmospheric pressure in two dimensions (closed
isobars) on a surface chart, or a maximum of height (closed
contours) on a constant-pressure chart. Also known as an
anticyclone.
Trough
An elongated area of relatively low atmospheric pressure or height.
Ridge

An elongated area of relatively high atmospheric pressure or
height. May also be used as reference to other meteorological
quantities, such as temperature and dewpoint.

Figure 25-4. Analysis Procedure Step 3: Interpret Significant Weather Features
25.2.3 Surface Analysis Chart
The WPC in College Park, MD, produces a variety of surface analysis charts for North America that are
available on their website. The WPC’s surface analysis is also available on the AWC’s and other providers’
websites.

A surface chart (also called surface map or sea level pressure chart) is an analyzed chart of surface weather
observations. Essentially, a surface chart shows the distribution of sea level pressure (lines of equal pressure
are isobars). Hence, the surface chart is an isobaric analysis showing identifiable, organized pressure
patterns. The chart also includes the positions of highs, lows, ridges, and troughs, and the location and
character of fronts and various boundaries, such as drylines, outflow boundaries, and sea breeze fronts.
Although the pressure is referred to as MSL, all other elements on this chart are presented as they occur at
the surface point of observation. A chart in this general form is the one commonly referred to as the weather
map. See Figure 25-5 for a schematic example of a surface chart.

Figure 25-5. Schematic of Surface Chart Pressure Patterns
Figure 25-7 is one example of several surface analysis products available on the WPC’s website.
Some of the WPC’s surface analysis charts are combined with radar or satellite imagery (see Figure 25-8
and Figure 25-9) as well as having different background features (e.g., terrain).
25.2.3.1 Issuance
The WPC issues surface analysis charts for North America eight times daily, valid at 00, 03, 06, 09, 12, 15,
18, and 21 UTC.

25.2.3.2 Analysis Symbols

Figure 25-6 shows analysis symbols used on NWS surface analysis charts.

Figure 25-6. NWS Surface Analysis Chart Symbols
25.2.3.3 Examples

Figure 25-7. Example of a Surface Chart with Surface Observations

Figure 25-8. Surface Analysis with Radar Composite Example

Figure 25-9. Surface Analysis with Satellite Composite Example

25.2.3.4 Station Plot Models
Land, ship, buoy, and C-MAN stations are plotted on the chart to aid in analyzing and interpreting the
surface weather features. These plotted observations are referred to as station models. Some stations may
not be plotted due to space limitations. However, all reporting stations are used in the analysis.
Figure 25-10 and Figure 25-11 contain the most commonly used station plot models used in surface analysis
charts.

Figure 25-10. NWS Surface Analysis Chart Station Plot Model

Figure 25-11. NWS Surface Analysis Chart Ship/Buoy Plot Model

The WPC also produces surface analysis charts specifically for the aviation community. Figure 25-12
contains the station plot model for these charts.

Figure 25-12. NWS Surface Analysis Chart for Aviation Interests Station Plot Model
25.2.3.4.1 Station Identifier
The format of the station identifier depends on the observing platform:
Ship: Typically, four or five characters. If five characters, then the fifth will usually be a digit.
Buoy: Whether drifting or stationary, a buoy will have a five-digit identifier. The first digit will
always be a 4.
C-MAN: Usually located close to coastal areas. Their identifier will appear like a five-character
ship identifier; however, the fourth character will identify off which state the platform is located.
Land: Land stations will always be three characters, making them easily distinguishable from ship,
buoy, and C-MAN observations.
25.2.3.4.2 Temperature
The air temperature is plotted in whole degrees Fahrenheit.
25.2.3.4.3 Dewpoint
The dewpoint temperature is plotted in whole degrees Fahrenheit.
25.2.3.4.4 Weather
A weather symbol is plotted if, at the time of observation, precipitation is either occurring or a condition
exists causing reduced visibility.

Figure 25-13 contains a list of the most common weather symbols.

Figure 25-13. NWS Surface Analysis Chart Common Weather Symbols
25.2.3.4.5 Wind
Wind is plotted in increments of 5 kt. The wind direction is referenced to true north and is depicted by a
stem (line) pointed in the direction from which the wind is blowing. Wind speed is determined by adding
the values of the flags (50 kt), barbs (10 kt), and half-barbs (5 kt) found on the stem.
If the wind is calm at the time of observation, only a single circle over the station is depicted.

Figure 25-14 includes some sample wind symbols.

Figure 25-14. NWS Surface Analysis Chart Sample Wind Symbols
25.2.3.4.6 Ceiling
Ceiling is plotted in hundreds of feet AGL.
25.2.3.4.7 Visibility
Surface visibility is plotted in whole statute miles.
25.2.3.4.8 Pressure
Sea level pressure is plotted in tenths of millibars, with the first two digits (generally 10 or 9) omitted. For
reference, 1,013 mb is equivalent to 29.92 inHg. Below are some sample conversions between plotted and
complete sea level pressure values.
1,041.0 mb
1,010.3 mb
998.7 mb
987.2 mb

25.2.3.4.9 Pressure Trend
The pressure trend has two components, a number and a symbol, to indicate how the sea level pressure has
changed during the past three hours. The number provides the three-hour change in tenths of millibars,
while the symbol provides a graphic illustration of how this change occurred.
Figure 25-15 contains the meanings of the pressure trend symbols.

Figure 25-15. NWS Surface Analysis Chart Pressure Trends
25.2.3.4.10 Sky Cover
The approximate amount of sky cover can be determined by the circle at the center of the station plot. The
amount that the circle is filled reflects the amount of sky covered by clouds. Figure 25-16 contains the
common cloud cover depictions.

Figure 25-16. NWS Surface Analysis Chart Sky Cover Symbols

25.2.3.4.11 Water Temperature
Water temperature is plotted in whole degrees Fahrenheit.
25.2.3.4.12 Swell Information
Swell direction, period, and height are represented in the surface observations by a six-digit code. The first
two digits represent the swell direction, the middle digits describe the swell period (in seconds), and the
last two digits are the swell’s height (in half meters).
090703:
09: The swell direction is from 90° (i.e., it is coming from due east).
07: The period of the swell is seven seconds.
03: The height of the swell is three half m.
271006:
27: The swell direction is from 270° (due west).
10: The period is 10 seconds.
06: The height of the swell is six half m.
25.2.3.4.13 Wave Information
Period and height of waves are represented by a five-digit code. The first digit is always 1. The second and
third digits describe the wave period (in seconds), and the final two digits give the wave height (in
half meters).
10603:
1: A group identifier. The first digit will always be 1.
06: The wave period is six seconds.
03: The wave height is three half m.
10515:
1: A group identifier.
05: The wave period is five seconds.
15: The wave height is 15 half m.
In some charts by the OPC, only the wave height (in feet) is plotted.
25.2.4 Unified Surface Analysis Chart
The NWS Unified Surface Analysis Chart is a surface analysis product produced collectively and
collaboratively by the NWS WPC, the OPC, the NHC, and WFO Honolulu. The chart contains an analysis
of isobars, pressure systems, and fronts.
This chart is available on the OPC’s website. Users can zoom in by clicking an area on the map to enlarge
(see Figure 25-17 and Figure 25-18) and show station plot models (see Section 25.2.3.4).
25.2.4.1 Issuance
The Unified Surface Analysis Chart is issued four times daily for valid times 00, 06, 12, and 18 UTC.

Figure 25-17. Unified Surface Analysis Chart Example

Figure 25-18. Unified Surface Analysis Chart Example (Enlarged Area)
25.2.4.2 Analysis Symbols
Unified Surface Analysis Charts use the symbols shown in Figure 25-6.
25.2.5 AAWU Surface Chart
The NWS Unified Surface Analysis Chart covers the Alaska area. The AAWU also provides a fixed area
image of the Unified Surface Analysis Chart centered over Alaska (see Figure 25-19). This chart is available
from the AAWU’s website.

![Figure 25-1. Weather Observation Sources 
25.2.2 Analysis 
Analysis is the drawing and interpretation of the patterns of various elements on a weather chart. It is an 
essential part of the forecast process. If meteorologists do not know what is currently occurring, it is nearly 
impossible to predict what will happen](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-1-00-weather-observation-sources-25-2-2-analysis-anal.png)

![Figure 25-2. Analysis Procedure Step 1: Determine the Optimal Contour Interval and Values to be Analyzed](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-2-01-analysis-procedure-step-1-determine-the-optimal-.png)

![Figure 25-3. Analysis Procedure Step 2: Draw the Isopleths and Extrema 
25.2.2.1.3 Step 3: Identify Significant Weather Features 
The third (and final) step is to interpret significant weather features. The conventional labels for extrema 
are H (high) and L (low) for pressure and height, W (warm) and K (cold) for temp](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-2-01-analysis-procedure-step-1-determine-the-optimal-.png)

![Figure 25-4. Analysis Procedure Step 3: Interpret Significant Weather Features 
25.2.3 Surface Analysis Chart 
The WPC in College Park, MD, produces a variety of surface analysis charts for North America that are 
available on their website. The WPC’s surface analysis is also available on the AWC’s and other providers’](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-00-analysis-procedure-step-3-interpret-significant-.png)

![Figure 25-5. Schematic of Surface Chart Pressure Patterns 
Figure 25-7 is one example of several surface analysis products available on the WPC’s website. 
Some of the WPC’s surface analysis charts are combined with radar or satellite imagery (see Figure 25-8 
and Figure 25-9) as well as having different background fea](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-01-schematic-of-surface-chart-pressure-patterns-fig.png)

![Figure 25-6. NWS Surface Analysis Chart Symbols 
25.2.3.3 Examples 
 
Figure 25-7. Example of a Surface Chart with Surface Observations](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-02-nws-surface-analysis-chart-symbols-25-2-3-3-exam.png)

![Figure 25-7. Example of a Surface Chart with Surface Observations](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-03-example-of-a-surface-chart-with-surface-observat.png)

![Figure 25-8. Surface Analysis with Radar Composite Example 
 
Figure 25-9. Surface Analysis with Satellite Composite Example](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-04-surface-analysis-with-radar-composite-example-fi.png)

![Figure 25-9. Surface Analysis with Satellite Composite Example](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-05-surface-analysis-with-satellite-composite-exampl.png)

![Figure 25-10. NWS Surface Analysis Chart Station Plot Model 
 
Figure 25-11. NWS Surface Analysis Chart Ship/Buoy Plot Model](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-06-nws-surface-analysis-chart-station-plot-model-fi.png)

![Figure 25-11. NWS Surface Analysis Chart Ship/Buoy Plot Model](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-07-nws-surface-analysis-chart-ship-buoy-plot-model.png)

![Figure 25-12. NWS Surface Analysis Chart for Aviation Interests Station Plot Model 
25.2.3.4.1 Station Identifier 
The format of the station identifier depends on the observing platform: 
• 
Ship: Typically, four or five characters. If five characters, then the fifth will usually be a digit. 
• 
Buoy: Whether drifting](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-08-nws-surface-analysis-chart-for-aviation-interest.png)

![Figure 25-13. NWS Surface Analysis Chart Common Weather Symbols 
25.2.3.4.5 Wind 
Wind is plotted in increments of 5 kt. The wind direction is referenced to true north and is depicted by a 
stem (line) pointed in the direction from which the wind is blowing. Wind speed is determined by adding 
the values of the flags (](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-09-nws-surface-analysis-chart-common-weather-symbol.png)

![Figure 25-14. NWS Surface Analysis Chart Sample Wind Symbols 
25.2.3.4.6 Ceiling 
Ceiling is plotted in hundreds of feet AGL. 
25.2.3.4.7 Visibility 
Surface visibility is plotted in whole statute miles. 
25.2.3.4.8 Pressure 
Sea level pressure is plotted in tenths of millibars, with the first two digits (generally 10](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-10-nws-surface-analysis-chart-sample-wind-symbols-2.png)

![Figure 25-15. NWS Surface Analysis Chart Pressure Trends 
25.2.3.4.10 Sky Cover 
The approximate amount of sky cover can be determined by the circle at the center of the station plot. The 
amount that the circle is filled reflects the amount of sky covered by clouds. Figure 25-16 contains the 
common cloud cover depict](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-11-nws-surface-analysis-chart-pressure-trends-25-2-.png)

![Figure 25-16. NWS Surface Analysis Chart Sky Cover Symbols](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-3-12-nws-surface-analysis-chart-sky-cover-symbols.png)

![Figure 25-17. Unified Surface Analysis Chart Example 
 
Figure 25-18. Unified Surface Analysis Chart Example (Enlarged Area) 
25.2.4.2 Analysis Symbols 
Unified Surface Analysis Charts use the symbols shown in Figure 25-6. 
25.2.5 AAWU Surface Chart 
The NWS Unified Surface Analysis Chart covers the Alaska area. The AA](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-5-00-unified-surface-analysis-chart-example-figure-25.png)

![Figure 25-18. Unified Surface Analysis Chart Example (Enlarged Area) 
25.2.4.2 Analysis Symbols 
Unified Surface Analysis Charts use the symbols shown in Figure 25-6. 
25.2.5 AAWU Surface Chart 
The NWS Unified Surface Analysis Chart covers the Alaska area. The AAWU also provides a fixed area 
image of the Unified Surf](/handbooks/avwx/FAA-H-8083-28B/figures/fig-25-4-5-01-unified-surface-analysis-chart-example-enlarged-.png)

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-25-4-00-common-isopleths-isopleth-variable-definition-is.html">
<table><caption>Table 25-1. Common Isopleths 
Isopleth 
Variable 
Definition 
Isobar 
Pressure 
A line connecting points of equal or constant pressure. 
Contour Line (also 
called Isoheight) 
Height 
A line of consta</caption><thead><tr><th></th><th>Isopleth</th><th></th><th></th><th>Variable</th><th></th><th></th><th>Definition</th><th></th></tr></thead><tbody><tr><td>Isobar</td><td></td><td></td><td>Pressure</td><td></td><td></td><td>A line connecting points of equal or constant pressure.</td><td></td><td></td></tr><tr><td>Contour Line (also
called Isoheight)</td><td></td><td></td><td>Height</td><td></td><td></td><td>A line of constant elevation above MSL of a defined surface,
typically a constant-pressure surface.</td><td></td><td></td></tr><tr><td>Isotherm</td><td></td><td></td><td>Temperature</td><td></td><td></td><td>A line connecting points of equal or constant temperature.</td><td></td><td></td></tr><tr><td>Isotach</td><td></td><td></td><td>Wind Speed</td><td></td><td></td><td>A line connecting points of equal wind speed.</td><td></td><td></td></tr><tr><td>Isohume</td><td></td><td></td><td>Humidity</td><td></td><td></td><td>A line drawn through points of equal humidity.</td><td></td><td></td></tr><tr><td>Isodrosotherm</td><td></td><td></td><td>Dewpoint</td><td></td><td></td><td>A line connecting points of equal dewpoint.</td><td></td><td></td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-25-4-01-common-weather-chart-symbols-feature-symbol-defi.html">
<table><caption>Table 25-2. Common Weather Chart Symbols 
Feature 
Symbol 
Definition 
Low 
 
A minimum of atmospheric pressure in two dimensions (closed 
isobars) on a surface chart, or a minimum of height (closed</caption><thead><tr><th></th><th>Feature</th><th></th><th></th><th>Symbol</th><th></th><th></th><th>Definition</th><th></th></tr></thead><tbody><tr><td>Low</td><td></td><td></td><td></td><td></td><td></td><td>A minimum of atmospheric pressure in two dimensions (closed
isobars) on a surface chart, or a minimum of height (closed
contours) on a constant-pressure chart. Also known as a cyclone.</td><td></td><td></td></tr><tr><td>High</td><td></td><td></td><td></td><td></td><td></td><td>A maximum of atmospheric pressure in two dimensions (closed
isobars) on a surface chart, or a maximum of height (closed
contours) on a constant-pressure chart. Also known as an
anticyclone.</td><td></td><td></td></tr><tr><td>Trough</td><td></td><td></td><td></td><td></td><td></td><td>An elongated area of relatively low atmospheric pressure or height.</td><td></td><td></td></tr><tr><td>Ridge</td><td></td><td></td><td></td><td></td><td></td><td>An elongated area of relatively high atmospheric pressure or
height. May also be used as reference to other meteorological
quantities, such as temperature and dewpoint.</td><td></td><td></td></tr></tbody></table>
</div>
