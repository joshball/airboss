3.1.5   Format.

                            Figure 3-1. METAR/SPECI Coding Format

   A U.S. METAR/SPECI has two major sections: the body (consisting of a maximum of 11 groups) and
   the remarks (consisting of 2 categories). When an element does not occur, or cannot be observed, the
   corresponding group is omitted from that particular report.

        3.1.5.1     Type of Report.
                    METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                    R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                    TSB25 TS OHD MOV E SLP132

                    The type of report, METAR or SPECI, precedes the body of all reports, but
                    may not be shown or displayed on all aviation weather Web sites.

        3.1.5.2     Station Identifier.
                    METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                    R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                    TSB25 TS OHD MOV E SLP132

                    The station identifier, in ICAO format, is included in all reports to identify the
                    station to which the coded report applies.

                    The ICAO airport code is a four-letter alphanumeric code designating each
                    airport around the world. The ICAO codes are used for flight planning by
                    pilots and airline operation departments. These codes are not the same as the
                    International Air Transport Association (IATA) codes encountered by the
                    general public used for reservations, baggage handling, and in airline
                    timetables.

                                                      3-4

11/14/16                        Aviation Weather Services                          AC 00-45H

                Unlike the IATA codes, the ICAO codes have a regional structure. The first
                letter identifies the region and country (see Figure 3-2, ICAO Continental
                Codes). In some regions, the second letter identifies the country. ICAO station
                identifiers in Alaska begin with PA, Hawaii begins with PH, Guam begins
                with PG, and Puerto Rico begins with TS. For example, the San Juan
                Puerto Rico IATA identifier “SJU” becomes the ICAO identifier “TSJU.” The
                remaining letters are used to identify each airport.

                          Figure 3-2. ICAO Continental Codes

                In the continental United States (CONUS), ICAO station identifiers are coded
                K, followed by the three-letter IATA identifier. For example, the Seattle, WA
                IATA identifier SEA becomes the ICAO identifier KSEA.

                ICAO station identifiers in Alaska, Hawaii, and Guam begin with the
                continent code P.

                For a list of all U.S. identifiers, refer to the current edition of
                FAA Order 7350.9, Location Identifiers. For a complete worldwide listing,
                refer to the current edition of ICAO Document 7910, Location Indicators.
                Both are available online.

      3.1.5.3   Date and Time of Report.
                METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                TSB25 TS OHD MOV E SLP132

                                            3-5

11/14/16                         Aviation Weather Services                             AC 00-45H

                The date and time are coded in all reports as follows: the day of the month is
                the first two digits (01), followed by the hour (19) and the minutes (55).

                The coded time of observations is the actual time of the report, or when the
                criteria for a SPECI is met or noted.

                If the report is a correction to a previously disseminated report, the time of the
                corrected report is the same time used in the report being corrected.

                The date and time group always ends with a Z, indicating Zulu time (or
                Coordinated Universal Time (UTC)).

                For example, METAR KOKC 011955Z would be disseminated as the
                2000 hour routine report for station KOKC, taken on the 1st of the month at
                1955 UTC.

      3.1.5.4   Report Modifier (As Required).
                METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                TSB25 TS OHD MOV E SLP132

                The report modifier AUTO identifies the METAR/SPECI as a
                fully-automated report with no human intervention or oversight. In the event
                of a corrected METAR or SPECI, the report modifier COR is substituted for
                AUTO.

      3.1.5.5   Wind Group.
                METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                TSB25 TS OHD MOV E SLP132

                Wind is the horizontal motion of air past a given point. It is measured in terms
                of velocity, which is a vector that includes direction and speed. It indicates the
                direction the wind is coming from.

                In the wind group, the wind direction is coded as the first three digits (220)
                and is determined by averaging the recorded wind direction over a 2-minute
                period. It is coded in tens of degrees relative to true north using three figures.
                Directions less than 100 degrees are preceded with a 0. For example, a wind
                direction of 90 degrees is coded as 090. A wind from the north is coded as
                360.

                Immediately following the wind direction is the wind speed coded in two or
                three digits (15). Wind speed is determined by averaging the speed over a
                2-minute period and is coded in whole knots (kts) using the units, tens digits,
                and, when required, the hundreds digit. When wind speeds are less than
                10 kts, a leading 0 is used to maintain at least a two-digit wind code. For
                example, a wind speed of 8 kts will be coded 08KT. The wind group is

                                              3-6

11/14/16                          Aviation Weather Services                           AC 00-45H

                  always coded with a KT to indicate wind speeds are reported in knots. Other
                  countries may use kilometers per hour (KPH) or meters per second (MPS)
                  instead of knots.

                  Examples:

                  •   05008KT               Wind 50 degrees at 8 kts
                  •   15014KT               Wind 150 degrees at 14 kts
                  •   340112KT              Wind 340 degrees at 112 kts

      3.1.5.5.1   Wind Gust.
                  Wind speed data for the most recent 10 minutes is examined to evaluate the
                  occurrence of gusts. Gusts are defined as rapid fluctuations in wind speed with
                  a variation of 10 kts or more between peaks and lulls. The coded speed of the
                  gust is the maximum instantaneous wind speed.

                  Wind gusts are coded in two or three digits immediately following the wind
                  speed. Wind gusts are coded in whole knots using the units, tens, and, if
                  required, the hundreds digit. For example, a wind out of the west at 20 kts
                  with gusts to 35 kts would be coded 27020G35KT.

      3.1.5.5.2   Variable Wind Direction (speed 6 kts or less).
                  Wind direction may be considered variable when, during the previous
                  2-minute evaluation period, the wind speed was 6 kts or less. In this case, the
                  wind may be coded as VRB in place of the three-digit wind direction. For
                  example, if the wind speed was recorded as 3 kts, it would be coded
                  VRB03KT.

      3.1.5.5.3   Variable Wind Direction (speed greater than 6 kts).
                  Wind direction may also be considered variable when, during the 2-minute
                  evaluation period, it varies by 60 degrees or more and the speed is greater than
                  6 kts. In this case, a variable wind direction group immediately follows the
                  wind group. The directional variability is coded in a clockwise direction and
                  consists of the extremes of the wind directions separated by a V. For example,
                  if the wind is variable from 180 degrees to 240 degrees at 10 kts, it would be
                  coded 21010KT 180V240.

      3.1.5.5.4   Calm Wind.
                  When no motion of air is detected, the wind is reported as calm. A calm wind
                  is coded as 00000KT.

      3.1.5.6     Visibility Group.
                  METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                  R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                  TSB25 TS OHD MOV E SLP132

                                               3-7

