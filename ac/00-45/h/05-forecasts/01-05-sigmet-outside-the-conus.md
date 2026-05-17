5.1.5   SIGMET—Outside the CONUS.

        5.1.5.1   SIGMET Issuance Criteria—Outside the CONUS.
                  U.S. SIGMETs outside the CONUS are issued when any of the following is
                  occurring or expected to occur affecting an area greater than 3,000 mi2 or, in

                                                5-10

11/14/16                        Aviation Weather Services                           AC 00-45H

                the judgment of the forecaster, an area having the potential to have a
                significant effect on the safety of aircraft operations.

                •   Thunderstorm—of type below*
                       o Obscured (OBSC TS)
                       o Embedded (EMBD TS)
                       o Widespread (WDSPR TS)
                       o Squall line (SQL TS)
                       o Isolated severe (ISOL SEV TS)
                •   Severe turbulence (SEV TURB)
                •   Severe icing (SEV ICE)
                       o With freezing rain (SEV ICE (FZRA))
                •   Widespread duststorm (WDSPR DS)
                •   Widespread sandstorm (WDSPR SS)
                •   Volcanic ash (VA)
                •   Tropical cyclone (TC)
                •   Radioactive cloud (RDOACT CLD)
                Note: Obscured, embedded, or squall line thunderstorms do not have
                to reach 3,000 mi2 criteria.

                *Tornado (TDO), funnel cloud (FC), waterspout (WTSPT) and heavy hail
                (HVY GR) may be used as a further description of the thunderstorm, as
                necessary.

      5.1.5.2   SIGMET Issuance Time and Valid Period—Outside the CONUS.
                A SIGMET is an unscheduled product issued any time conditions reaching
                SIGMET criteria are occurring or expected to occur within a 4-hour period. A
                SIGMET outside the CONUS can have a valid period up to, but not
                exceeding, 4 hours, except for volcanic ash (VA) and tropical cyclone (TC),
                which can be valid up to 6 hours. SIGMETs for continuing phenomena will be
                reissued at least every 4 (or 6) hours as long as SIGMET conditions continue
                to occur in the area for responsibility.

      5.1.5.3   SIGMET Format and Example—Outside the CONUS.
                SIGMETs outside the CONUS contain the following information, related to
                the specific phenomena and in the order indicated:

                •   Phenomenon and its description (e.g., SEV TURB).
                •   An indication whether the information is observed, using OBS and/or
                    FCST. The time of observation will be given in UTC.

                                            5-11

11/14/16                          Aviation Weather Services                           AC 00-45H

                 •   Location of the phenomenon referring, where possible the latitude and
                     longitude, and FLs (altitude) covering the affected area during the
                     SIGMET valid time. SIGMETs for volcanic ash cloud and tropical
                     cyclones contain the positions of the ash cloud, tropical cyclone center,
                     and radius of convection at the start of the validity time of the SIGMET.
                 •   Movement toward or expected movement using sixteen points of the
                     compass, with speed in knots, or stationary, if appropriate.
                 •   Thunderstorm maximum height as FL.
                 •   Changes in intensity, using, as appropriate, the abbreviations intensifying
                     (INTSF), weakening (WKN), or no change (NC).
                 •   Forecast position of volcanic ash cloud or the center of the tropical
                     cyclone at the end of the validity period of the SIGMET message.

           Figure 5-7. SIGMET Outside the Continental U.S. Decoding Example

                                             5-12

