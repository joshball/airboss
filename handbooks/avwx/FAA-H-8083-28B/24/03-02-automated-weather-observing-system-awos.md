---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 24
section_title: Automated Weather Observing System (AWOS)
faa_pages: 24-3..24-4
section_number: 3
subsection_number: 2
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Automated Weather Observing System (AWOS)

report when conditions exceed preselected weather element thresholds (e.g., the visibility decreases to less
than three miles).
All ASOS locations prepare and disseminate METARs/SPECIs in accordance with the format shown in
Section 24.4.3.
24.3.1.1 ASOS One-Minute Observations (OMO)
In addition to the ASOS METARs/SPECIs are ASOS OMOs, which are updated once a minute. OMOs can
be in various formats and are sometimes encoded in the METAR format.
ASOS broadcasts can be different from the METAR seen on the internet or FIS-B, since the broadcast is
the OMO ASOS data.
The OMOs are not “instant weather”; rather, the clouds and visibility are time averaged (30 minutes for
clouds, 10 minutes for visibility). The averaging algorithms are designed to report deteriorating conditions
much quicker than improving conditions.
24.3.1.2 ASOS Reporting
ASOS reports the following basic weather elements:
Sky condition: cloud height and amount (e.g., clear, few, scattered, broken, overcast) up to 12,000 ft
(future upgrade may raise height limit).
Visibility (to at least 10 SM).
Basic present weather information: type and intensity for rain (RA), snow (SN), freezing rain
(FZRA), and unknown precipitation (UP).
Thunderstorms on site (TS) or in the vicinity (VCTS).
Obstructions to vision: fog (FG), mist (BR), and haze (HZ).
Note: FG is reported when visibility is less than 5/8 SM. Freezing fog (FZFG) is reported when
temperature is below 0°C. BR or HZ is reported for visibilities from 5/8 SM to less than 7 SM,
depending on the difference between the temperature and dewpoint. If the difference is 4°F (about
2°C) or less, then BR is reported; otherwise, HZ is reported.
Pressure: sea level pressure and altimeter setting.
Temperature: ambient temperature and dewpoint temperature.
Wind: direction from which the wind is blowing, speed, and character (e.g., gusts, squalls).
Note: National network distribution (e.g., FSS, internet, and FIS-B) of wind direction is in true
degrees, while local dissemination (e.g., radio and telephone) is in magnetic degrees.
Precipitation: accumulation.
Selected significant remarks including variable cloud height, variable visibility, precipitation
beginning/ending times, rapid pressure changes, pressure change tendency, wind shift, and peak
wind, and may include density altitude.
24.3.2 Automated Weather Observing System (AWOS)
AWOS is a system similar to ASOS. Generally, AWOS does not report all the elements that ASOS reports
and may not have the same level of backup sensors or maintenance response levels. Regardless, AWOS

provides pilots with the necessary weather information to conduct 14 CFR part 91 flight operations as well
as others, depending on their operations specifications (OpSpecs).
AWOS automatically provides computer-generated voice observations directly to aircraft in the vicinity of
airports, using FAA ground-to-air radio. AWOS reports are also available via a telephone.
AWOS may be located on airports, at or near ground-based or rooftop-based heliports, as well as on
offshore platforms and drill ships.
AWOS are either Federal or non-Federal. Federal AWOS units are owned, operated, and maintained by the
FAA. Non-Federal AWOS are owned, operated, and maintained by the site owner.
AWOS generates a METAR at 20-minute intervals and does not report SPECIs. AWOS also provides
OMOs available by phone or radio.
The OMOs are not “instant weather;” rather, the clouds and visibility are time averaged (30 minutes for
clouds, 10 minutes for visibility). The averaging algorithms are designed to report deteriorating conditions
much quicker than improving conditions. For example, if dense fog had been reported and then suddenly
dissipated, it might take up to 10 minutes for the OMOs to report VFR conditions.
There are six types of AWOS systems:
AWOS-A: The AWOS-A system measures and reports altimeter only.
AWOS-AV: The AWOS-AV consists of an AWOS-A with a visibility sensor.
AWOS-1: The AWOS-1 system measures and reports wind data (e.g., speed, direction, and gusts;
temperature; dewpoint; altimeter; and density altitude).
AWOS-2: The AWOS-2 system measures and reports all of the parameters of an AWOS-1 system
plus visibility.
AWOS-3: The AWOS-3 system measures and reports all of the parameters of an AWOS-2 system
plus precipitation accumulation (rain gauge) and cloud height. AWOS-3 can have optional sensors
such as precipitation type/intensity (present weather, P) and/or thunderstorm/lightning (T). The
addition of an optional sensors will change the designation to AWOS-3P or AWOS-3PT.
AWOS-4: The AWOS-4 system measures and reports all of the AWOS-3PT parameters plus
freezing rain.
Depending on the type of AWOS unit, the following parameters may be measured:
Altimeter.
Wind speed.
Wind direction (from which the wind is blowing).
Note: National network distribution (e.g., FSS, internet, and FIS-B) of wind direction is in true
degrees, while local dissemination (e.g., radio and telephone) is in magnetic degrees.
Gusts.
Temperature.
Dewpoint.
Density altitude.
Visibility.
Precipitation accumulation.