11/14/16                         Aviation Weather Services                            AC 00-45H

                Visibility is a measure of the opacity of the atmosphere. It is defined as the
                greatest horizontal distance at which selected objects can be seen and
                identified or its equivalent derived from instrumental measurements.

                Prevailing visibility is the reported visibility considered representative of
                recorded visibility conditions at the manual station during the time of
                observation. It is the greatest distance that can be seen throughout at least half
                of the horizon circle, not necessarily continuous.

                Surface visibility is the prevailing visibility from the surface at manual
                stations or the visibility derived from sensors at automated stations.

                The visibility group is coded as the surface visibility in statute miles (sm). A
                space is coded between whole numbers and fractions of reportable visibility
                values. The visibility group ends with SM to indicate that the visibility is in
                statute miles. For example, a visibility of 1 ½ sm is coded 1 1/2SM. Most
                other countries use meters (m).

                U.S. automated stations use an M to indicate “less than.” For example,
                M1/4SM means a visibility of less than ¼ sm.

      3.1.5.7   Runway Visual Range (RVR) Group.
                METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                TSB25 TS OHD MOV E SLP132

                The RVR is an instrument-derived value representing the horizontal distance a
                pilot may see down the runway.

                RVR is reported whenever the station has RVR equipment and prevailing
                visibility is 1 sm or less and/or the RVR for the designated instrument runway
                is 6,000 feet (ft) or less. Otherwise the RVR group is omitted.

                RVR is coded in the following format: the initial R is code for runway and is
                followed by the runway number. When more than one runway is defined with
                the same runway number, a directional letter is coded on the end of the
                runway number. Next is a solidus (/) followed by the visual range in feet and
                then FT completes the RVR report. For example, an RVR value for
                Runway 01L of 800 ft would be coded R01L/0800FT. Most other countries
                use meters.

                In the United States, RVR values are coded in increments of 100 ft up to
                1,000 ft, increments of 200 ft from 1,000 ft to 3,000 ft, and increments of
                500 ft from 3,000 ft to 6,000 ft. Manual RVR is not reported below 600 ft.

                For U.S. airports only, the touchdown zone’s (TDZ) RVR is reported. For
                U.S. airports with multiple runways, the operating runway with the lowest

                                             3-8

11/14/16                        Aviation Weather Services                         AC 00-45H

                touchdown RVR is reported. RVR may be reported for up to four designated
                runways in other countries.

                When the RVR varies by more than one reportable value, the lowest and
                highest values will be shown with V between them, indicating variable
                conditions. For example, the 10-minute RVR for Runway 01L varying
                between 600 ft and 1,000 ft would be coded R01L/0600V1000FT.

                If RVR is less than its lowest reportable value, the visual range group is
                preceded by M. For example, an RVR for Runway 01L of less than 600 ft is
                coded R01L/M0600FT.

                If RVR is greater than its highest reportable value, the visual range group is
                preceded by a P. For example, an RVR for Runway 27 of greater than 6,000 ft
                will be coded R27/P6000FT.

      3.1.5.8   Present Weather Group.
                METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                TSB25 TS OHD MOV E SLP132

                Present weather includes precipitation, obscurations, and other weather
                phenomena. The appropriate notations found in Table 3-2, METAR/SPECI
                Notations for Reporting Present Weather, are used to code present weather.

                                            3-9

11/14/16                                     Aviation Weather Services                                 AC 00-45H

             Table 3-2. METAR/SPECI Notations for Reporting Present Weather1

                   QUALIFIER                                         WEATHER PHENOMENA

    INTENSITY OR
     PROXIMITY               DESCRIPTOR           PRECIPITATION         OBSCURATION            OTHER

             1                      2                    3                     4                   5

    -      Light        MI     Shallow           DZ   Drizzle          BR   Mist         PO     Dust/Sand
                                                                                                Whirls

           Moderate2    PR     Partial           RA   Rain             FG   Fog          SQ     Squalls

    +      Heavy        BC     Patches           SN   Snow             FU   Smoke        FC     Funnel Cloud,
                                                                                                Tornado or
                                                                                                Waterspout4

    VC     In the       DR     Low               SG   Snow             VA   Volcanic     SS     Sandstorm
           Vicinity3           Drifting               Grains                Ash

                        BL     Blowing           IC   Ice Crystals     DU   Widespread   DS     Duststorm
                                                      (Diamond              Dust
                                                      Dust)

                        SH     Shower(s)         PL   Ice              SA   Sand
                                                      Pellets

                        TS     Thunderstorms     GR   Hail             HZ   Haze

                        FZ     Freezing          GS   Small Hail       PY   Spray
                                                      and/or
                                                      Snow Pellets
                                                 UP   Unknown
                                                      Precipitation

   1. The weather groups are constructed by considering columns 1 through 5 in the table above in
   sequence, i.e., intensity followed by description, followed by weather phenomena, e.g., heavy rain
   shower(s) is coded as +SHRA.
   2.   To denote moderate intensity no entry or symbol is used.
   3.   See text for vicinity definitions.
   4.   Tornadoes and waterspouts are coded as +FC.

                       Separate groups are used for each type of present weather. Each group is
                       separated from the other by a space. METAR/SPECI reports contain no more
                       than three present weather groups.

                                                       3-10

