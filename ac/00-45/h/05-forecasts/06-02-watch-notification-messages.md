5.6.2   Watch Notification Messages.
        The SPC issues Aviation Watch Notification Messages (SAW) to provide an area threat
        alert for the aviation meteorology community to forecast organized severe thunderstorms
        that may produce tornadoes, large hail, and/or Convective damaging winds as indicated
        in Public Watch Notification Messages within the CONUS.

        SPC issues three types of Watch Notification Messages: SAW, Public Severe
        Thunderstorm Watch Notification Message, and Public Tornado Watch Notification
        Message. They are available on the SPC Web site.

        The SAW was formerly known as the Alert Severe Weather Watch Bulletin (AWW). The
        NWS no longer uses that title or acronym for this product. The NWS uses the acronym
        SAW for the Aviation Watch Notification Message, but retains AWW in the product
        header for processing by weather data systems. The NWS uses the acronym AWW for
        their Aviation Weather Warning product, which is a completely different product from
        the SAW.

        The Severe Thunderstorm and Tornado Watch Notification Messages were formerly
        known as the Severe Weather Watch Bulletins (WW). The NWS no longer uses that title
        or acronym for this product but retains WW in the product header for processing by
        weather data systems.

        It is important to note the difference between a Severe Thunderstorm (or Tornado)
        Watch and a Severe Thunderstorm (or Tornado) Warning. A watch means severe
        weather is possible during the watch valid time, while a warning means that severe
        weather has been observed or is expected within the hour. Only the SPC issues Severe
        Thunderstorm and Tornado Watches, while only NWS WFOs issue Severe Thunderstorm
        and Tornado Warnings.

        5.6.2.1   Aviation Watch Notification Message (SAW).
                  The SPC issues SAW to provide an area threat alert for the aviation
                  meteorology community to forecast organized severe thunderstorms that may
                  produce tornadoes, large hail, and/or Convective damaging winds as indicated
                  in Public Watch Notification Messages.

                  The SAW product is an approximation of the area in a watch. For the official
                  area covered by a watch, see the corresponding Public Watch product. To
                  illustrate, Figure 5-24, Aviation Watch (polygon) Compared to Public Watch
                  (shaded) Example, is an example of the Aviation Watch (polygon) compared
                  to the Public Watch (shaded). Also, the SAW is easier to communicate
                  verbally over the radio and telephone than reciting the entire Public Watch
                  product.

                                              5-38

11/14/16                          Aviation Weather Services                           AC 00-45H

  Figure 5-24. Aviation Watch (polygon) Compared to Public Watch (shaded) Example

      5.6.2.1.1   Issuance.
                  The SPC will issue the SAW after the proposed Convective watch area has
                  been collaborated with the affected NWS WFOs defining the approximate
                  areal outline of the watch.

                  Watch Notification Messages are nonscheduled, event-driven products valid
                  from the time of issuance to expiration or cancellation time. Valid times are in
                  UTC. SPC will correct watches for formatting and grammatical errors.

                  When tornadoes or severe thunderstorms have developed, the local NWS
                  WFO will issue the warnings for the storms.

      5.6.2.1.2   Format and Example of an Aviation Watch Notification Message (SAW).
                  SPC forecasters may define the area as a rectangle or parallelogram (X mi
                  either side of the line from point A to point B) or (X miles north and south or
                  east and west of the line from point A to point B). Distances of the axis
                  coordinates should be in sm. The aviation coordinates referencing VOR
                  locations and state distances will be in nautical miles (NM). Valid times will
                  be in UTC. The watch half width will be in sm. The SAW will contain hail

                                              5-39

