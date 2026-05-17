3.2     Aircraft Observations and Reports.
        There are two kinds of aircraft observations: Pilot Weather Reports (PIREP) and Aircraft
        Reports, or air-reports (AIREP). Each kind has two types:

        •   Routine PIREPs and Urgent PIREPs.
        •   Routine AIREPs and Special AIREPs.

        PIREPs are reported by the pilot (or aircrew), while AIREPs can either be reported by the
        pilot or generated from sensors onboard the aircraft (automated AIREPs). PIREPs and
        AIREPs are coded differently. The PIREP format is a U.S.-only format. The AIREP
        format is used worldwide. Automated AIREPs are common over the United States.

3.2.1   Pilot Weather Report (PIREP).
        Pilots should report any observation, good or bad, to assist other pilots with flight
        planning and preparation. If conditions were forecasted to occur but not encountered, a
        pilot should also report the observed condition. This will help the NWS verify forecast
        products and create more accurate products for the aviation community.

        A PIREP is prepared using a prescribed format (see Figure 3-5, Pilot Weather Report
        (PIREP) Coding Format). Required elements for all PIREPs are: message type, location,
        time, altitude/flight level, type aircraft, and at least one other element to describe the
        reported phenomena. The other elements are omitted when no data is reported. All
        altitude references are MSL unless otherwise noted. Distance for visibility is in statute
        miles and all other distances are in nautical miles. Time is reported in UTC.

                                               3-26

11/14/16                           Aviation Weather Services                            AC 00-45H

                  Figure 3-5. Pilot Weather Report (PIREP) Coding Format

      3.2.1.1     Message Type (UUA/UA).
                  The two types of PIREPs are Urgent (UUA) and Routine (UA).

      3.2.1.1.1   Urgent PIREPs.
                  Urgent (UUA) PIREPs contain information about:

                  •   Tornadoes, funnel clouds, or waterspouts;
                  •   Severe or extreme turbulence (including Clear Air Turbulence (CAT));
                  •   Severe icing;
                  •   Hail;
                  •   LLWS within 2,000 ft of the surface. LLWS PIREPS are classified as
                      UUA if the pilot reports air speed fluctuations of 10 kts or more, or if air
                      speed fluctuations are not reported but LLWS is reported, the PIREP is
                      classified as UUA;
                  •   Volcanic ash clouds; and/or
                  •   Any other weather phenomena reported that are considered by the briefer
                      as being hazardous, or potentially hazardous, to flight operations.

      3.2.1.1.2   Routine PIREPs.
                  Routine PIREPs are issued after receiving a report from a pilot that does not
                  contain any urgent information as listed in paragraph 3.2.1.1.1.

      3.2.1.2     Location (/OV).
                  The Location (/OV) is the position reference where the phenomenon occurred.
                  It is not the location of the aircraft when the report is submitted. Location can

                                               3-27

11/14/16                          Aviation Weather Services                           AC 00-45H

                  be referenced either by geographical position or by route segment. A position
                  reference is preferred by meteorologists to aid forecast precision, monitoring,
                  and verification.

      3.2.1.2.1   Location.
                  Location can be referenced to a very high frequency (VHF) Navigational Aid
                  (NAVAID) or an airport, using either the three-letter IATA or four-letter
                  ICAO identifier. If appropriate, the PIREP is encoded using the identifier,
                  then three digits to define a radial and three digits to define the distance in
                  nautical miles.

      Examples:

      /OV APE                   Over Appleton Very High Frequency Omni-Directional Range
                                Station (VOR)
      /OV KJFK                  Over John F. Kennedy International Airport, New York, NY
      /OV APE230010             230 degrees at 10 NM from the Appleton Very High Frequency
                                Omni-Directional Range Station (VOR)
      /OV KJFK107080            107 degrees at 80 NM from John F. Kennedy International
                                Airport, New York, NY

      3.2.1.2.2   Route Segment.
                  A PIREP can also be referenced using two or more fixes to describe a route.

      Examples:

      /OV KSTL-KMKC                                  From Lambert-Saint Louis International
                                                     Airport, MO to Charles B. Wheeler
                                                     Downtown Airport, Kansas City, MO
      /OV KSTL090030-KMKC045015                      From 90 degrees at 30 NM from
                                                     Lambert-Saint Louis International Airport,
                                                     MO to 45 degrees at 15 NM from Charles B.
                                                     Wheeler Downtown Airport, Kansas City,
                                                     MO

      3.2.1.3     Time (/TM).
                  Time (/TM) is the time that the reported phenomenon occurred or was
                  encountered. It is coded in four digits UTC.

      Example:

      /TM 1315         1315 UTC

                                              3-28