11/14/16                           Aviation Weather Services                           AC 00-45H

                  When more than one type of present weather is reported at the same time,
                  present weather is reported in the following order:

                  •   Tornadic activity (tornado, funnel cloud, or waterspout).
                  •   Thunderstorm(s) (with and without associated precipitation).
                  •   Present weather in order of decreasing dominance (i.e., the most dominant
                      type reported first).
                  •   Left-to-right in Table 3-2 (columns 1 through 5).

                  Qualifiers may be used in various combinations to describe weather
                  phenomena. Present weather qualifiers fall into two categories: intensity
                  (see paragraph 3.1.5.8.1) or proximity (see paragraph 3.1.5.8.2) and
                  descriptors (see paragraph 3.1.5.8.3).

      3.1.5.8.1   Intensity Qualifier.
                  The intensity qualifiers are light, moderate, and heavy. They are coded with
                  precipitation types, except ice crystals (IC) and hail (GR or GS), including
                  those associated with a thunderstorm (TS) and those of a showery nature
                  (SH). Tornadoes and waterspouts are coded as heavy (+FC). No intensity is
                  ascribed to the obscurations of blowing dust (BLDU), blowing sand (BLSA),
                  and blowing snow (BLSN). Only moderate or heavy intensity is ascribed to
                  sandstorm (SS) and duststorm (DS).

                  When more than one form of precipitation is occurring at a time, or
                  precipitation is occurring with an obscuration, the reported intensities are not
                  cumulative. The reported intensity will not be greater than the intensity for
                  each form of precipitation. For example, -FZRAPL is light freezing rain and
                  light ice pellets, not light freezing rain and moderate ice pellets.

      3.1.5.8.2   Proximity Qualifier.
                  Weather phenomena occurring beyond the point of observation (between
                  5 and 10 sm) are coded as in the vicinity (VC). VC can be coded in
                  combination with thunderstorm (TS), fog (FG), shower(s) (SH),
                  well-developed dust/sand whirls (PO), blowing dust (BLDU), blowing sand
                  (BLSA), blowing snow (BLSN), sandstorm (SS), and duststorm (DS).
                  Intensity qualifiers are not coded in conjunction with VC.

                  For example, VCFG can be decoded as meaning some form of fog is between
                  5 and 10 sm of the point of observation. If VCSH is coded, showers are
                  occurring between 5 and 10 sm of the point of observation.

                  Weather phenomena occurring at the point of observation (at the station) or in
                  the vicinity of the point of observation are coded in the body of the report.
                  Weather phenomena observed beyond 10 sm from the point of observation (at
                  the station) is not coded in the body, but may be coded in the remarks section
                  (see paragraph 3.1.5.12).

                                              3-11

11/14/16                          Aviation Weather Services                           AC 00-45H

      3.1.5.8.3   Descriptor Qualifier.
                  Descriptors are qualifiers that further amplify weather phenomena and are
                  used in conjunction with some types of precipitation and obscurations. The
                  descriptor qualifiers are: shallow (MI), partial (PR), patches (BC), low
                  drifting (DR), blowing (BL), shower(s) (SH), thunderstorm (TS), and
                  freezing (FZ).

                  Only one descriptor is coded for each weather phenomena group
                  (e.g., FZDZ).

                  The descriptors shallow (MI), partial (PR), and patches (BC) are only coded
                  with fog (FG) (e.g., MIFG). Mist (BR) is not coded with any descriptor.

                  The descriptors low drifting (DR) and blowing (BL) will only be coded with
                  dust (DU), sand (SA), and snow (SN) (e.g., BLSN or DRSN). DR is coded
                  with DU, SA, or SN for raised particles drifting less than 6 ft above the
                  ground.

                  When blowing snow is observed with snow falling from clouds, both
                  phenomena are reported (e.g., SN BLSN). If blowing snow is occurring and
                  the observer cannot determine whether or not snow is also falling, then BLSN
                  is reported. Spray (PY) is coded only with blowing (BL).

                  The descriptor for showery-type precipitation (SH) is coded only with one or
                  more of the precipitation qualifiers for rain (RA), snow (SN), ice pellets (PL),
                  small hail (GS), or large hail (GR). When any type of precipitation is coded
                  with VC, the intensity and type of precipitation is not coded.

                  The descriptor for thunderstorm (TS) may be coded by itself when the
                  thunderstorm is without associated precipitation. A thunderstorm may also be
                  coded with the precipitation types of rain (RA), snow (SN), ice pellets (PL),
                  small hail and/or snow pellets (GS), or hail (GR). For example, a
                  thunderstorm with snow and small hail and/or snow pellets would be coded as
                  TSSNGS. TS is not coded with SH.

                  The descriptor freezing (FZ) is only coded in combination with fog (FG),
                  drizzle (DZ), or rain (RA) (e.g., FZRA). FZ is not coded with SH.

      3.1.5.8.4   Precipitation.
                  Precipitation is any form of water particle, whether liquid or solid, that falls
                  from the atmosphere and reaches the ground. The precipitation types are:
                  drizzle (DZ), rain (RA), snow (SN), snow grains (SG), ice crystals (IC),
                  ice pellets (PL), hail (GR), small hail and/or snow pellets (GS), and unknown
                  precipitation (UP). UP is reported if an automated station detects the
                  occurrence of precipitation, but the precipitation sensor cannot recognize the
                  type.

                                              3-12