11/14/16                      Aviation Weather Services                          AC 00-45H

              size in inches or ½ in (forecaster discretion for tornado watches associated
              with hurricanes) surface and aloft, surface Convective wind gusts in knots,
              maximum cloud tops and the Mean Storm Motion Vector, and replacement
              information, if necessary.

              The SAW will refer users to the accompanying public product, known as the
              Watch Outline Update (WOU) message, which provides the names of all
              counties or parishes in the watch area. Note the letter “n” refers to the
              issuance number, e.g., 2 means the second issuance of the WOU message.
           WWUS30 KWNS 271559
           SAW2
           SPC AWW 271559
           WW 568 TORNADO AR LA MS 271605Z - 280000Z
           AXIS..65 STATUTE MILES EAST AND WEST OF LINE..
           45ESE HEZ/NATCHEZ MS/ - 50N TUP/TUPELO MS/
           ..AVIATION COORDS.. 55NM E/W /18WNW MCB - 60E MEM/
           HAIL SURFACE AND ALOFT..3 INCHES. WIND GUSTS..70 KNOTS. MAX TOPS TO 550.
           MEAN STORM MOTION VECTOR 26030.

           LAT...LON 31369169 34998991 34998762 31368948

           THIS IS AN APPROXIMATION TO THE WATCH AREA. FOR A
           COMPLETE DEPICTION OF THE WATCH SEE WOUS64 KWNS
           FOR WOU2.

                                          5-40

11/14/16                              Aviation Weather Services                                  AC 00-45H

             Table 5-10. Decoding an Aviation Weather Watch Notification Message

     Line(s)                         Content                                      Description

                 WWUS30 KWNS 271559                               Communication header with issuance
       1                                                          date/time

                 SAW2                                             NWS product type (SAW) and issuance
       2                                                          number (2)

                 SPC                                              Issuing office
                 AWW                                              Product Type
       3
                 271559                                           Issuance date/time

                 WW 568                                           Watch number
                 TORNADO                                          Watch Type
       4          AR LA MS                                        States affected
                 271605Z - 280000Z                                Valid date/time period

                 AXIS..65 STATUTE MILES EAST AND WEST OF A Watch axis
       5         LINE...
                  45ESE HEZ/NATCHEZ MS/ - 50N TUP/TUPELO          Anchor points
       6
                 MS/
                 …AVIATION COORDS..55NM E/W /18WNW MCB -          Aviation coordinates
       7
                 60E MEM/
                 HAIL SURFACE AND ALOFT…3 INCHES. WIND            Type, intensity, max tops and mean storm
      8-9        GUSTS..70 KNOTS. MAX TOPS TO 550. MEAN           motion using standard contractions.
                 STORM MOTION VECTOR 26030.
       10        (blank line)
                 LAT...LON 31369169 34998991 4998762              Latitude and longitude coordinates
       11        31368948
       12        (blank line)
                 THIS IS AN APPROXIMATION TO THE WATCH            Notice that this is an approximation of the
     13-15       AREA. FOR A COMPLETE DEPICTION OF THE            watch area and for users to refer to the
                 WATCH SEE WOUS64 KWNS FOR WOU2.                  referenced product for the actual area

       5.6.2.2      Public Severe Thunderstorm Watch Notification Message.
                    The SPC issues a Public Severe Thunderstorm Watch Notification Message
                    when forecasting six or more hail events of 1 in (quarter sized) diameter or
                    greater or damaging winds of 50 kts (58 mph) or greater. The forecast event
                    minimum threshold is at least 2 hours over an area of at least 8,000 mi2.
                    Below these thresholds, the SPC, in collaboration with affected NWS offices,
                    may issue a watch for smaller areas and for shorter periods of time when
                    conditions warrant, and for Convective watches along coastlines, near the
                    Canadian border, and near the Mexican border.

                                                5-41

