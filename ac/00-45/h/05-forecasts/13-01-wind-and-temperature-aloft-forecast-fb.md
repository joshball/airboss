5.13.1 Wind and Temperature Aloft Forecast (FB).
       Wind and Temperature Aloft Forecasts (FB) are computer-prepared forecasts of wind
       direction, wind speed, and temperature at specified times, altitudes, and locations. FBs
       are available on http://www.aviationweather.gov in both text and graphic format.

       5.13.1.1   Issuance.
                  The NWS NCEP produces scheduled FB Wind and Temperature Aloft
                  Forecasts four times daily for specified locations in the CONUS, the Hawaiian
                  Islands, Alaska and coastal waters, and the western Pacific Ocean. Specified
                  locations are documented on http://www.aviationweather.gov under ADDS
                  Wind Temp Data Web page.

                  Amendments are not issued to the forecasts. Wind forecasts are not issued for
                  altitudes within 1,500 ft of a location’s elevation. Temperature forecasts are
                  not issued for altitudes within 2,500 ft of a location’s elevation.

       5.13.1.2   Format.
                  The AWC’s Web site provides a graphical depiction of the FB wind and
                  temperature forecasts as well as a text version.

                                              5-96

11/14/16                        Aviation Weather Services                         AC 00-45H

      5.13.1.2.1 Graphical Display.
                 The AWC’s Web site provides an interactive display (see Figure 5-43, FB
                 Wind and Temperature Aloft Interactive Display Example) of the FB wind
                 and temperature forecasts.

       Figure 5-43. FB Wind and Temperature Aloft Interactive Display Example

                The interactive graphic depicts wind speed (knots) and direction (referenced
                to true north) using standard windbarb display. Temperature (Celsius) is
                placed to the upper left of the station circle.

                A click on the station displays the wind and temperature forecast and station
                three-letter identification in a separate text window. When the “Hover” option
                is selected, the wind and temperature text window appears by merely placing
                the cursor over the station.

                                           5-97

11/14/16                         Aviation Weather Services                          AC 00-45H

                 Selected altitudes (3,000, 6,000, 9,000, 12,000, 18,000, 24,000, 30,000,
                 34,000, 39,000, 45,000, and 53,000 ft) and forecast valid times (6-, 12- and
                 24-hour) can be changed using the pulldown menus under “Data Options.”

      5.13.1.2.2 Text Format.
                 Forecasts are provided for select altitudes and locations. Some locations have
                 additional altitudes.

                 The text format for the FB wind and temperature forecasts uses the symbolic
                 form DDff+TT in which DD is the wind direction, ff the wind speed, and TT
                 the temperature.

                 Wind direction is indicated in tens of degrees (two digits) with reference to
                 true north and wind speed is given in knots (two digits). Light and variable
                 wind or wind speeds of less than 5 kts are expressed by 9900. Forecast wind
                 speeds of 100 through 199 kts are indicated by subtracting 100 from the speed
                 and adding 50 to the coded direction. For example, a forecast of 250 degrees,
                 145 kts, is encoded as 7545. Forecast wind speeds of 200 kts or greater are
                 indicated as a forecast speed of 199 kts. For example, 7799 is decoded as
                 270 degrees at 199 kts or greater.

                 Temperature is indicated in degrees Celsius (two digits) and is preceded by
                 the appropriate algebraic sign for the levels from 6,000 through 24,000 ft.
                 Above 24,000 ft, the sign is omitted since temperatures are always negative at
                 those altitudes.

                 The product header includes the date and time observations were collected,
                 the forecast valid date and time, and the time period during which the forecast
                 is to be used.

      5.13.1.2.3 Examples.

                 1312+05
                 The wind direction is from 130 degree (i.e. southeast), the wind speed is
                 12 kts, and the temperature is 5 ºCelsius.

                 9900+10
                 Wind light and variable, temperature +10 ºCelsius.

                 7735-07
                 The wind direction is from 270 degrees (i.e. west), the wind speed is 135 kts,
                 and the temperature is minus 7 ºCelsius.

                                             5-98

11/14/16                        Aviation Weather Services                           AC 00-45H

      5.13.1.2.4 Coding Example.
                 Sample winds aloft text message:

      DATA BASED ON 010000Z
      VALID 010600Z FOR USE 0500-0900Z. TEMPS NEG ABV 24000
      FT 3000 6000 9000 12000 18000 24000 30000 34000 39000
      MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30 247242 258848
      550252

                Sample message decoded:

                DATA BASED ON 010000Z
                Forecast data is based on computer forecasts generated the first day of
                the month at 0000 UTC.

                VALID 010600Z FOR USE 0500-0900Z. TEMPS NEG ABV
                24000
                The valid time of the forecast is the 1st day of the month at 0600 UTC. The
                forecast winds and temperature are to be used between 0500 and 0900 UTC.
                Temperatures are negative above 24,000 ft.

                FT 3000 6000 9000 12000 18000 24000 30000 34000
                39000
                FT indicates the altitude of the forecast.

                MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30
                247242 258848 550252
                MKC indicates the location of the forecast. The rest of the data is the winds
                and temperature aloft forecast for the respective altitudes.

                Table 5-18, Wind and Temperature Aloft Forecast Decoding Examples, shows
                data for MKC (Kansas City, MO).

                                            5-99

11/14/16                                        Aviation Weather Services                                     AC 00-45H

             Table 5-18. Wind and Temperature Aloft Forecast Decoding Examples

                               FT 3000 6000 9000 12000 18000 24000 30000 34000 39000
                        MKC 9900 1709+06 2018+00 2130-06 2242-18 2361-30 247242 258848 550252

   Altitude (feet)             Coded                              Wind                          Temperature (˚C)

        3,000 FT                9900                        Light and variable                      Not forecast

        6,000 FT               1709+06                 170 degrees at 9 knots                   +06 degrees Celsius

        9,000 FT               2018+00                 200 degrees at 18 knots                  Zero degrees Celsius

       12,000 FT               2130-06                 210 degrees at 30 knots                  -06 degrees Celsius

       18,000 FT               2242-18                 220 degrees at 42 knots                  -18 degrees Celsius

       24,000 FT               2361-30                 230 degrees at 61 knots                  -30 degrees Celsius

       30,000 FT               247242                  240 degrees at 72 knots                  -42 degrees Celsius

       34,000 FT               258848                  250 degrees at 88 knots                  -48 degrees Celsius

       39,000 FT               750252                 250 degrees at 102 knots                  -52 degrees Celsius

          5.13.1.3       Use.
                         Table 5-19, Wind and Temperature Aloft Forecast (FB) Periods, provides the
                         time periods for use of FB Wind and Temperature forecasts.

                    Table 5-19. Wind and Temperature Aloft Forecast (FB) Periods

                                          6 hour Forecast                 12 hour Forecast          24 hour Forecast
                   Product
Model Run
                   Available
                                    Valid          For Use             Valid         For Use     Valid         For Use

0000Z        ~0200Z               0600Z       0200-0900Z            1200Z        0900-1800Z    0000Z      1800-0600Z
0600Z        ~0800Z               1200Z       0800-1500Z            1800Z        1500-0000Z    0600Z      0000-1200Z
1200Z        ~1400Z               1800Z       1400-2100Z            0000Z        2100-0600Z    1200Z      0600-1800Z
1800Z        ~2000Z               0000Z       2000-0300Z            0600Z        0300-1200Z    1800Z      1200-0000Z