11/14/16                           Aviation Weather Services                           AC 00-45H

                  Up to three types of precipitation may be coded in a single present weather
                  group. They are coded in order of decreasing dominance based on intensity.

      3.1.5.8.5   Obscuration.
                  Obscurations are any phenomenon in the atmosphere, other than precipitation,
                  that reduces the horizontal visibility in the atmosphere. The obscuration types
                  are: mist (BR), fog (FG), smoke (FU), volcanic ash (VC), widespread dust
                  (DU), sand (SA), haze (HZ), and spray (PY). Spray (PY) is coded only as
                  BLPY.

                  With the exception of volcanic ash, low drifting dust, low drifting sand, low
                  drifting snow, shallow fog, partial fog, and patches (of) fog, an obscuration is
                  coded in the body of the report if the surface visibility is less than
                  7 miles (mi), or considered operationally significant. Volcanic ash is always
                  reported when observed.

      3.1.5.8.6   Other Weather Phenomena.
                  Other weather phenomena types include: well-developed dust/sand whirls
                  (PO), sandstorms (SS), duststorms (DS), squalls (SQ), funnel clouds (FC),
                  and tornados and waterspouts (+FC).

      Examples:

      -DZ                           Light drizzle
      -RASN                         Light rain and (light) snow
      SN BR                         (Moderate) snow, mist
      -FZRA FG                      Light freezing rain, fog
      SHRA                          (Moderate) rain shower
      VCBLSA                        Blowing sand in the vicinity
      -RASN FG HZ                   Light rain and (light) snow, fog, haze
      TS                            Thunderstorm (without precipitation)
      +TSRA                         Thunderstorm, heavy rain
      +FC TSRAGR BR                 Tornado, thunderstorm, (moderate) rain, hail, mist

      3.1.5.9     Sky Condition Group.
                  METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                  R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                  TSB25 TS OHD MOV E SLP132

                  Sky condition is a description of the appearance of the sky. It includes either
                  cloud cover, vertical visibility, or clear skies.

                                              3-13

11/14/16                               Aviation Weather Services                                     AC 00-45H

                   The sky condition group is based on the amount of cloud cover (the first three
                   letters) followed by the height of the base of the cloud cover (final three
                   digits). No space is between the amount of cloud cover and the height of the
                   layer. The height of the layer is recorded in feet above ground level (AGL).

                   Sky condition is coded in ascending order and ends at the first overcast layer.
                   At mountain stations, if the layer is below station level, the height of the layer
                   will be coded as ///.

                   Vertical visibility is coded as VV, followed by the vertical visibility into the
                   indefinite ceiling. An indefinite ceiling is a ceiling classification applied
                   when the reported ceiling value represents the vertical visibility upward into
                   surface-based obscuration. No space is between the group identifier and the
                   vertical visibility. Figure 3-3, Obscuration Effects on Slant Range Visibility,
                   illustrates the effect of an obscuration on the vision from a descending
                   aircraft.

                   Figure 3-3. Obscuration Effects on Slant Range Visibility

       The ceiling is 500 ft in both examples, but the indefinite ceiling example (bottom) produces a
       more adverse impact to landing aircraft. This is because an obscuration (e.g., fog, blowing dust,
       snow) limits runway acquisition due to reduced slant range visibility. This pilot would be able to
       see the ground, but not the runway. If the pilot was at approach minimums, the approach could
       not be continued and a missed approach must be executed.

                                                     3-14

11/14/16                                      Aviation Weather Services                                 AC 00-45H

                     Clear skies are coded in the format SKC or CLR. When SKC is used, an
                     observer indicates no layers are present; CLR is used by automated stations to
                     indicate no layers are detected at or below 12,000 ft.

                     Each coded layer is separated from the others by a space. Each layer reported
                     is coded by using the appropriate reportable contraction seen in Table 3-3,
                     METAR/SPECI Contractions for Sky Cover. A report of clear skies (SKC or
                     CLR) is a complete layer report within itself. The abbreviations FEW, SCT,
                     BKN, and OVC will be followed (without a space) by the height of the layer.

                      Table 3-3. METAR/SPECI Contractions for Sky Cover

              Reportable                                                                 Summation
                                                        Meaning
              Contraction                                                              Amount of Layer

                   VV                               Vertical Visibility                       8/8
              SKC or CLR1                                 Clear                                  0
                 FEW2                                      Few                             1/8 – 2/8
                  SCT                                   Scattered                          3/8 – 4/8
                  BKN                                    Broken                            5/8 – 7/8
                  OVC                                   Overcast                              8/8

 1.   The abbreviation CLR will be used at automated stations when no layers at or below 12,000 ft are
      reported; the abbreviation SKC will be used at manual stations when no layers are reported.
 2.   Any layer amount less than 1/8 is reported as FEW.

                     The height is coded in hundreds of feet above the surface using three digits in
                     accordance with Table 3-4, METAR/SPECI Increments of Reportable Values
                     of Sky Cover Height.

      Table 3-4. METAR/SPECI Increments of Reportable Values of Sky Cover Height

              Range of Height Values (feet)                               Reportable Increment (feet)

                Less than or equal to 5,000                                     To nearest 100
                     5,001 to 10,000                                            To nearest 500
                   Greater than 10,000                                         To nearest 1,000

                     The ceiling is the lowest layer aloft reported as broken or overcast. If the sky
                     is totally obscured with ground-based clouds, the vertical visibility is the
                     ceiling.

                                                          3-15

11/14/16                                 Aviation Weather Services                                     AC 00-45H

                         Figure 3-4. METAR/SPECI Sky Condition Coding

  Clouds at 1,200 ft obscure 2/8ths of the sky (FEW). Higher clouds at 3,000 ft obscure an additional
  1/8th of the sky, and because the observer cannot see above the 1,200-ft layer, he is to assume that the
  higher 3,000-ft layer also exists above the lower layer (SCT). The highest clouds at 5,000 ft obscure
  2/8ths of the sky, and again since the observer cannot see past the 1,200 and 3,000-ft layers, he is to
  assume the higher 5,000-ft layer also exists above the lower layers (BKN). The sky condition group
  would be coded as: FEW012 SCT030 BKN050.

                     At manual stations, cumulonimbus (CB) or towering cumulus (TCU) is
                     appended to the associated layer. For example, a scattered layer of towering
                     cumulus at 1,500 ft would be coded SCT015TCU, and would be followed by
                     a space if there were additional higher layers to code.

       Examples:

       SKC                                          No layers are present
       CLR                                          No layers are detected at or below 12,000 ft AGL
       FEW004                                       Few at 400 ft AGL
       SCT023TCU                                    Scattered layer of towering cumulus at 2,300 ft
       BKN100                                       Broken layer (ceiling) at 10,000 ft
       OVC250                                       Overcast layer (ceiling) at 25,000 ft
       VV001                                        Indefinite ceiling with a vertical visibility of 100 ft
       FEW012 SCT046                                Few clouds at 1,200 ft, scattered layer at 4,600 ft

                                                       3-16