11/14/16                           Aviation Weather Services                           AC 00-45H

      3.2.1.4     Altitude/Flight Level (/FL).
                  The altitude/flight level (/FL) is the altitude in hundreds of feet MSL where
                  the phenomenon was first encountered. If not known, UNKN is entered. If the
                  aircraft was climbing or descending, the appropriate contraction (DURC or
                  DURD) is entered in the remarks (/RM). If the condition was encountered
                  within a layer, the altitude range is entered within the appropriate element that
                  describes the condition.

      Examples:

      /FL085                                 8,500 ft MSL
      /FL310                                 Flight level 310
      /FLUNKN /RM DURC                       Flight level unknown, remarks, during climb

      3.2.1.5     Aircraft Type (/TP).
                  Aircraft type (/TP) is entered. If not known, UNKN is entered. Icing and
                  turbulence reports always include aircraft type.

      Examples:

      /TP BE20                               Super King Air 200
      /TP SR22                               Cirrus 22
      /TP P28R                               Piper Arrow
      /TP UNKN                               Type unknown

      3.2.1.6     Sky Condition (/SK).
                  Sky condition (/SK) group is used to report height of cloud bases, tops, and
                  cloud cover. The height of the base of a layer of clouds is coded in hundreds
                  of feet MSL. The top of a layer is entered in hundreds of feet MSL preceded
                  by the word TOP. If reported as clear above the highest cloud layer, SKC is
                  coded following the reported level.

      Examples:

      /BKN040-TOP065                          Base of broken layer 4,000 ft MSL, top 6,500 ft
                                              MSL
      /SK OVC100-TOP110/ SKC                  Base of an overcast layer 10,000 ft MSL, top
                                              11,000 ft MSL, clear above
      /SK OVC015-TOP035/OVC230 Base of an overcast layer 1,500 ft MSL, top
                               3,500 ft MSL, base of an overcast layer 23,000 ft
                               MSL
      /SK OVC-TOP085                          Overcast layer, top 8,500 ft MSL

                                              3-29

11/14/16                          Aviation Weather Services                           AC 00-45H

                  Cloud cover amount ranges are entered with a hyphen separating the amounts,
                  e.g., BKN-OVC.

      Examples:

      /SK SCT-BKN050-TOP100                                           Base of a scattered to
                                                                      broken layer 5,000 ft
                                                                      MSL, top 10,000 ft MSL
      /SK BKN-OVCUNKN-TOP060/BKN120-TOP150/ SKC Base of a broken to
                                                overcast layer unknown,
                                                top 6,000 ft MSL, base of
                                                a broken layer 12,000 ft
                                                MSL, top 15,000 ft MSL,
                                                clear above

                  Unknown heights are indicated by the contraction UNKN.

      Examples:

      /SK OVC065-TOPUNKN                          Base of an overcast layer 6,500 ft MSL, top
                                                  unknown. If a pilot indicates he/she is in the
                                                  clouds, IMC is entered.
      /SK OVC065-TOPUNKN /RM IMC                  Base of an overcast layer 6,500 ft MSL, top
                                                  unknown, remark, in the clouds. When more
                                                  than one layer is reported, layers are separated
                                                  by a solidus (/).

      3.2.1.7     Flight Visibility and Weather (/WX).
                  The pilot reports the weather conditions he or she encounters as follows:
                  Flight visibility, when reported, is entered first in the /WX field. It is coded
                  FV followed by a two-digit visibility value rounded down, if necessary, to the
                  nearest whole statute mile and appended with SM (FV03SM). If visibility is
                  reported as unrestricted, FV99SM is entered.

                  Flight weather types are entered using one or more of the surface weather
                  reporting phenomena contained in Table 3-2.

      Example:

      /WX FV01SM +DS000-TOP083/SKC /RM DURC                       Flight visibility 1 sm, base
                                                                  heavy duststorm layer at the
                                                                  surface, top 8,300 ft MSL,
                                                                  clear above, remarks, during
                                                                  climb

                                              3-30