11/14/16                        Aviation Weather Services                           AC 00-45H

                A Public Severe Thunderstorm Watch Notification Message contains
                three bulleted blocks of information:

                •   The geographic area of the watch,
                •   The valid time of the watch, and
                •   A description of the primary threats anticipated within the watch.

                A plain text watch summary is included beneath the bulleted information
                followed by a more detailed description of the area and axis of the watch.

                The SPC includes the term “adjacent coastal waters” when the watch affects
                coastal waters adjacent to the Pacific/Atlantic coast, the Gulf of Mexico, or
                the Great Lakes. Adjacent coastal waters refers to a WFO’s near-shore
                responsibility (out to 20 NM for oceans), except for Convective watches,
                which include portions of the Great Lakes.

                The SPC issues a watch cancellation message when no counties, parishes,
                independent cities and/or marine zones remaining are in the watch area prior
                to the expiration time. The text of the message will specify the number and
                area of the canceled watch.

      5.6.2.3   Format of Public Severe Thunderstorm Watch Notification Message.
                WWUS20 KWNS ddhhmm (communication header)

                URGENT - IMMEDIATE BROADCAST REQUESTED
                SEVERE THUNDERSTORM WATCH NUMBER nnnn
                NWS STORM PREDICTION CENTER NORMAN OK
                time am/pm time zone day mon dd yyyy

                THE STORM PREDICTION CENTER HAS ISSUED A

                    *      SEVERE THUNDERSTORM WATCH FOR PORTIONS OFPORTION(S) OF
                    STATE(S)AND ADJACENT COASTAL WATERS (IF REQUIRED)

                *   EFFECTIVE (TIME PERIOD) UNTIL hhmm am/pm time zone.

                ...THIS IS A PARTICULARLY DANGEROUS SITUATION (IF NECESSARY)...

                * PRIMARY THREATS INCLUDE...
                HAIL TO X.X INCHES IN DIAMETER POSSIBLE
                THUNDERSTORM WIND GUSTS TO XX MPH POSSIBLE
                DANGEROUS LIGHTNING POSSIBLE

                SUMMARY...PLAIN TEXT DESCRIPTION OF WHY THE WATCH IS NEEDED.

                NARRATIVE DESCRIPTION OF WATCH AREA USING A LINE AND ANCHOR
                POINTS. DISTANCES TO EITHER SIDE OF THE LINE WILL BE IN STATUTE
                MILES. THIS SECTION INDICATES THE WATCH IS AREA IS AN APPROXIMATION
                AND “FOR A COMPLETE DEPICTION OF THE WATCH SEE THE ASSOCIATED WATCH
                OUTLINE UPDATE (WOUS64 KWNS WOUn).”

                PRECAUTIONARY/PREPAREDNESS ACTIONS...

                                            5-42

11/14/16                          Aviation Weather Services                          AC 00-45H

                  CALL TO ACTION STATEMENTS

                  OTHER WATCH INFORMATION...OTHER WATCHES IN EFFECT AND IF THIS

                  WATCH REPLACES A PREVIOUS WATCH.

                  &&

                  AVIATION...BRIEF DESCRIPTION OF SEVERE WEATHER THREAT TO AVIATORS.
                  HAIL SIZE WILL BE GIVEN IN INCHES AND WIND GUSTS IN KNOTS. MAXIMUM
                  STORM TOPS AND A MEAN STORM VECTOR WILL ALSO BE GIVEN.

                  $$

                  ..FORECASTER NAME.. MM/DD/YY

                  To see a dynamic representation of this, please go to the following Web site:
                  http://www.spc.noaa.gov/products/watch/ww0018.html.

      5.6.2.3.1   Example of a Public Severe Thunderstorm Watch Notification Message.
                  WWUS20 KWNS 161711 (communication header)
                  SEL2
                  SPC WW 161710

                  URGENT - IMMEDIATE BROADCAST REQUESTED
                  SEVERE THUNDERSTORM WATCH NUMBER 647
                  NWS STORM PREDICTION CENTER NORMAN OK
                  1210 PM CDT FRI JUL 16 2011

                  THE NWS STORM PREDICTION CENTER HAS ISSUED A

                  * SEVERE THUNDERSTORM WATCH FOR PORTIONS OF EASTERN IOWA
                  NORTHERN ILLINOIS
                  NORTHWEST INDIANA
                  LAKE MICHIGAN

                  *    EFFECTIVE THIS FRIDAY AFTERNOON FROM 1210 PM UNTIL 500 PM CDT.

                  * PRIMARY THREATS INCLUDE...
                  HAIL TO 2 INCHES IN DIAMETER POSSIBLE...
                  THUNDERSTORM WIND GUSTS TO 70 MPH POSSIBLEDANGEROUS LIGHTNING
                  POSSIBLE

                  THE SEVERE THUNDERSTORM WATCH AREA IS APPROXIMATELY ALONG AND 75
                  STATUTE MILES EITHER SIDE OF A LINE FROM 40 MILES SOUTHEAST OF SOUTH
                  BEND INDIANA TO 35 MILES SOUTHWEST OF CEDAR RAPIDS IOWA. FOR A
                  COMPLETE DEPICTION OF THE WATCH SEE THE ASSOCIATED WATCH OUTLINE
                  UPDATE (WOUS64 KWNS WOU2).

                  PRECAUTIONARY/PREPAREDNESS ACTIONS...

                  REMEMBER...A SEVERE THUNDERSTORM WATCH MEANS CONDITIONS ARE

                  FAVORABLE FOR SEVERE THUNDERSTORMS IN AND CLOSE TO THE WATCH AREA.
                  PERSONS IN THESE AREAS SHOULD BE ON THE LOOKOUT FOR THREATENING
                  WEATHER CONDITIONS AND LISTEN FOR LATER STATEMENTS AND POSSIBLE
                  WARNINGS. SEVERE THUNDERSTORMS CAN AND OCCASIONALLY DO PRODUCE
                  TORNADOES.

                                             5-43