11/14/16                          Aviation Weather Services                            AC 00-45H

      SCT033 BKN085                        Scattered layer at 3,300 ft, broken layer (ceiling) at
                                           8,500 ft
      SCT018 OVC032CB                      Scattered layer at 1,800 ft, overcast layer (ceiling) of
                                           cumulonimbus at 3,200 ft
      SCT009 SCT024 BKN048                 Scattered layer at 900 ft, scattered layer at 2,400 ft,
                                           broken layer (ceiling) at 4,800 ft

      3.1.5.10   Temperature/Dewpoint Group.
                 METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                 R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                 TSB25 TS OHD MOV E SLP132

                 Temperature is the degree of hotness or coldness of the ambient air, as
                 measured by a suitable instrument. Dewpoint is the temperature to which a
                 given parcel of air must be cooled at constant pressure and constant water
                 vapor content for the air to become fully saturated.

                 Temperature and dewpoint are coded as two digits rounded to the nearest
                 whole degree Celsius. For example, a temperature of 0.3 ºC would be coded at
                 00. Sub-zero temperatures and dewpoints are prefixed with an M. For
                 example, a temperature of 4 ºC with a dewpoint of –2 ºC would be coded as
                 04/M02; a temperature of –2 ºC would be coded as M02.

                 If temperature is not available, the entire temperature/dewpoint group is not
                 coded. If dewpoint is not available, temperature is coded followed by a solidus
                 (/) and no entry is made for dewpoint. For example, a temperature of 1.5 ºC
                 and a missing dewpoint would be coded as 02/.

      3.1.5.11   Altimeter.
                 METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                 R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                 TSB25 TS OHD MOV E SLP132

                 The altimeter setting group codes the current pressure at elevation. This
                 setting is then used by aircraft altimeters to determine the true altitude above a
                 fixed plane of mean sea level (MSL).

                 The altimeter group always starts with an A and is followed by the four-digit
                 group representing the pressure in tens, units, tenths, and hundredths of
                 inches (in) of mercury. The decimal point is not coded. For example, an
                 altimeter setting of 29.92 in of Mercury would be coded as A2992.

      3.1.5.12   Remarks (RMK).
                 METAR KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM
                 R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2
                 TSB25 TS OHD MOV E SLP132

                                             3-17

11/14/16                                     Aviation Weather Services                                       AC 00-45H

                       Remarks are included in METAR and SPECI, when appropriate.

                       Remarks are separated from the body of the report by the contraction RMK.
                       When no remarks are necessary, the contraction RMK is not required.

                       METAR/SPECI remarks fall into two categories: (1) Automated, Manual, and
                       Plain Language, and (2) Additive and Automated Maintenance Data.

                                Table 3-5. METAR/SPECI Order of Remarks

               Automated, Manual, and Plain Language                       Additive and Automated Maintenance Data

                                                                                  Precipitation amount within a specified
  1.    Volcanic Eruptions             14.   Hailstone Size                 27.
                                                                                  time period*
  2.    Funnel Cloud                   15.   Virga                          28.   Cloud Types*
  3.    Type of Automated Station      16.   Variable Ceiling Height        29.   Duration of Sunshine*
  4.    Peak Wind                      17.   Obscurations                   30.   Hourly Temperature and Dewpoint
  5.    Wind Shift                     18.   Variable Sky Condition         31.   6-Hourly Maximum Temperature*
  6.    Tower or Surface Visibility    19.   Significant Cloud Types        32.   6-Hourly Minimum Temperature*
        Variable Prevailing                  Ceiling Height at Second             24-Hour Maximum and Minimum
  7.                                   20.                                  33.
        Visibility                           Location                             Temperature*
                                             Pressure Rising or Falling
  8.    Sector Visibility              21.                                  34.   3-Hourly Pressure Tendency*
                                             Rapidly
        Visibility at Second
  9.                                   22.   Sea-Level Pressure             35.   Sensor Status Indicators
        Location
  10.   Lightning                      23.   Aircraft Mishap                36.   Maintenance Indicator
        Beginning and Ending of                                           Note: Additive data is primarily used by the
  11.                                  24.   No SPECI Reports Taken
        Precipitation                                                     National Weather Service for climatological
                                                                          purposes.
        Beginning and Ending of
  12.                                  25.   Snow Increasing Rapidly
        Thunderstorms
                                                                          *These groups should have no direct impact on
                                             Other Significant            the aviation community and will not be discussed
  13.   Thunderstorm Location          26.                                in this document.
                                             Information

                       Remarks are made in accordance with the following:

                       •       Time entries are made in minutes past the hour if the time reported occurs
                               during the same hour the observation is taken. Hours and minutes are used
                               if the hour is different.
                       •       Present weather coded in the body of the report as VC may be further
                               described (e.g., direction from the station, if known). Weather phenomena
                               beyond 10 sm of the point(s) of observation are coded as distant (DSNT)
                               followed by the direction from the station. For example, precipitation of
                               unknown intensity within 10 sm east of the station would be coded as
                               VCSH E; lightning 25 sm west of the station would be coded as LTG
                               DSNT W.

                                                            3-18

