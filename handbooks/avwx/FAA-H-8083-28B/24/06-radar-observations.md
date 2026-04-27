---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 24
section_title: Radar Observations
faa_pages: 24-36..24-44
section_number: 6
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Radar Observations

they are processed and disseminated.11 Participating airlines add turbulence information with these reports.
See Figure 24-7 for a plot of AMDAR reports from 2019.
AMDAR reports turbulence in terms of Eddy Dissipation Rate (EDR). EDR is the ICAO standard
dimension for automated turbulence reporting. EDR is a state of the atmosphere measure rather than a state
of the aircraft measure, and is, therefore, independent of aircraft type.
Note: This information is restricted.

Figure 24-7. A Plot of AMDAR Reports Received During a 24-Hour Period in 2019
24.6 Radar Observations
24.6.1 Weather Surveillance Radar—1988 Doppler (WSR-88D) Description
Weather radar observations and their resultant images are graphical displays of precipitation and
non-precipitation targets detected by weather radars. WSR-88D, also known as NEXRAD, displays these
targets on a variety of products, which can be found on the websites of all NWS WFOs, the AWC, the SPC,
and websites and phone applications of various flight planning and weather service providers.
For information on radar basics, see Chapter 15, Weather Radar.

11 In 2019, it was estimated that NOAA was receiving about 600,000 wind and temperature observations per day,
with about 80 percent of the reports over the CONUS. This data comes from more than 9,000 aircraft.

24.6.1.1 Issuance
WSR-88D radars are continuously generating radar observations. Each radar observation, called a volume
scan, consists of 5 to 14 separate elevation “tilts,” and takes between 4 and 11 minutes to generate,
depending on the radar’s mode of operation. Once one observation is complete, the next one begins. Radar
observation times are not standard nor are they synchronized with other radars. The valid time of the
observation is the time assigned to the product, which is the end of the last radar scan.
24.6.1.1.1 WSR-88D Radar (NEXRAD) Network
The WSR-88D radar network consists of 160 radars operated by the NWS, FAA, and DOD. Figure 24-8,
Figure 24-9, and Figure 24-10 show the locations of the radars.

Locations of WSR-88D weather radar are indicated by gray circles. Red circles indicate radars that are temporarily
out of service.
Figure 24-8. Locations of WSR-88D Weather Radar in the CONUS
Gulf of
America

Figure 24-9. WSR-88D Weather Radar Coverage at 3,000 ft AGL, 6,000 ft AGL, and 10,000 ft AGL over the CONUS
and Puerto Rico

Figure 24-10. Additional Locations of WSR-88D Weather Radar and Coverage Outside of the CONUS
24.6.1.2 Coverage
Figure 24-9 and Figure 24-10 depict the radar coverage at 3,000 ft AGL, 6,000 ft AGL, and 10,000 ft AGL
(i.e., above the height of the radar). *Several WSR-88D radars are located in mountainous areas, such as
the western United States. For example, the radar in southern Utah (near Cedar City) is on top of a 10,000ft mountain. This means that the coverage begins at 10,000 ft AGL in that area. Any precipitation from
low-topped clouds would not be detected by this radar due to overshooting of the radar beam
(see Section 15.2.8).
24.6.1.3 Modes of Operation
The WSR-88D employs scanning strategies in which the antenna automatically raises to higher and higher
preset angles (or elevation scans) as it rotates. These elevation scans comprise a volume coverage pattern
(VCP) that NWS forecasters utilize to help analyze the atmosphere around the radar. These different VCPs
have varying numbers of elevation tilts and rotation speeds of the radar itself. Therefore, each VCP can
provide a different perspective of the atmosphere. Once the radar sweeps through all elevation slices, a
volume scan is complete. The WSR-88D radar can use several VCPs.
There are two main classes of VCPs, which are commonly referred to as Clear Air Mode and Precipitation
Mode.
24.6.1.3.1 Clear Air Mode
In Clear Air Mode, the radar is in its most sensitive operation. The NWS uses Clear Air Mode when there
is no rain within the range of the radar. This mode has the slowest antenna rotation rate, which permits the

