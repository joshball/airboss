---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 25
section_title: Real-Time Mesoscale Analysis (RTMA)
faa_pages: 25-24..25-25
section_number: 9
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Real-Time Mesoscale Analysis (RTMA)

Finally, while the “C” in CIP stands for “current,” the product does not show the current conditions, rather
it depicts the computer’s expected conditions at the valid time shown on the product. This valid time can
be an hour old or more depending on when it is received by the user.
See Section 27.13 for additional information on the FIP.
25.6 Turbulence (Graphical Turbulence Guidance Nowcast (GTG-N))
The GTG Nowcast (GTG-N) product has been developed as a tactical aid for aviation. GTG-N provides a
nowcast of the current turbulent state of the atmosphere over the CONUS in near real-time, updating every
15 minutes. The basis for the nowcast is the most recently available short-term (one-hour) forecast from
the GTG product whose valid time is closest to the current update time. Recent observations of turbulence
are then used to update the GTG forecast and create a blended nowcast (expressed as EDR).
Current inputs include PIREPs, automated in situ EDR reports, and EDR estimated from ground-based
radar observations via the Next-Generation Radar (NEXRAD) Turbulence Detection Algorithm (NTDA).
In future upgrades, lightning, wind/gust observations from METARs, and EDR derived from ADS-B
vertical rate data will be assimilated as well.
GTG-N is available at 100 ft MSL, 1000 ft MSL, then every 1000 ft up to FL500.
See Section 27.14 for additional information on the GTG forecast.
25.7 Real-Time Mesoscale Analysis (RTMA)
RTMA is an hourly analysis system by the NWS’ Environmental Modeling Center that produces analyses
of surface weather elements. The FAA has determined that RTMA temperature and altimeter setting
information is a suitable replacement for missing temperature and altimeter setting observations for a subset
of airports. RTMA temperature and altimeter setting information is intended for use by operators, pilots,
and aircraft dispatchers when an airport lacks a surface temperature and/or altimeter setting report from an
automated weather system (e.g., ASOS or AWOS sensor) or human observer. Airports with RTMA data
available are located in Alaska, Guam, Hawaii, Puerto Rico, and the CONUS.
RTMA is issued by the NWS every hour, 24 hours a day. Temperatures and altimeter settings are reported
for an airport station including the latitude and the longitude. Temperatures are reported in degrees Celsius.
Altimeter setting is reported in inches of mercury. See Figure 25-25 for an example RTMA temperature
and altimeter setting report.

25.7.1 Adjustments
The values found at the RTMA site are 95 percent accurate throughout the United States for both
temperature and altimeter setting when using the following mitigations:
Temperature requires adding 4°C to the RTMA-derived temperature.
Altimeter setting requires increasing the minimum descent altitude (MDA) or decision height
(DH) value on the approach chart by 100 ft and increasing the required flight visibility minimums
by ½ SM.
*****************************************************************
RTMA 2m-temperature (degrees Celsius) and altimeter setting
(inHg)
COMPUTED: 1239Z 25 Jan 2024
VALID: 1239Z 25 Jan 2024 to 1339Z 25 Jan 2024
*****************************************************************
Station
Lat
Lon
2m-T
ALT
KABE
40.65
-75.44
3.43
30.19
KABI
32.41
-99.68
7.31
30.08
KABQ
35.04
-106.61
1.67
N/A
KABR
45.45
-98.42
-2.06
30.02
KABY
31.54
-84.19
19.07
30.15
KACK
41.25
-70.06
8.98
30.14
KACT
31.61
-97.23
10.00
30.06
KACV
40.98
-124.11
9.74
30.22
KACY
39.46
-74.58
11.59
30.17
KADS
32.97
-96.84
8.69
N/A
KAEX
31.33
-92.55
15.29
29.96
KAFW
32.99
-97.32
8.40
30.06
KAGS
33.37
-81.96
18.85
30.21
KAHN
33.95
-83.33
16.51
30.23
KAIA
42.05
-102.80
-4.11
29.94
KALB
42.75
-73.80
3.18
30.09
KALN
38.89
-90.05
3.02
30.12
KALO
42.56
-92.40
1.03
30.10
Figure 25-25. RTMA Surface Temperature and Altimeter Setting Example