11/14/16                          Aviation Weather Services                          AC 00-45H

                 •   Distance remarks are in statute miles except for automated lightning
                     remarks, which are in nautical miles.
                 •   Movement of clouds or weather, when known, is coded with respect to the
                     direction toward which the phenomena are moving. For example, a
                     thunderstorm moving toward the northeast would be coded as TS MOV
                     NE.
                 •   Directions use the eight points of the compass coded in a clockwise order.
                 •   Insofar as possible, remarks are entered in the order they are presented in
                     the following paragraphs (and Table 3-5, METAR/SPECI Order of
                     Remarks).

      3.1.5.13   Automated, Manual, and Plain Language Remarks.
                 These remarks generally elaborate on parameters reported in the body of the
                 report. An automated station or observer may generate automated and manual
                 remarks. Only an observer can provide plain language remarks.

      3.1.5.13.1 Volcanic Eruptions (Plain Language).
                 Volcanic eruptions are coded in plain language and contain the following,
                 when known:

                 •   Name of volcano;
                 •   Latitude and longitude or the direction and approximate distance from
                     the station;
                 •   Date/Time (UTC) of the eruption;
                 •   Size description, approximate height, and direction of movement of the
                     ash cloud; and
                 •   Any other pertinent data about the eruption.

                 For example, a remark on a volcanic eruption would look like the following:

                 RMK MT. AUGUSTINE VOLCANO 70 MILES SW ERUPTED AT
                 231505 LARGE ASH CLOUD EXTENDING TO APRX 30000 FEET
                 MOVING NE.

                 Pre-eruption volcanic activity is not coded. Pre-eruption refers to unusual
                 and/or increasing volcanic activity which could presage a volcanic eruption.

      3.1.5.13.2 Funnel Cloud.
                 At manual stations, tornadoes, funnel clouds, and waterspouts are coded in the
                 following format: tornadic activity, TORNADO, FUNNEL CLOUD, or
                 WATERSPOUT, followed by the beginning and/or ending time, followed by
                 the location and/or direction of the phenomena from the station, and/or
                 movement, when known. For example, TORNADO B13 6 NE would indicate

                                             3-19

11/14/16                          Aviation Weather Services                          AC 00-45H

                 that a tornado began at 13 minutes past the hour and was 6 sm northeast of the
                 station.

      3.1.5.13.3 Type of Automated Station.
                 AO1 or AO2 is coded in all METAR/SPECI from automated stations.
                 Automated stations without a precipitation discriminator are identified as
                 AO1; automated stations with a precipitation discriminator are identified as
                 AO2.

      3.1.5.13.4 Peak Wind.
                 Peak wind is coded in the following format: the remark identifier PK WND,
                 followed by the direction of the wind (first three digits), peak wind speed
                 (next two or three digits) since the last METAR, and the time of occurrence. A
                 space is between the two elements of the remark identifier and the wind
                 direction/speed group; a solidus (/), without spaces, separates the wind
                 direction/speed group and the time. For example, a peak wind of 45 kts from
                 280 degrees that occurred at 15 minutes past the hour is coded
                 PK WND 28045/15.

      3.1.5.13.5 Wind Shift.
                 Wind shift is coded in the following format: the remark identifier WSHFT,
                 followed by the time the wind shift began. The contraction FROPA is entered
                 following the time if there is reasonable data to consider the wind shift was
                 the result of a frontal passage. A space is between the remark identifier and
                 the time and, if applicable, between the time and the frontal passage
                 contraction. For example, a remark reporting a wind shift accompanied by a
                 frontal passage that began at 30 minutes after the hour would be coded
                 WSHFT 30 FROPA.

      3.1.5.13.6 Tower or Surface Visibility.
                 Tower or surface visibility is coded in the following format: tower
                 (TWR VIS) or surface (SFC), followed by the observed tower/surface
                 visibility value. A space is coded between each of the remark elements. For
                 example, the control tower visibility of 1 ½ sm would be coded
                 TWR VIS 1 1/2.

      3.1.5.13.7 Variable Prevailing Visibility.
                 Variable prevailing visibility is coded in the following format: the remark
                 identifier VIS, followed by the lowest and highest visibilities evaluated,
                 separated by the letter V. A space follows the remark identifier and no spaces
                 are between the letter V and the lowest/highest values. For example, a
                 visibility that was varying between ½ and 2 sm would be coded VIS 1/2V2.

      3.1.5.13.8 Sector Visibility (Plain Language).
                 Sector visibility is coded at manual stations in the following format: the
                 remark identifier VIS, followed by the sector referenced to eight points of the

                                             3-20

11/14/16                              Aviation Weather Services                                            AC 00-45H

                    compass, and the sector visibility in statute miles. For example, a visibility of
                    2 ½ sm in the northeastern octant is coded VIS NE 2 1/2.

       3.1.5.13.9 Visibility at Second Location.
                  At designated automated stations, the visibility at a second location is coded
                  in the following format: the remark identifier VIS, followed by the measured
                  visibility value and the specific location of the visibility sensor(s) at the
                  station. This remark will only be generated when the condition is lower than
                  that contained in the body of the report. For example, a visibility of 2 ½ sm
                  measured by a second sensor located at Runway 11 is coded
                  VIS 2 1/2 RWY11.

       3.1.5.13.10 Lightning.
                   When lightning is observed at a manual station, the frequency, type of
                   lightning, and location are reported. The contractions for the type and
                   frequency of lightning are based on Table 3-6, METAR/SPECI Type and
                   Frequency of Lightning, for example, OCNL LTGICCG NW, FRQ LTG
                   VC, or LTG DSNT W.

                    When lightning is detected by an automated system:

                    •    Within 5 NM of the Airport Location Point (ALP), it is reported as TS in
                         the body of the report with no remark.
                    •    Between 5 and 10 NM of the ALP, it is reported as VCTS in the body of
                         the report with no remark.
                    •    Beyond 10 but less than 30 NM of the ALP, it is reported in remarks only
                         as LTG DSNT followed by the direction from the ALP.

                  Table 3-6. METAR/SPECI Type and Frequency of Lightning

                                              Type of Lightning

       Type             Contraction                                       Definition

   Cloud-ground             CG        Lightning occurring between cloud and ground
     In-cloud               IC        Lightning which takes place within the cloud
    Cloud-cloud             CC        Streaks of lightning reaching from one cloud to another
     Cloud-air              CA        Streaks of lightning which pass from a cloud to the air, but do not strike the
                                      ground

                                           Frequency of Lightning

    Frequency           Contraction                                       Definition

    Occasional            OCNL        Less than 1 flash/minute
     Frequent              FRQ        About 1 to 6 flashes/minute
    Continuous            CONS        More than 6 flashes/minute

                                                     3-21