11/14/16                           Aviation Weather Services                            AC 00-45H

                  OTHER WATCH INFORMATION...CONTINUE...WW 646...

                  DISCUSSION...THUNDERSTORMS WILL CONTINUE TO INCREASE ACROSS WATCH
                  AREA WHERE AIR MASS HAS BECOME STRONGLY UNSTABLE AND UNCAPPED.
                  VEERING SHEAR PROFILE SUPPORT STORMS EVOLVING INTO SHORT LINE
                  SEGMENTS ENHANCING WIND DAMAGE POTENTIAL

                  AVIATION...A FEW SEVERE THUNDERSTORMS WITH HAIL SURFACE AND ALOFT
                  TO 2 INCHES. EXTREME TURBULENCE AND SURFACE WIND GUSTS TO 60
                  KNOTS. A FEW CUMULONIMBI WITH MAXIMUM TOPS TO 500. MEAN STORM
                  MOTION VECTOR 33025.

                  ... NAME

      5.6.2.4     Public Tornado Watch Notification Message.
                  The SPC issues a Public Tornado Watch Notification Message when
                  forecasting two or more tornadoes or any tornado that could produce EF2 or
                  greater damage. The forecast event minimum thresholds are at least 2 hours
                  over an area at least 8,000 mi2. Below these thresholds, the SPC, in
                  collaboration with affected NWS offices, may issue for smaller areas and for
                  shorter periods of time when conditions warrant, and for Convective watches
                  along coastlines, near the Canadian border, and near the Mexican border.

                  A Public Tornado Watch Notification Message contains the area description
                  and axis, watch expiration time, the term “damaging tornadoes,” a description
                  of the largest hail size and strongest thunderstorm wind gusts expected, the
                  definition of the watch, a call-to-action statement, a list of other valid watches,
                  a brief discussion of meteorological reasoning, and technical information for
                  the aviation community.

                  The SPC may enhance a Public Tornado Watch Notification Message by
                  using the words “THIS IS A PARTICULARLY DANGEROUS
                  SITUATION” when there is a likelihood of multiple strong (damage of EF2
                  or EF3) or violent (damage of EF4 or EF5) tornadoes.

                  The SPC includes the term “adjacent coastal waters” when the watch affects
                  coastal waters adjacent to the Pacific/Atlantic coast or the Gulf of Mexico.
                  Adjacent coastal waters refers to a WFO’s near-shore responsibility (out to
                  20 NM for oceans), which include portions of the Great Lakes.

                  The SPC issues a watch cancellation message whenever it cancels a watch
                  prior to the expiration time. The text of the message will specify the number
                  and area of the canceled watch.

      5.6.2.4.1   Format of a Public Tornado Watch Notification Message.
                  The format for a Public Tornado Watch Notification Message is the same as
                  the Public Severe Thunderstorm Watch Notification Message.

                                               5-44

