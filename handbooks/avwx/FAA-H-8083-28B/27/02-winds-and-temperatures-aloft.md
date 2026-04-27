---
handbook: avwx
edition: FAA-H-8083-28B
chapter_number: 27
section_title: Winds and Temperatures Aloft
faa_pages: 27-3..27-5
section_number: 2
source_url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
---

# Winds and Temperatures Aloft

Additional Convection Products:
o
Convective Outlook
o
Traffic Flow Management (TFM) Convective Forecast (TCF)
o
Extended Convective Forecast Product (ECFP)
o
Watch Notification Messages
o
Corridor Integrated Weather System and Consolidated Storm Prediction for Aviation
Route Forecasts (ROFOR)
Aviation Forecast Discussions (AFD)
Meteorological Impact Statements (MIS)
Soaring Forecasts
Balloon Forecasts
27.2 Winds and Temperatures Aloft
There are many wind and temperature aloft forecasts and products produced by the NWS. Each NWP model
(i.e., sometimes referred to as computer models) outputs wind and temperature at multiple levels. The
primary output of these forecasts is a gridded binary code format intended for use in flight planning
software.
There is no official wind and temperature aloft model for flight planning. Depending on the computer
model, the validity times, time intervals, and altitude levels will vary. Some models produce wind and
temperature forecasts at hourly time-steps while others produce forecasts at six-hour time steps. A few
models provide wind forecasts at 1,000-ft altitude levels while others are mostly at 3,000-ft altitude levels.
The data points (location) will also vary depending on the source.
Because each computer model is based on different algorithms and physics, the wind and temperature
forecasts will vary from model to model. These differences are due, in part, to the model’s forecast pressure
patterns on the surface and aloft. In addition, some models have more detailed terrain as well as finer
spacing between data points.
For many years there was just one set of wind and temperature forecasts, known as the FD Winds (then
later as the FB Winds), which were presented in a coded text table format (see Section 27.2.1.1.2).
Today’s flight planning software directly imports wind and temperature data from various computer
models, which has effectively made the coded text table format obsolete.
Although FB winds are still produced today, they are archaic compared with model output available to the
pilot and flight planner. FB winds:
Are updated only four times daily, so winds that differ from the forecast are not updated for up to
six hours.
Provide a single value for each of three broad periods of time: from issuance time through seven
hours, seven hours through 16 hours, and 16 hours through 28 hours.
Provide a value at scattered locations in the country separated by about 100 to 150 mi.

In contrast, for example, the NWS’ Rapid Refresh model winds:
Are updated every hour based partly on automated wind reports from airliners.
Provide a wind forecast for each hour into the future.
Provide values at grid points separated by as low as 9 SM.
This section describes the details of the FB Wind and Temperature Aloft Forecast product. Other sections
within this handbook provide additional wind and temperature aloft forecasts (i.e., constant pressure level
forecasts [see Section 27.11.1) and the global wind and temperature forecasts provided under the WAFS
(see Section 27.8)].
27.2.1 FB Wind and Temperature Aloft Forecast
FB Wind and Temperature Aloft Forecasts are computer-prepared forecasts of wind direction, wind
speed, and temperature at specified times, altitudes, and locations.
27.2.1.1 FB Wind and Temperature Aloft Forecast Issuance
The NWS NCEP produces scheduled FB Wind and Temperature Aloft Forecasts four times daily for
specified locations in the CONUS, the Hawaiian Islands, Alaska and coastal waters, and the western Pacific
Ocean.
Amendments are not issued to the forecasts. Wind forecasts are not issued for altitudes within 1,500 ft of a
location’s elevation. Temperature forecasts are not issued for altitudes within 2,500 ft of a location’s
elevation.
27.2.1.1.1 FB Wind and Temperature Aloft Forecast Text Format
The text format for the FB Wind and Temperature Aloft Forecast uses the symbolic form DDff+TT in
which DD is the wind direction (true), ff is the wind speed, and TT is the temperature.
Wind direction is indicated in tens of degrees (two digits) with reference to true north and wind speed is
given in knots (two digits). Light and variable wind or wind speeds of less than 5 kt are expressed by 9900.
Forecast wind speeds of 100 through 199 kt are indicated by adding 50 to the first two digits of the wind
direction and subtracting 100 from the speed. For example, a forecast of 250°, 145 kt, is encoded as 7545.
Forecast wind speeds of 200 kt or greater are indicated as a forecast speed of 199 kt. For example, 7799 is
decoded as 270° at 199 kt or greater.
Temperature is indicated in degrees Celsius (two digits) and is preceded by the appropriate algebraic sign
for the levels from 6,000 through 24,000 ft. Above 24,000 ft, the sign is omitted since temperatures are
always negative at those altitudes.
The product header includes the date and time observations were collected, the forecast valid date and time,
and the time period during which the forecast is to be used.
27.2.1.1.2 FB Wind and Temperature Aloft Forecast Coding Example
Sample winds aloft text message:
DATA BASED ON 010000Z
VALID 010600Z FOR USE 0500-0900Z. TEMPS NEG ABV 24000
FT 3000 6000 9000 12000 18000 24000 30000 34000 39000
MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30 247242 258848 750252