11/14/16                          Aviation Weather Services                           AC 00-45H

      3.1.5.13.11 Beginning and Ending of Precipitation.
                  At designated stations, the beginning and ending times of precipitation are
                  coded in the following format: the type of precipitation, followed by either a
                  B for beginning or an E for ending, and the time of occurrence. No spaces
                  are coded between the elements. The coded times of the precipitation start
                  and stop times are found in the remarks section of the next METAR. The
                  times are not required to be in the SPECI. The intensity qualifiers are coded.
                  For example, if rain began at 0005 and ended at 0030, and then snow began
                  at 0020 and ended at 0055, the remarks would be coded
                  RAB05E30SNB20E55. If the precipitation was showery, the remark is
                  coded SHRAB05E30SHSNB20E55. If rain ended and snow began at 0042,
                  the remark would be coded as RAESNB42.

      3.1.5.13.12 Beginning and Ending of Thunderstorms.
                  The beginning and ending times of thunderstorms are coded in the following
                  format: The thunderstorm identifier TS, followed by either a B for beginning
                  or an E for ending, and the time of occurrence. No spaces are between the
                  elements. For example, if a thunderstorm began at 0159 and ended at 0230,
                  the remark is coded TSB0159E30.

      3.1.5.13.13 Thunderstorm Location.
                  Thunderstorm locations are coded in the following format: the thunderstorm
                  identifier TS, followed by the location of the thunderstorm(s) from the
                  station, and the direction of movement, when known. For example, a
                  thunderstorm southeast of the station and moving toward the northeast is
                  coded TS SE MOV NE.

      3.1.5.13.14 Hailstone Size.
                  At designated stations, the hailstone size is coded in the following format: the
                  hail identifier GR, followed by the size of the largest hailstone. The hailstone
                  size is coded in ¼ in increments. For example, GR 1 3/4 would indicate that
                  the largest hailstones were 1 ¾ in. in diameter. If small hail or snow pellets,
                  GS, are coded in the body of the report, no hailstone size remark is required.

      3.1.5.13.15 Virga.
                  At designated stations, Virga is coded in the following format: the identifier
                  VIRGA, followed by the direction from the station. The direction of the
                  phenomena from the station is optional, e.g., VIRGA or VIRGA SW.

      3.1.5.13.16 Variable Ceiling Height.
                  The variable ceiling height is coded in the following format: the identifier
                  CIG, followed by the lowest ceiling height recorded, V denoting variability
                  between two values, and ending with the highest ceiling height. A single
                  space follows the identifier with no other spaces between the letter V and the
                  lowest/highest ceiling values. For example, CIG 005V010 would indicate a
                  ceiling is variable between 500 ft and 1,000 ft.

                                             3-22

11/14/16                          Aviation Weather Services                          AC 00-45H

      3.1.5.13.17 Obscurations.
                  Obscurations, surface-based or aloft, are coded in the following format: the
                  weather identifier causing the obscuration at the surface or aloft, followed by
                  the sky cover of the obscuration aloft (FEW, SCT, BKN, OVC) or at the
                  surface (FEW, SCT, BKN), and the height. Surface-based obscurations have
                  a height of 000. A space separates the weather causing the obscuration and
                  the sky cover; no space is between the sky cover and the height. For example,
                  fog hiding 3/8 to 4/8 of the sky is coded FG SCT000; a broken layer at
                  2,000 ft composed of smoke is coded FU BKN020.

      3.1.5.13.18 Variable Sky Condition.
                  Variable sky condition remarks are coded in the following format: the
                  two operationally significant sky conditions (FEW, SCT, BKN, and OVC),
                  separated by spaces, and V denoting the variability between the two ranges.
                  If several layers have the same condition amount, the layer height of the
                  variable layer is coded. For example, a cloud layer at 1,400 ft varying
                  between broken and overcast is coded BKN014 V OVC.

      3.1.5.13.19 Significant Cloud Types.
                  At manual stations, significant cloud type remarks are coded in all reports.

      3.1.5.13.20 Cumulonimbus.
                  Cumulonimbus not associated with thunderstorms is coded as CB, followed
                  by the direction from the station, and the direction of movement, when
                  known. The location, direction, and direction of movement entries are
                  separated from each other by a space. For example, a CB up to 10 sm west of
                  the station moving toward the east would be coded CB W MOV E. If the CB
                  was more than 10 sm to the west, the remark is coded CB DSNT W.

                  Cumulonimbus (CB) always evolves from the further development of
                  towering cumulus (TCU). The unusual occurrence of lightning and thunder
                  within or from a CB leads to its popular title, thunderstorm. A thunderstorm
                  usually contains severe or greater turbulence, severe icing, and Low-Level
                  Wind Shear (LLWS).

      3.1.5.13.21 Towering Cumulus.
                  Towering cumulus clouds are coded in the following format: the identifier
                  TCU, followed by the direction from the station. The cloud type and
                  direction entries are separated by a space. For example, a towering cumulus
                  cloud up to 10 sm west of the station is coded TCU W.

      3.1.5.13.22 Standing Lenticular or Rotor Clouds.
                  Stratocumulus (SCSL), altocumulus (ACSL), cirrocumulus (CCSL), or rotor
                  clouds are coded in the following format: the cloud type followed by the
                  direction from the station. The cloud type and direction entries are separated
                  by a space. For example, altocumulus standing lenticular clouds observed
                  southwest through west of the station are coded ACSL SW-W; an apparent

                                             3-23