radar to sample the atmosphere longer. This slower sampling increases the radar’s sensitivity and ability to
detect smaller objects in the atmosphere. The term “clear air” does not imply “no precipitation” mode. Even
in Clear Air Mode, the WSR-88D can detect light, stratiform precipitation (e.g., snow) due to the increased
sensitivity. Generally, the only returned energy to the radar will be very close to the radar’s location.
Many of the radar returns in Clear Air Mode are airborne dust and particulate matter. The WSR-88D images
are updated approximately every 10 minutes when operating in this mode.
24.6.1.3.2 Precipitation Mode
Precipitation targets typically provide stronger return signals to the radar than non-precipitation targets.
Therefore, the WSR-88D is operated in Precipitation Mode when precipitation is present, although some
non-precipitation echoes can still be detected in this operating mode. The NWS uses Precipitation Mode to
see higher into the atmosphere when precipitation is occurring to analyze the vertical structure of the storms.
The faster rotation of the WSR-88D in Precipitation Mode allows images to update at a faster rate,
approximately every four to six minutes.
24.6.1.4 Echo Intensities
The colors on radar images represent the reflective power of the precipitation target. In general, the amount
of radar power received is proportional to the intensity of the precipitation. This reflective power,
commonly referred to by meteorologists as “reflectivity,” is measured in terms of dBZ. A decibel is a unit
that describes the change of power emitted versus the power received. Since the power emitted is constant,
the power received is related to the intensity of the precipitation target. Each reflectivity image includes a
color scale that describes the relationship among reflectivity value, color on the radar image, and
precipitation intensity (see Figure 24-11). The color scale and decibel scale can vary depending on the
service provider and website.
Reflectivity is correlated to intensity of precipitation. For example, in Precipitation Mode, when the decibel
value reaches 15, light precipitation is present. The higher the indicated reflectivity value, the higher the
rainfall rate. The interpretation of reflectivity values is the same for both Clear Air and Precipitation Modes.

Figure 24-11. Example WSR-88D (NEXRAD) Weather Radar Echo Intensity Legend
Reflectivity is also correlated with intensity terminology (phraseology) for ATC purposes. Table 24-8
defines this correlation.
Table 24-8. WSR-88D Weather Radar Precipitation Intensity Terminology
Reflectivity
(dBZ) Ranges
Weather Radar Echo
Intensity Terminology
<26 dBZ
Light
26–40 dBZ
Moderate
>40–50 dBZ
Heavy
50+ dBZ
Extreme
Note: En route ATC radar’s weather and radar processor (WARP) does
not display light precipitation.

Values below 15 dBZ are typically associated with clouds. However, they may also be caused by
atmospheric particulate matter such as dust, insects, pollen, or other phenomena. The scale cannot reliably
be used to determine the intensity of snowfall. However, snowfall rates generally increase with increasing
reflectivity.
24.6.1.5 Radar Products
The NWS produces many radar products that serve a variety of users. Some of these products are of interest
to the aviation community. This section will discuss radar mosaics, Composite Reflectivity, Base
Reflectivity, and Echo Tops products.
24.6.1.5.1 Radar Mosaic
A radar mosaic consists of multiple single-site radar images combined to produce a radar image on a
regional or national scale. Radar mosaics can be found on the websites of the NWS, AWC, and all NWS
WFOs, as well as commercial aviation weather providers. Radar mosaics can be assembled from Composite
ReflectivityError! Reference source not found., Base Reflectivity, and Echo Tops, depending on the
website or data provider.
24.6.1.5.2 Composite Reflectivity
Because the highest precipitation intensity can be at any altitude, the Composite Reflectivity product
(see Figure 24-12) is needed. Composite Reflectivity is the maximum echo intensity (reflectivity) detected
within a column of the atmosphere above a location. During its tilt sequence, the radar scans through all of
the elevation slices to determine the highest decibel value in the vertical column (see Figure 24-13), then
displays that value on the product. When compared with Base Reflectivity, the Composite Reflectivity can
reveal important storm structure features and intensity trends of storms (see Figure 24-14).
NEXRAD radar displays on airplane avionics use the Composite Reflectivity data for their radar mosaics.

Figure 24-12. WSR-88D Weather Radar Composite Reflectivity, Single-Site Product Example

The Composite Reflectivity product displays the highest reflectivity of all elevation scans.
Figure 24-13. Creation of a Composite Reflectivity, Single-Site Product

This Composite Reflectivity shows that in many locations the highest precipitation intensity occurs at an
altitude higher than precipitation detected at the elevation of the base elevation angle.
Figure 24-14. Weather Radar 0.5° Base Reflectivity (left) versus Composite Reflectivity (right) Comparison
24.6.1.5.3 Base Reflectivity
The Base Reflectivity product is a display of both the location and intensity of reflectivity data from the
lowest elevation angle scan, or 0.5° above the horizon. Base Reflectivity is also known as “Lowest Tilt”
and “Reflectivity at Lowest Altitude,” depending on the website or weather data service provider.

