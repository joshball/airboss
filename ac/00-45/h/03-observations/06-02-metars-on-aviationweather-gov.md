3.6.2   METARs on Aviationweather.gov.

        3.6.2.1     Issuance.
                    Surface observations (METAR and SPECI) are provided on
                    http://www.aviationweather.gov in several formats. The formats range from
                    traditional text (referred to as the raw format) to different types of map
                    displays. The two types of map displays are interactive (see Figure 3-38,
                    Surface Observations—Aviationweather.gov METAR Interactive Display
                    Example) and static (see Figure 3-41).

        3.6.2.1.1   Interactive Display.
                    The interactive display includes zoom and pan. Increasing the zoom allows
                    more METARs to be displayed.

        Figure 3-38. Surface Observations—Aviationweather.gov METAR Interactive
                                      Display Example

                                              3-69

11/14/16                      Aviation Weather Services                           AC 00-45H

           “Plot Options” allows users to choose the weather elements displayed
           (e.g., view only ceilings and visibilities). The following parameters can be
           displayed using a station plot model (see Figure 3-39, Interactive Display
           Station Plot Example):

               Figure 3-39. Interactive Display Station Plot Example

           •     Temp: Temperature in Fahrenheit. Celsius is also available, if metric is
                 selected.
           •     Alt: Atmospheric pressure reduced to MSL.
                 o Where expressed in inches of mercury (Hg) or altimeter setting, the
                   value is expressed in hundredths of an inch where the leading 2 or 3 is
                   omitted (e.g., 982 would be 29.82 in, 025 would be 30.25 in). When
                   trying to determine whether to add a 2 or 3, use the number that will
                   give you a value closest to 30.00 in.
                 o Where expressed in millibars, the value is expressed in tenths of a
                   millibar with the leading 9 or 10 omitted (e.g., 998 would be 999.8 mb,
                   164 would be 1,016.4 mb). When trying to determine whether to add a
                   9 or 10, use the number that will give you a value closest to 1,000 mb.
           •     Ceil: Cloud ceiling in hundreds of feet (BKN, OVC, and OVX only).
           •     Id: The four-letter ICAO identifier for the airport.
           •     Windbarb: The stick points in the direction the winds are coming from.
                 Wind speed is in knots. Red represents wind gusts.
           •     Dew: Dewpoint in Fahrenheit. Celsius is also available, if metric is
                 selected.
           •     Vis: Visibility in miles. Kilometers (km), if metric is selected. Visibility
                 value on the chart may not represent actual value reported in the METAR
                 or SPECI, and may be fractionally lower than shown. (e.g., 2 ½ in the
                 METAR is shown as 3 on the surface plot) (see Table 3-12, Rounding of
                 Actual METAR Visibility Values for Depiction on
                 Aviationweather.gov/AWC METAR Display).
           •     Wx: Weather symbol (see Appendix F, Area Forecasts (FA)—Continental
                 United States (CONUS) and Hawaii) representing current weather.

                                         3-70

11/14/16                                Aviation Weather Services                                 AC 00-45H

                 •    Sky: Cloud cover symbol (see Figure 3-40, Station Plot Sky Symbols) is
                      plotted in the center. The amount the circle is filled represents the amount
                      of cloud cover. The color of the circle represents one of the following
                      weather categories (see Table 3-13, Station Plot Weather Categories):
                      o Green: VFR,
                      o Blue: MVFR,
                      o Red: IFR, or
                      o Purple: Low instrument flight rules (LIFR).

                 A click on the station circle displays the raw METAR in a separate text
                 window. When the Hover option is selected, the raw METAR text window
                 appears by merely placing the cursor over the station circle. If the Decoded
                 option is set, the METAR appears in plain language instead of METAR code.
                 If the TAF option is set, the latest Terminal Aerodrome Forecast (TAF) will
                 be appended to the information in the text window.

       Table 3-12. Rounding of Actual METAR Visibility Values for Depiction on
                     Aviationweather.gov/AWC METAR Display

           Visibility Reported in METAR                     Visibility, as depicted on surface plot

             0, 1/16, 1/8, 3/16, 1/4, 3/8                                    0.3

                         ½                                                   0.5

                         ¾                                                   0.8

                     1 ½, 1 ¾,                                                2

                       2 ½, 3                                                 3

                                                  3-71

11/14/16                                Aviation Weather Services                                    AC 00-45H

                            Table 3-13. Station Plot Weather Categories

             Category*               Color                Ceiling                             Visibility

               LIFR                                                                           Less than
                                   Magenta          Below 500 feet AGL         and/or
             (Low IFR)                                                                         1 mile
                                                        500 to below                     1 mile to less than 3
                IFR                   Red                                      and/or
                                                       1,000 feet AGL                            miles
               MVFR                                    1,000 to 3,000
                                     Blue                                      and/or        3 to 5 miles
           (Marginal VFR)                                feet AGL
                                                                                             Greater than
               VFR                   Green       Greater than 3,000 feet AGL    and
                                                                                               5 miles

   *These categories are not flight rules and should not be confused with the flight rules provided in
   Part 91, including those for Basic VFR Weather Minimums. Rather, these categories were created for
   weather charts as a means to visually enhance the products.

                                Figure 3-40. Station Plot Sky Symbols

    Automated stations report “CLR” when clouds may exist above 12,000 ft, so a square is used to
    represent this uncertainty, whereas an unfilled circle is used for “SKC”, when a human reports the
    sky is completely clear overhead. The abbreviation “OVX” is unofficial, but AWC uses it to indicate
    the sky is obscured, which is the case when a METAR reports vertical visibility and no cloud
    information. “Miss” means the sky condition is missing.

       3.6.2.1.2      Static Display.
                      Static display products are provided on the AWC’s Web site for 19 select
                      regions plus the CONUS. Each product is updated every 5 minutes using the
                      latest METAR or SPECI information. The Web page automatically refresh
                      every 15 minutes.

                      The static display has fewer features than the interactive display. Primarily,
                      the static display does not provide ceiling height. Also, the static display does
                      not have the functionality to display separately the raw METAR or TAF, or
                      change units to metric.

                                                     3-72

11/14/16                        Aviation Weather Services                       AC 00-45H

Figure 3-41. Surface Observations—Aviationweather.gov METAR Static Display Example

                   Figure 3-42. Static Display Station Plot Example

               Station plot descriptions are:

               •   Temp: Temperature in Fahrenheit (F).
               •   Windbarb: The windbarb. The stick points in the direction the winds are
                   coming from.

                                            3-73

11/14/16                            Aviation Weather Services                               AC 00-45H

                   •   Alt: Last three digits of the altimeter setting in inches of mercury. For
                       example, 032 represents 30.32 in Hg.
                   •   Id: The last three letters of the ICAO identifier for the airport.
                   •   Dew: The dewpoint temperature in Fahrenheit.
                   •   Vis: The visibility in statute miles.
                   •   Wx: Weather symbol (see Appendix F) representing current weather.
                   •   Sky: The cloud cover symbol is plotted in the center. The amount the
                       circle is filled represents the amount of cloud cover. The color of the circle
                       represents one of the following weather categories:
                       o Green: VFR,
                       o Blue: MVFR,
                       o Red: IFR, or
                       o Purple: LIFR.

        3.6.2.2    Use.
                   Graphical depictions of surface observations, both interactive and static
                   display, provide an overview of weather flying categories and other adverse
                   weather conditions for the valid time shown on the graphic display.