11/14/16                          Aviation Weather Services                           AC 00-45H

                  When more than one form of precipitation is combined in the report, the
                  dominant type is reported first.

      Examples:

      /WX FV00SM +TSRAGR                       Flight visibility 0 sm, thunderstorm, heavy rain,
                                               hail
      /WX FV02SM BRHZ000-TOP083                Flight visibility 2 sm, base of a haze and mist
                                               layer at the surface, top 8,300 ft MSL

                  If a funnel cloud is reported, it is coded FC following /WX group and is
                  spelled out as Funnel Cloud after /RM group. If a tornado or waterspout is
                  reported, it is coded +FC following /WX group and TORNADO or
                  WATERSPOUT is spelled out after the /RM group.

      Examples:

      /WX FC /RM FUNNEL CLOUD                 Funnel cloud, remarks, funnel cloud
      /WX +FC /RM TORNADO                     Tornado, remarks, tornado

                  When more than one type of weather is reported, they are reported in the
                  following order:

                  •   TORNADO, WATERSPOUT, or FUNNEL CLOUD.
                  •   Thunderstorm with or without associated precipitation.
                  •   Weather phenomena in order of decreasing predominance.

                  No more than three groups are used in a single PIREP.

                  Weather layers are entered with the base and/or top of the layer when
                  reported. The same format as in the sky condition (/SK) group is used.

      Example:

      /WX FU002-TOP030              Base of a smoke layer, 200 ft MSL, top 3,000 ft MSL

      3.2.1.8     Air Temperature (/TA).
                  Outside air temperature (/TA) is reported using two digits in degrees Celsius.
                  Negative temperatures is prefixed with an M (e.g., /TA 08 or /TA M08).

      3.2.1.9     Wind Direction and Speed (/WV).
                  Wind direction and speed are encoded using three digits to indicate wind
                  direction, relative to true north, and two or three digits to indicate reported
                  wind speed. When the reported speed is less than 10 kts, a leading 0 is used.
                  The wind group will always have KT appended to represent the units in knots.

                                             3-31

11/14/16                          Aviation Weather Services                           AC 00-45H

      Examples:

      /WV 02009KT                    Wind 20 degrees at 9 kts
      /WV 28057KT                    Wind 280 degrees at 57 kts
      /WV 350102KT                   Wind 350 degrees at 102 kts

      3.2.1.10    Turbulence (/TB).
                  Turbulence intensity, type, and altitude are reported after wind direction and
                  speed.

                  Duration (intermittent (INTMT), occasional (OCNL), or continuous
                  (CONS)) is coded first (if reported by the pilot), followed by the intensity
                  (light (LGT), moderate (MOD), severe (SEV), or extreme (EXTRM)).
                  Range or variation of intensity is separated with a hyphen (e.g., MOD-SEV).
                  If turbulence was forecast, but not encountered, negative (NEG) is entered.

                  Type is coded second. Clear Air Turbulence (CAT) or CHOP is entered if
                  reported by the pilot. High-level turbulence not associated with clouds
                  (including thunderstorms) is reported as CAT.

                  Altitude is reported (last) only if it differs from value reported in the
                  altitude/flight level (/FL) group. When a layer of turbulence is reported,
                  height values are separated with a hyphen. If lower or upper limits are not
                  defined, BLO or ABV is used.

      Examples:

       /TB LGT                                               Light turbulence
       /TB LGT 040                                           Light turbulence at 4,000 ft MSL
       /TB OCNL MOD-SEV BLO 080                              Occasional moderate to severe
                                                             turbulence below 8,000 ft MSL
       /TB MOD-SEV CAT 350                                   Moderate to severe CAT at
                                                             35,000 ft MSL
       /TB NEG 120-180                                       Negative turbulence between
                                                             12,000 ft and 18,000 ft MSL
       /TB CONS MOD CHOP 220/NEG 230-280                     Continuous moderate chop at
                                                             22,000 feet MSL, negative
                                                             turbulence between 23,000 ft and
                                                             28,000 ft MSL
       /TB MOD CAT ABV 290                                   Moderate CAT above 29,000 ft
                                                             MSL

                                              3-32

