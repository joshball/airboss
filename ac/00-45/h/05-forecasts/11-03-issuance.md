5.11.3 Issuance.
       Scheduled TAFs prepared by NWS offices are issued four times a day, every 6 hours,
       according to the following schedule:

                             Table 5-17. TAF Issuance Schedule

     SCHEDULED ISSUANCE                  VALID PERIOD                  ISSUANCE WINDOW

           0000 UTC                  0000 to 2400 or 0600 UTC            2320 to 2340 UTC

           0600 UTC                  0600 to 0600 or 1200 UTC            0520 to 0540 UTC

           1200 UTC                  1200 to 1200 or 1800 UTC            1120 to 1140 UTC

           1800 UTC                  1800 to 1800 or 2400 UTC            1720 to 1740 UTC

       5.11.3.1   Minimum Observational Requirements for Routine TAF Issuance and
                  Continuation.
                  The NWS forecaster must have certain information for the preparation and
                  scheduled issuance of each individual TAF. Although integral to the TAF
                  writing process, a complete surface (METAR/SPECI) observation is not
                  required. Forecasters use the “total observation concept” to write TAFs with
                  data including nearby surface observations, radar, satellite, radiosonde, model
                  data, aircraft, and other sources.

                  If information sources, such as surface observations, are missing, unreliable,
                  or not complete, forecasters will append AMD NOT SKED to the end of a
                  TAF. The use of AMD NOT SKED indicates the forecaster has enough data,
                  using the total observation concept, to issue a forecast but will not provide
                  updates. This allows airport operations to continue using a valid TAF.

                  In rare situations where observations have been missing for extended periods
                  of time (i.e., more than one TAF cycle of 6 hours), and the total observation
                  concept cannot provide sufficient information, the TAF may be suspended by
                  the use of NIL TAF.

       5.11.3.2   Sites With Scheduled Part-Time Observations.
                  For TAFs with less than 24-hour observational coverage, the TAF will be
                  valid to the end of the routine scheduled forecast period even if observations
                  cease prior to that time. The time observations are scheduled to end and/or
                  resume will be indicated by expanding the AMD NOT SKED statement.

                                              5-92

11/14/16                         Aviation Weather Services                          AC 00-45H

                 Expanded statements will include the observation ending time (AFT
                 Y1Y1HHmm, e.g., AFT 120200), the scheduled observation resumption time
                 (TIL Y1Y1HHmm, e.g., TIL 171200Z) or the period of observation
                 unavailability (Y1Y1HH/YeYehh, e.g., 2502-2512). TIL will be used only
                 when the beginning of the scheduled TAF valid period coincides with the time
                 of the last observation or when observations are scheduled to resume prior to
                 the next scheduled issuance time. When used, these remarks will immediately
                 follow the last forecast group. If a routine TAF issuance is scheduled to be
                 made after observations have ceased, but before they resume, the remark
                 AMD NOT SKED will immediately follow the valid period group of the
                 scheduled issuance. After sufficient data using the total observation concept
                 has been received, the AMD NOT SKED remark will be removed.

      5.11.3.3   Examples of Scheduled Part-Time Observations TAFs.

                 TAF AMD
                 KRWF 150202Z 1502/1524 {TAF text}
                 AMD NOT SKED 1505Z-1518Z=

                 No amendments will be available between the 15th day of the month at
                 0500 UTC and the 15th day of the month at 1800 UTC due to lack of a
                 complete observational set between those times.

                 TAF AMD
                 KPSP 190230Z 1903/1924 {TAF text}
                 AMD NOT SKED=

                 Amendments are not scheduled.

      5.11.3.4   Automated Observing Sites Requiring Part-Time Augmentation.
                 TAFs for automated stations without present weather and obstruction to vision
                 information and have no augmentation or only part-time augmentation, are
                 prepared using the procedures for part-time manual observation sites detailed
                 in the previous paragraph, with one exception. This exception is the remark
                 used when the automated system is unattended. Specifically, the time an
                 augmented automated system is scheduled to go into unattended operation
                 and/or the time augmentation resumes is included in a remark unique to
                 automated observing sites: AMD LTD TO CLD VIS AND WIND (AFT
                 YYHHmm, or TIL YYhhmm, or YYHH-YYhh), where YY is the date,
                 HHmm is the time, in hours and minutes, of last augmented observation and
                 hhmm is the time, in hours and minutes, the second complete observation is
                 expected to be received. This remark, which does not preclude amendments
                 for other forecast elements, is appended to the last scheduled TAF issued prior
                 to the last augmented observation. It will also be appended to all subsequent
                 amendments until augmentation resumes.

                                            5-93

11/14/16                           Aviation Weather Services                           AC 00-45H

                  The AMD LTD TO (elements specified) remark is a flag for users and differs
                  from the AMD NOT SKED AFT Z remark for part-time manual observation
                  sites. AMD LTD TO (elements specified) means users should expect
                  amendments only for those elements and the times specified.

                  Example:

                  TAF AMD
                  KCOE 150202Z 1502/1524 text
                  AMD LTD TO CLD VIS AND WIND 1505-1518=
                  The amended forecast indicates that amendments will only be issued for wind,
                  visibility, and clouds, between the 15th day of the month at 0500Z and the
                  15th day of the month at 1800Z.

                  An amendment includes forecasts for all appropriate TAF elements, even
                  those not reported when the automated site is not augmented. If unreported
                  elements are judged crucial to the TAF and cannot be adequately determined
                  (e.g., fog versus moderate snow), the TAF will be suspended (i.e. an amended
                  TAF stating “AMD NOT SKED”).

                  AWOS systems with part-time augmentation, which the forecaster suspects
                  are providing unreliable information when not augmented, will be reported for
                  maintenance and treated the same as part-time manual observation sites. In
                  such cases, the AMD NOT SKED AFT YY/aaZ remark will be used.

       5.11.3.5   Non-Augmented Automated Observing Sites.
                  The TAF issued for automated observing stations with no augmentation may
                  be suspended in the event the forecaster is notified of, or strongly suspects, an
                  outage or unrepresentative data. Forecasters may also suspend TAF
                  amendments when an element the forecaster judges to be critical is missing
                  from the observation and cannot be obtained using the total observation
                  concept. The term AMD NOT SKED will be appended, on a separate line
                  and indented five spaces, to the end of an amendment to the existing TAF
                  when appropriate.