Sample message decoded:
DATA BASED ON 010000Z
Forecast data is based on computer forecasts generated the 1st day of the month at 0000 UTC.
VALID 010600Z FOR USE 0500-0900Z. TEMPS NEG ABV 24000
The valid time of the forecast is the 1st day of the month at 0600 UTC. The forecast winds and
temperatures are to be used between 0500 and 0900 UTC. Temperatures are negative above 24,000 ft.
FT 3000 6000 9000 12000 18000 24000 30000 34000 39000
FT indicates the altitude of the forecast.
MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30 247242 258848 750252
MKC indicates the location of the forecast. The rest of the data is the wind and temperature aloft forecast
for the respective altitudes.
Table 27-1 shows data for Kansas City, MO (MKC). Table 27-2 provides the time periods for the use of
FB Wind and Temperature Forecasts.
Table 27-1. Wind and Temperature Aloft Forecast Decoding Examples
FT 3000 6000 9000 12000 18000 24000 30000 34000 39000
MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30 247242 258848 550252
Altitude (ft)
Coded
Wind
Temperature (˚C)
3,000 ft
Light and variable
Not forecast
6,000 ft
1709+06
170° at 9 kt
+06 °C
9,000 ft
2018+00
200° at 18 kt
Zero °C
12,000 ft
210° at 30 kt
-06 °C
18,000 ft
220° at 42 kt
-18 °C
24,000 ft
230° at 61 kt
-30 °C
30,000 ft
240° at 72 kt
-42 °C
34,000 ft
250° at 88 kt
-48 °C
39,000 ft
250° at 102 kt
-52 °C

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-2-00-untitled.html">
<table><thead><tr><th>There are many wind and temperature aloft forecasts and products produced by the NWS. Each NWP model</th><th></th></tr></thead><tbody><tr><td>(i.e., sometimes referred to as computer models) outputs wind and temperature at multiple levels. The</td><td></td></tr><tr><td>primary output of these forecasts is a gridded binary code format intended for use in flight planning</td><td></td></tr><tr><td>software.</td><td></td></tr></tbody></table>
</div>

<div class="handbook-table" data-source="/handbooks/avwx/FAA-H-8083-28B/tables/tbl-27-2-01-wind-and-temperature-aloft-forecast-decoding-exa.html">
<table><caption>Table 27-1. Wind and Temperature Aloft Forecast Decoding Examples 
FT 3000 6000 9000 12000 18000 24000 30000 34000 39000 
MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30 247242 258848 550252 
Altitud</caption><thead><tr><th></th><th></th><th></th><th></th></tr></thead><tbody><tr><td>FT 3000 6000 9000 12000 18000 24000 30000 34000 39000</td><td></td><td></td><td></td></tr><tr><td>MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30 247242 258848 550252</td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>Wind</td><td></td></tr><tr><td>Altitude (ft)</td><td>Coded</td><td></td><td>Temperature (˚C)</td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>Light and variable</td><td>Not forecast</td></tr><tr><td>3,000 ft</td><td>9900</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>170° at 9 kt</td><td>+06 °C</td></tr><tr><td>6,000 ft</td><td>1709+06</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>200° at 18 kt</td><td>Zero °C</td></tr><tr><td>9,000 ft</td><td>2018+00</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>210° at 30 kt</td><td>-06 °C</td></tr><tr><td>12,000 ft</td><td>2130-06</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>220° at 42 kt</td><td>-18 °C</td></tr><tr><td>18,000 ft</td><td>2242-18</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>230° at 61 kt</td><td>-30 °C</td></tr><tr><td>24,000 ft</td><td>2361-30</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>240° at 72 kt</td><td>-42 °C</td></tr><tr><td>30,000 ft</td><td>247242</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>250° at 88 kt</td><td>-48 °C</td></tr><tr><td>34,000 ft</td><td>258848</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td>250° at 102 kt</td><td>-52 °C</td></tr><tr><td>39,000 ft</td><td>750252</td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>
</div>