11/14/16                           Aviation Weather Services                            AC 00-45H

                  Turbulence reports should include location, altitude (or range of altitudes),
                  and aircraft type, as well as, when reported, whether in clouds or clear air. The
                  pilot determines the degree of turbulence, intensity, and duration (occasional,
                  intermittent, and continuous). The report should be obtained and disseminated,
                  when possible, in conformance with the Turbulence Reporting Criteria Table
                  in the AIM, Chapter 7, Section 1.

      3.2.1.11    Icing (/IC).
                  Icing intensity, type, and altitude are reported after turbulence.

                  Intensity is coded first using contractions TRACE, light (LGT),
                  moderate (MOD), or severe (SEV). Reports of a range or variation of
                  intensity is separated with a hyphen. If icing was forecast but not encountered,
                  negative (NEG) is coded. Icing type is reported second. Reportable types are
                  RIME, clear (CLR), or mixed (MX).

                  The AIM, Chapter 7, Section 1 provides classification of icing intensity
                  according to its operational effects on aircraft, as well as tables of icing types
                  and icing conditions.

                  The reported icing/altitude is coded (last) only if different from the value
                  reported in the altitude/flight level (/FL) group. A hyphen is used to separate
                  reported layers of icing. Above (ABV) or below (BLO) is coded when a layer
                  is not defined.

                  Pilot reports of icing should also include air temperature (/TA).

      Examples:

      /IC LGT-MOD MX 085                     Light to moderate mixed icing, 8,500 ft MSL
      /IC LGT RIME                           Light rime icing
      /IC MOD RIME BLO 095                   Moderate rime icing below 9,500 ft MSL
      /IC SEV CLR 035-062                    Severe clear icing 3,500 ft to 6,200 ft MSL

      3.2.1.12    Remarks (/RM).
                  The remarks (/RM) group is used to report a phenomenon that is considered
                  important but does not fit in any of the other groups. This includes, but is not
                  limited to, LLWS reports, thunderstorm lines, coverage and movement,
                  lightning, sulfur dioxide (SO2) gas smell, clouds observed but not
                  encountered, and geographical or local descriptions of where the phenomenon
                  occurred. Hazardous weather is reported first. LLWS is described to the extent
                  possible.

                                               3-33

11/14/16                         Aviation Weather Services                         AC 00-45H

      3.2.1.12.1 Wind Shear.
                 Ten kts or more fluctuations in wind speed (+/-10KTS), within 2,000 ft of the
                 surface, require an Urgent (UUA) pilot report. When LLWS is entered in a
                 pilot report, LLWS is entered as the first remark in the remarks (/RM) group.

      Example:

      /RM LLWS +/-15 KT SFC-008 DURC RY22 JFK                       Remarks, LLWS, air speed
                                                                    fluctuations of plus or
                                                                    minus 15 kts, surface to
                                                                    800 ft during climb,
                                                                    Runway 22, John F.
                                                                    Kennedy International
                                                                    Airport, NY.

      3.2.1.12.2 FUNNEL CLOUD, TORNADO, and WATERSPOUT.
                 Funnel cloud, tornado, and waterspout are entered with the direction of
                 movement, when reported.

      Example:

      /RM TORNADO W MOV E                  Remarks, tornado west moving east

      3.2.1.12.3 Thunderstorm.
                 Thunderstorm coverage is coded as isolated (ISOL), few (FEW),
                 scattered (SCT), numerous (NMRS) followed by description as line (LN),
                 broken line (BKN LN), solid line (SLD LN), when reported. This is followed
                 with TS, the location and movement, and the type of lightning, when reported.

      Example:

      /RM NMRS TS S MOV E               Remarks, numerous thunderstorms south moving east

      3.2.1.12.4 Lightning.
                 Lightning frequency is coded as occasional (OCNL) or frequent (FRQ),
                 followed by type as lightning in cloud (LTGIC), lightning cloud to cloud
                 (LTGCC), lightning cloud to ground (LTGCG), lightning cloud to air
                 (LTGCA), or combinations, when reported.

      Example:

      /RM OCNL LTGICCG             Remarks, occasional lighting in cloud, cloud to ground

      3.2.1.12.5 Electrical Discharge.
                 For an electrical discharge, DISCHARGE is coded followed by the altitude.

                                            3-34