11/14/16                           Aviation Weather Services                          AC 00-45H

      5.6.2.4.2   Example of a Public Tornado Watch Notification Message.

                  A Public Tornado Watch Notification Message contains three bulleted blocks
                  of information:

                  •   The geographic area of the watch,
                  •   The valid time of the watch, and
                  •   A description of the primary threats anticipated within the watch.

                  A plain text summary is included beneath the bulleted information.

                  (Note this is a fictitious example)
                  WWUS20 KWNS 050550 (communication header)
                  SEL2
                  SPC WW 051750

                  URGENT - IMMEDIATE BROADCAST REQUESTED
                  TORNADO WATCH NUMBER 243
                  NWS STORM PREDICTION CENTER NORMAN OK
                  1250 AM CDT MON MAY 5 2011

                  THE NWS STORM PREDICTION CENTER HAS ISSUED A

                  * TORNADO WATCH FOR PORTIONS OF
                  WESTERN AND CENTRAL ARKANSAS
                  SOUTHERN MISSOURI
                  FAR EASTERN OKLAHOMA

                  *   EFFECTIVE THIS MONDAY MORNING FROM 1250 AM UNTIL 600 AM CDT.

                  ...THIS IS A PARTICULARLY DANGEROUS SITUATION...

                  * PRIMARY THREATS INCLUDE
                  NUMEROUS INTENSE TORNADOES LIKELY
                  NUMEROUS SIGNIFICANT DAMAGING WIND GUSTS TO 80 MPH LIKELY
                  NUMEROUS VERY LARGE HAIL TO 4 INCHES IN DIAMETER LIKELY

                  THE TORNADO WATCH AREA IS APPROXIMATELY ALONG AND 100 STATUTE MILES
                  EAST AND WEST OF A LINE FROM 15 MILES WEST NORTHWEST OF FORT LEONARD
                  WOOD MISSOURI TO 45 MILES SOUTHWEST OF HOT SPRINGS ARKANSAS. FOR A
                  COMPLETE DEPICTION OF THE WATCH SEE THE ASSOCIATED WATCH OUTLINE
                  UPDATE (WOUS64 KWNS WOU2).

                  REMEMBER...A TORNADO WATCH MEANS CONDITIONS ARE FAVORABLE FOR
                  TORNADOES AND SEVERE THUNDERSTORMS IN AND CLOSE TO THE WATCH AREA.
                  PERSONS IN THESE AREAS SHOULD BE ON THE LOOKOUT FOR THREATENING
                  WEATHER CONDITIONS AND LISTEN FOR LATER STATEMENTS AND POSSIBLE
                  WARNINGS.

                  OTHER WATCH INFORMATION...THIS TORNADO WATCH REPLACES TORNADO
                  WATCH NUMBER 237. WATCH NUMBER 237 WILL NOT BE IN EFFECT AFTER
                  1250 AM CDT. CONTINUE...WW 239...WW 240...WW 241...WW 242...

                                               5-45

11/14/16                            Aviation Weather Services                          AC 00-45H

                   DISCUSSION...SRN MO SQUALL LINE EXPECTED TO CONTINUE EWD...WHERE
                   LONG/HOOKED HODOGRAPHS SUGGEST THREAT FOR EMBEDDED
                   SUPERCELLS/POSSIBLE TORNADOES. FARTHER S...MORE WIDELY SCATTERED
                   SUPERCELLS WITH A THREAT FOR TORNADOES WILL PERSIST IN VERY STRONGLY
                   DEEP SHEARED/LCL ENVIRONMENT IN AR.

                   AVIATION...TORNADOES AND A FEW SEVERE THUNDERSTORMS WITH HAIL
                   SURFACE AND ALOFT TO 4 INCHES. EXTREME TURBULENCE AND SURFACE WIND
                   GUSTS TO 70 KNOTS. A FEW CUMULONIMBI WITH MAXIMUM TOPS TO 500. MEAN
                   STORM MOTION VECTOR 26045.
                   .
                   .. NAME

                   To see a dynamic representation of this, please go to the following Web site:
                   http://www.spc.noaa.gov/products/watch/ww0020.html.