11/14/16                              Aviation Weather Services                                AC 00-45H

                   Table 5-3. Decoding a SIGMET Outside of the Continental U.S.

        Line                         Content                                    Description

    1          WSPA07                                            ICAO communication header

               PHFO                                              Issuance MWO

               010410                                            Issuance UTC date/time

    2          SIGPAT                                            NWS AWIPS communication header

    3          KZOA                                              Area Control Center
               SIGMET                                            Product type
               TANGO                                             SIGMET series
               2                                                 Issuance number
               VALID 010410/010800                               Valid period UTC date/time
               PHFO                                              Issuance office
    4          OAKLAND OCEANIC FIR                               Flight Information Region (FIR)

               FRQ TS OBS AND FCST WI 200NM N3006                Phenomenon description
               W14012 - N2012 W15016 CB TOP FL400 MOV W
               10KT WKN.

                      The SIGMET in Figure 5-7, SIGMET Outside the Continental U.S. Decoding
                      Example, is decoded as the following:

                      (Line 1) The WMO product header is WSPA07. Issued by the PHFO on the
                      1st day of the month at 0410 UTC.

                      (Line 2) The NWS AWIPS communication header is SIGPAT.

                      (Line 3) For the Oakland (KZOA) Area Control Center. This is the
                      2nd issuance of SIGMET Tango series, valid from the 1st day of the month at
                      0410 UTC until the 1st day of the month at 0800 UTC, issued by the Honolulu
                      Meteorological Watch Office.

                      (Line 4) Concerning the Oakland Oceanic Flight Information Region (FIR),
                      frequent thunderstorms observed and forecast within 200 nautical miles of
                      30 degrees and 6 minutes north; 140 degrees and 12 minutes west; to
                      20 degrees and 12 minutes north, 150 degrees and 16 minutes west,
                      cumulonimbus tops to flight level 400 moving west at 10 knots, weakening.

         5.1.5.4      SIGMETs for Volcanic Ash—Outside the CONUS.
                      A SIGMET for volcanic ash cloud is issued for volcanic eruptions. A volcanic
                      eruption is any volcanic activity, including the emission of volcanic ash,
                      regardless of the eruption’s magnitude. Initial volcanic ash SIGMETs may be
                      issued based on credible pilot reports in the absence of a volcanic ash advisory

                                                  5-13

11/14/16                         Aviation Weather Services                          AC 00-45H

                (VAA), but are updated once a VAA is issued. Volcanic ash SIGMETs will
                continue to be issued until the ash cloud is no longer occurring or expected to
                occur over the AOR.

                SIGMETs for volcanic ash cloud are valid up to 6 hours and provide an
                observed or forecast location of the ash cloud at the beginning of the
                SIGMET. A 6-hour forecast position for the ash cloud, valid at the end of the
                validity period of the SIGMET message, is also included. SIGMETs are
                reissued at least every 6 hours while the volcanic ash cloud hazard exists or is
                expected to exist.

      5.1.5.5   SIGMETs for Tropical Cyclone—Outside the CONUS.
                SIGMETs for a tropical cyclone may be issued for non-frontal synoptic-scale
                cyclones meeting the following criteria:

                •   Originates over tropical or sub-tropical waters with organized convection
                    and definite cyclonic surface wind circulation.
                •   Wind speeds reach 35 kts independent of the wind averaging time used by
                    the Tropical Cyclone Advisory Center (TCAC).

                SIGMETs for tropical cyclones will be valid up to 6 hours. SIGMETs for
                tropical cyclones will include two positions. The first position included will be
                the TCAC advisory position. The second position will be the forecast position
                valid at the end of the SIGMET period.

                In addition to the two storm positions, SIGMETs will include associated
                convection when applicable. SIGMETs will be reissued at least every 6 hours
                while the tropical cyclone wind remains or are expected to remain above
                34 kts.

      5.1.5.6   SIGMET Cancellation—Outside the CONUS.
                SIGMETs are canceled when the phenomena is no longer occurring or
                expected to occur in the AOR.

      5.1.5.7   SIGMET Amendments—Outside the CONUS.
                SIGMET amendments will not be issued. Instead, the next SIGMET in the
                series is issued to accomplish the update. The valid time of the new SIGMET
                is reset to reflect the new 4-hour valid period (6-hour for VA and TC
                SIGMETs).

      5.1.5.8   SIGMET Corrections—Outside the CONUS.
                Corrections to SIGMETs are issued as necessary. This is done by issuing a
                new SIGMET in the series, which advances the SIGMET number and cancels
                the previous SIGMET.

                                            5-14