11/14/16                          Aviation Weather Services                          AC 00-45H

      Example:

      /RM DISCHARGE 120             Remarks, discharge, 12,000 ft MSL

      3.2.1.12.6 Clouds.
                 Remarks are used when clouds can be seen but were not encountered and
                 reported in the sky condition group (/SK).

      Examples:

      /RM CB E MOV N              Remarks, cumulonimbus east moving north
      /RM OVC BLO                 Remarks, overcast below

      3.2.1.12.7 Plain Language.
                 If specific phraseology is not adequate, plain language is used to describe the
                 phenomena or local geographic locations. Remarks that do not fit in other
                 groups like during climb (DURC), during descent (DURD), reach cruising
                 altitude (RCA), top of climb (TOP or TOC), are included.

      Examples:

      /RM DONNER SUMMIT PASS

      3.2.1.12.8 Volcanic Eruptions.
                 Volcanic ash alone is an Urgent PIREP. A report of volcanic activity includes
                 as much information as possible including the name of the mountain, ash
                 cloud and movement, height of the top and bottom of the ash, etc., is included.

      Example:

      /UUA/OV ANC240075/TM 2110/FL370/TP DC10/WX VA/RM VOLCANIC
      ERUPTION 2008Z MT AUGUSTINE ASH 40S MOV SSE

                  Urgent Pilot Weather Report, 240 degrees at 75 NM from Anchorage
                  International Airport, AK, 2110 UTC, flight level 370, a DC10 reported
                  volcanic ash, remarks, volcanic eruption occurred at 2008 UTC Mount
                  Augustine, ash 40 NM south moving south-southeast.

      3.2.1.12.9 SKYSPOTTER.
                 The SKYSPOTTER program is a result of a recommendation from the Safer
                 Skies FAA/Industry Joint Safety Analysis and Implementation Teams. The
                 term SKYSPOTTER indicates a pilot has received specialized training in
                 observing and reporting in-flight weather phenomenon or PIREPs.

                  When a PIREP is received from a pilot identifying themselves as a
                  SKYSPOTTER aircraft, the additional comment “/AWC” is added at the end
                  of the remarks section of the PIREP.

                                             3-35

11/14/16                            Aviation Weather Services                           AC 00-45H

                   An AWC-WEB/xxxx in the remarks indicates the pilot report was submitted
                   by an airline dispatcher or Center Weather Service Unit (CWSU)
                   meteorologist directly to the Aviation Weather Center (AWC). The xxxx
                   represents the airline abbreviation or air route traffic control center (ARTCC)
                   of the CWSU that submitted the PIREP.

        Example:

        PIREP TEXT/RM REMARKS/AWC
        PIREP TEXT/RM REMARKS/AWC-WEB/KZFW

3.2.2   Air-Reports (AIREP).
        AIREPs are messages from an aircraft to a ground station. AIREPs are normally
        comprised of the aircraft’s position, time, flight level, estimated time of arrival (ETA)
        over its next reporting point, destination ETA, fuel remaining, and meteorological
        information. It is beyond the scope of this advisory circular (AC) to describe the details
        of all the elements in the AIREP, but this paragraph will focus on the meteorological
        information.

        The AWC’s Web site provides AIREPs over the CONUS and portions of the Atlantic and
        Pacific Oceans.

        3.2.2.1    AIREP Types and Content.
                   There are two types of AIREPs, routine or position report (ARP) and special
                   (ARS). AIREPs can be reported by the pilot but the majority of routine
                   AIREPs are automated and downlinked from the aircraft to a service provider,
                   e.g., a flight planning company, for processing and forwarding to an airline
                   and the NWS.

                   The majority of AIREPs report wind and temperature at selected intervals
                   along the flight route, derived from onboard sensors and probes. Some aircraft
                   are equipped with sensors and probes to measure humidity/water vapor,
                   turbulence, and icing data.

                   The format for the AIREP is governed by ICAO. The AWC’s Web site
                   includes AIREPs on their PIREP Web page that is formatted for Web display
                   with some weather elements decoded.

        3.2.2.2    AIREP Examples.
                   The following examples are from http://www.aviationweather.gov. The actual
                   airline’s call sign was replaced with a fictitious call sign and the Special
                   AIREP was created from the routine report.

        Routine AIREP Example:

        ARP XXX836 2443N 15516W 2229 F350 M43 315/128 TB LGT

                                                3-36

11/14/16                           Aviation Weather Services                          AC 00-45H

            ARP                     Routine report
            XXX836                  Aircraft call sign
            2423N 15516W            Location in latitude and longitude, 24 degrees 23 minutes
                                    north, 155 degrees 16 minutes west
            F350                    Flight level or altitude, FL350
            M43                     Temperature in Celsius, minus 43 ºC
            315/128                 Wind direction (true) and speed, 315 degrees (true) and
                                    128 kts
            TB LGT                  Light turbulence

        Special AIREP Example:

        ARS XXX836 2443N 15516W 2229 F350 M43 315/128 TB SEV

            ARS                     Special AIREP

        Same as the routine example except:

            TB SEV                  Severe turbulence