The Base Reflectivity product is one elevation scan, whereas Composite Reflectivity looks at all elevation
scans. Base Reflectivity products are available several minutes sooner than Composite Reflectivity
products. Precipitation at any location may be heavier than depicted on the Base Reflectivity image because
it is occurring above the lowest elevation angle.
Depending on the radar website or service provider, the range of the Base Reflectivity single-site radar
product is either 124 NM or 248 NM. When using a single-site radar (i.e., not using a radar mosaic), echoes
farther than 124 NM from the radar site might not be displayed, even if precipitation may be occurring at
these greater distances.
24.6.1.5.4 Echo Tops
An Echo Tops product provides an estimation of the top of the precipitation by using the height of 18 dBZ
radar echo above sea level. Cloud tops will be higher than the top of the precipitation.
24.6.1.6 Limitations
Limitations associated with Composite Reflectivity and Base Reflectivity images include:
The radar beam may overshoot or undershoot targets (see Section 15.2.8).
Also, the image may be contaminated by (see Sections 15.2.9 through 15.2.14):
o Beam blockage.
o Ground clutter.
o Ghosts.
o Angels.
o Anomalous Propagation (AP).
o Other non-meteorological phenomena.
Limitations associated with mosaics include:
Datalinked mosaic radar imagery shows where the precipitation was, not where the precipitation is
occurring. The displayed radar precipitation may be 15 to 20 minutes older than the age indicated
on the display.
24.6.2 Terminal Doppler Weather Radar (TDWR)
The terminal Doppler weather radar (TDWR) is a Doppler weather radar system operated by the FAA,
which is used primarily for the detection of hazardous wind shear conditions, precipitation, and winds aloft
on and near major airports situated in climates with great exposure to thunderstorms (see Figure 24-15).

TWDR locations are indicated by gray circles.
Figure 24-15. TDWR Locations in the CONUS and Puerto Rico
.

Figure 24-16. TDWR Coverage

![Figure 24-7. A Plot of AMDAR Reports Received During a 24-Hour Period in 2019 
24.6 Radar Observations 
24.6.1 Weather Surveillance Radar—1988 Doppler (WSR-88D) Description 
Weather radar observations and their resultant images are graphical displays of precipitation and 
non-precipitation targets detected by weather r](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-00-a-plot-of-amdar-reports-received-during-a-24-hou.png)

![Figure 24-8. Locations of WSR-88D Weather Radar in the CONUS 
Gulf of 
America](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-01-locations-of-wsr-88d-weather-radar-in-the-conus-.png)

![Figure 24-9. WSR-88D Weather Radar Coverage at 3,000 ft AGL, 6,000 ft AGL, and 10,000 ft AGL over the CONUS 
and Puerto Rico](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-02-wsr-88d-weather-radar-coverage-at-3-000-ft-agl-6.png)

![Figure 24-10. Additional Locations of WSR-88D Weather Radar and Coverage Outside of the CONUS 
24.6.1.2 Coverage 
Figure 24-9 and Figure 24-10 depict the radar coverage at 3,000 ft AGL, 6,000 ft AGL, and 10,000 ft AGL 
(i.e., above the height of the radar). *Several WSR-88D radars are located in mountainous areas, such](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-03-additional-locations-of-wsr-88d-weather-radar-an.png)

![Figure 24-12. WSR-88D Weather Radar Composite Reflectivity, Single-Site Product Example](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-04-wsr-88d-weather-radar-composite-reflectivity-sin.png)

![Figure 24-13. Creation of a Composite Reflectivity, Single-Site Product 
 
This Composite Reflectivity shows that in many locations the highest precipitation intensity occurs at an 
altitude higher than precipitation detected at the elevation of the base elevation angle. 
Figure 24-14. Weather Radar 0.5° Base Reflectiv](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-05-creation-of-a-composite-reflectivity-single-site.png)

![Figure 24-14. Weather Radar 0.5° Base Reflectivity (left) versus Composite Reflectivity (right) Comparison 
24.6.1.5.3 Base Reflectivity 
The Base Reflectivity product is a display of both the location and intensity of reflectivity data from the 
lowest elevation angle scan, or 0.5° above the horizon. Base Reflectivity](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-06-weather-radar-0-5-base-reflectivity-left-versus-.png)

![Figure 24-15. TDWR Locations in the CONUS and Puerto Rico 
.
 
Figure 24-16. TDWR Coverage](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-07-tdwr-locations-in-the-conus-and-puerto-rico-figu.png)

![Figure 24-16. TDWR Coverage](/handbooks/avwx/FAA-H-8083-28B/figures/fig-24-6-08-tdwr-coverage.png)

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-24-6-00-wsr-88d-weather-radar-precipitation-intensity-te.html">
<table><caption>Table 24-8. WSR-88D Weather Radar Precipitation Intensity Terminology 
Reflectivity 
(dBZ) Ranges 
Weather Radar Echo 
Intensity Terminology 
&lt;26 dBZ 
Light 
26–40 dBZ 
Moderate 
&gt;40–50 dBZ 
Heavy 
50</caption><thead><tr><th>Reflectivity</th><th>Weather Radar Echo
Intensity Terminology</th></tr></thead><tbody><tr><td>(dBZ) Ranges</td><td></td></tr><tr><td>&lt;26 dBZ Light</td><td></td></tr><tr><td>26–40 dBZ</td><td>Moderate</td></tr><tr><td>&gt;40–50 dBZ</td><td>Heavy</td></tr><tr><td>50+ dBZ</td><td>Extreme</td></tr><tr><td></td><td></td></tr></tbody></table>
</div>