11/14/16                       Aviation Weather Services                        AC 00-45H

      5.1.5.9   SIGMET for Volcanic Ash Example—Outside the CONUS.

                WVNT06 KKCI 082030
                TJZS SIGMET FOXTROT 2 VALID 082030/090230 KKCI-
                SAN JUAN FIR VA FROM SOUFRIERE HILLS LOC 1642N06210W

                VA CLD OBS AT 2030Z WI N1730 W06400 - N1700 W06300 -
                N1650 W06300 - N1710 W06400 - N1730 W06400. SFC/060.
                MOV W 15KT. FCST 0230Z VA CLD APRX N1730 W06500 -
                N1700 W06300 - N1650 W06300 - N1710 W06500 - N1730
                W06500.

                The ICAO communication header for this product is WVNT06. It is a SIGMET
                issued by the Aviation Weather Center (KKCI) in Kansas City, Missouri, on
                the 8th day of the month at 2030 UTC. This is the second (2) issuance of
                SIGMET series Foxtrot valid from the 8th day of the month at 2030 UTC until
                the 9th day of the month at 0230 UTC. Within the San Juan Oceanic FIR,
                volcanic ash from Soufriere Hills volcano located at 16 degrees/42 minutes
                north, 62 degrees/10 minutes west. Volcanic ash cloud observed at 2030 UTC
                within an area bounded by 17 degrees/30 minutes north,
                64 degrees/00 minutes west to 17 degrees/00 minutes north,
                63 degrees/00 minutes west to 16 degrees/50 minutes north,
                63 degrees/00 minutes west to 17 degrees/ 10 minutes north,
                64 degrees/00 minutes west to 17 degrees/30 minutes north,
                64 degrees/00 minutes west. From the surface to 6,000 feet MSL. Moving to
                the west at 15 knots. Forecast at 0230 UTC, volcanic ash cloud located
                approximately at 17 degrees/30 minutes north, 65 degrees/00 minutes west to
                17 degrees/00 minutes north, 63 degrees/00 minutes west to
                16 degrees/50 minutes north, 63 degrees/00 minutes west to
                17 degrees/10minutes north, 65 degrees/00 minutes west to
                17 degrees/30 minutes north, 65 degrees/ 00 minutes west.

                                          5-15

11/14/16                          Aviation Weather Services                          AC 00-45H

      5.1.5.10   SIGMET for Tropical Cyclone Example—Outside the CONUS.

                 WSNT03 KKCI 081451
                 SIGA0C
                 KZNY SIGMET CHARLIE 11 VALID 081500/082100 KKCI-

                 NEW YORK OCEANIC FIR TC KYLE OBS N3106 W07118 AT
                 1500Z CB TOP FL500 WI 120NM OF CENTER MOV WSW 5 KT
                 NC FCST 2100Z TC CENTER N3142 W07012

                 The ICAO communication header for this product is WSNT03. It is a SIGMET
                 issued by the Aviation Weather Center (KKCI) in Kansas City, Missouri, on
                 the 8th day of the month at 1451 UTC. The National Weather Service AWIPS
                 communication header for this product is SIGPAT. This is the eleventh (11)
                 issuance of SIGMET series Charlie valid from the 8th day of the month at
                 1500 UTC until the 8th day of the month at 2100 UTC. Within the New York
                 Oceanic FIR, Tropical Cyclone Kyle observed at 31 degrees/6 minutes north,
                 71 degrees/18 minutes west at 1500 UTC, cumulonimbus tops to flight level
                 500 (approximately 50,000 feet MSL), within 120 nautical miles of the center,
                 moving from west-southwest at 5 knots, no change in intensity is forecast, at
                 2100 UTC the tropical cyclone center will be at 31 degrees/42 minutes north,
                 70 degrees/12 minutes west.