11/14/16                                   Aviation Weather Services                                      AC 00-45H

                        rotor cloud 5 to 10 sm northeast of the station is coded APRNT ROTOR
                        CLD NE; and cirrocumulus clouds south of the station are coded CCSL S.

         3.1.5.13.23 Ceiling Height at Second Location.
                     At designated stations, the ceiling height at a second location is coded in the
                     following format: the identifier CIG, followed by the measured height of the
                     ceiling and the specific location of the ceilometer(s) at the station. This
                     remark is only generated when the ceiling is lower than that contained in the
                     body of the report. For example, if the ceiling measured by a second sensor
                     located at Runway 11 is broken at 200 ft, the remark would be coded
                     CIG 002 RWY11.

         3.1.5.13.24 Pressure Rising or Falling Rapidly.
                     At designated stations, the reported pressure is evaluated to determine if a
                     pressure change is occurring. If the pressure is rising or falling at a rate of at
                     least 0.06 in per hour and the pressure change totals 0.02 in or more at the
                     time of the observation, a pressure change remark is reported. When the
                     pressure is rising or falling rapidly at the time of observation, the remark
                     pressure rising rapidly (PRESRR) or pressure falling rapidly (PRESFR) is
                     included in the remarks.

         3.1.5.13.25 Sea-Level Pressure.
                     At designated stations, the sea-level pressure is coded in the following
                     format: the identifier SLP, immediately followed by the sea-level pressure in
                     millibars (mb) 1. The hundreds and thousands units are not coded and must be
                     inferred. For example, a sea-level pressure of 998.2 mb is coded SLP982. A
                     sea-level pressure of 1,013.2 mb would be coded SLP132. For a METAR, if
                     sea-level pressure is not available, it is coded SLPNO.

         3.1.5.13.26 Aircraft Mishap.
                     If a SPECI report is taken to document weather conditions when notified of
                     an aircraft mishap, the remark ACFT MSHP is coded in the report, but the
                     SPECI is not transmitted.

         3.1.5.13.27 No SPECI Reports Taken (Plain Language).
                     At manual stations where SPECIs are not taken, the remark NOSPECI is
                     coded to indicate no changes in weather conditions will be reported until the
                     next METAR.

         3.1.5.13.28 Snow Increasing Rapidly.
                     At designated stations, the snow increasing rapidly remark is reported in the
                     next METAR whenever the snow depth increases by 1 in or more in the past
                     hour. The remark is coded in the following format: the remark indicator

1
  Although the international unit of pressure measurement is now the Pascal, we will use the term millibar in this
document version because, at this time, it is felt the reader is probably more familiar with millibars. Increasingly in
meteorology literature, however, the term hectopascal (hPa) has replaced the term millibar to conform to
international standards and because 1 hPa = 1 mb.

                                                         3-24

11/14/16                         Aviation Weather Services                           AC 00-45H

                  SNINCR, the depth increase in the past hour, and the total depth of snow on
                  the ground at the time of the report. The depth of snow increase in the past
                  hour and the total depth on the ground are separated from each other by a
                  solidus (/). For example, a snow depth increase of 2 in. in the past hour with
                  a total depth on the ground of 10 in is coded SNINCR 2/10.

      3.1.5.13.29 Other Significant Information (Plain Language).
                  Agencies may add to a report other information significant to their
                  operations, such as information on fog dispersal operations, runway
                  conditions, FIRST or LAST reports from station, etc.

      3.1.5.13.30 Additive and Automated Maintenance Data.
                  Additive data groups (see Table 3-5) are only reported at designated stations
                  and are primarily used by the NWS for climatological purposes. Most have
                  no direct impact on the aviation community, but a few are discussed below.

      3.1.5.13.31 Hourly Temperature and Dewpoint.
                  At designated stations, the hourly temperature and dewpoint group are
                  further coded to the tenth of a degree Celsius. For example, a recorded
                  temperature of +2.6 ºC and dewpoint of -1.5 ºC would be coded T00261015.

                  The format for the coding is as follows:

                  T      Group indicator

                  0      Indicates the following number is positive; a 1 would be used if the
                         temperature was reported as negative at the time of observation

                  026    Temperature disseminated to the nearest tenth and read as 02.6

                  1      Indicates the following number is negative; a 0 would be used if the
                         number was reported as positive at the time of observation

                  015    Dewpoint disseminated to the nearest tenth and read as 01.5

      3.1.5.13.32 No spaces are between the entries. For example, a temperature of 2.6 ºC and
                  dewpoint of –1.5 ºC is reported in the body of the report as 03/M01 and the
                  hourly temperature and dewpoint group as T00261015. If the dewpoint is
                  missing, only the temperature is reported; if the temperature is missing, the
                  hourly temperature and dewpoint group are not reported.

      3.1.5.13.33 Maintenance Data Groups.
                  The following maintenance data groups, Sensor Status Indicators and the
                  Maintenance Indicator, are only reported from automated stations.

      3.1.5.14   Sensor Status Indicators.
                 Sensor status indicators are reported as indicated below:

                                             3-25

11/14/16                            Aviation Weather Services                          AC 00-45H

                   •   If the RVR is missing and would normally be reported, RVRNO is coded.
                   •   When automated stations are equipped with a present weather identifier
                       and the sensor is not operating, the remark PWINO is coded.
                   •   When automated stations are equipped with a tipping bucket rain gauge
                       and the sensor is not operating, PNO is coded.
                   •   When automated stations are equipped with a freezing rain sensor and the
                       sensor is not operating, the remark FZRANO is coded.
                   •   When automated stations are equipped with a lightning detection system
                       and the sensor is not operating, the remark TSNO is coded.
                   •   When automated stations are equipped with a secondary visibility sensor
                       and the sensor is not operating, the remark VISNO LOC is coded.
                   •   When automated stations are equipped with a secondary ceiling height
                       indicator and the sensor is not operating, the remark CHINO LOC is
                       coded.

        3.1.5.14.1 Maintenance Indicator.
                   A maintenance indicator ($) is coded when an automated system detects that
                   maintenance is needed on the system.