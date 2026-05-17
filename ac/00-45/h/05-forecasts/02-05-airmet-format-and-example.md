5.2.5   AIRMET Format and Example.
        An AIRMET message includes the following information as appropriate and in the order
        indicated:

        •   Reference to appropriate active SIGMETs affecting the area at the time of AIRMET
            issuance (e.g., SEE SIGMET BRAVO SERIES).
        •   Beginning time of the AIRMET phenomenon if different from the AIRMET
            beginning valid time.
        •   AIRMET name (SIERRA, TANGO, or ZULU), update number, weather
            phenomenon, and ending valid time. (Note: The AIRMET number is reset to 1 after
            0000 UTC each day.)

                                                    5-20

11/14/16                           Aviation Weather Services                        AC 00-45H

              o AIRMET Sierra describes IFR (instrument flight rules) conditions and/or
                extensive mountain obscurations. Hawaii AIRMETs for mountain obscuration
                may be issued for an area less than 3,000 mi2.
              o AIRMET Tango describes moderate turbulence, sustained surface winds of
                30 kts or greater, and Non-Convective low-level wind shear.
              o AIRMET Zulu describes moderate icing and provides freezing-level heights.
      •    List of affected states (CONUS only).
      •    Location of phenomenon using VORs.
      •    Description of phenomenon for the AIRMET issuance.
      •    Vertical extent (bases and tops), as appropriate.
      •    Ending time of phenomenon if different from the AIRMET ending time.
      •    Remarks concerning the continuance of the phenomenon during the 6 hours following
           the AIRMET ending time.
      •    CONUS and Hawaii AIRMETs: A separate AIRMET outlook is included in the
           AIRMET bulletin when conditions meeting AIRMET criteria are expected to occur
           during the 6-hour period after the valid time of the AIRMET bulletin.
      •    Alaska AIRMETs: Outlook information is included in the appropriate area forecast
           (FA) zone when conditions are expected to occur during the 8-hour period after the
           valid time of the AIRMET bulletin.
                     Figure 5-11. AIRMET Bulletin Decoding—Example

                                               5-21

11/14/16                         Aviation Weather Services                                AC 00-45H

                        Table 5-6. Decoding an AIRMET Bulletin

      Line                         Content                                  Description

              BOS                                               AIRMET area identifier
              S                                                 AIRMET series
       1
              WA                                                Product type
              211945                                            Issuance UTC date/time
              AIRMET                                            Product type
              SIERRA                                            AIRMET series
       2      UPDT 3                                            Update number
              FOR IFR AND MTN OBSCN                             Product description
              VALID UNTIL 220200                                Ending UTC date/time
              AIRMET IFR..ME NH VT MA CT RI NY NJ AND           Product type/series… Phenomenon
      3A      CSTL WTRS                                         location (states)
      3B      AIRMET MTN OBSCN..ME NH VT MA NY PA
              FROM CAR TO YSJ TO 150E ACK TO EWR TO YOW         Phenomenon location (VOR
      4A      TO CAR                                            locations)
              FROM CAR TO MLT TO CON TO SLT TO SYR TO
      4B      CAR
              CIG BLW 010/VIS BLW 3SM PCPN/BR. CONDS            Phenomenon description
      5A      CONT BYD 02Z THRU 08Z.
              MTNS OBSCD BY CLDS/PCPN/BR. CONDS CONT BYD
      5B      02Z THRU 08Z.

      The AIRMET bulletin in Figure 5-6 is decoded as follows:

      (Line 1) AIRMET SIERRA issued for the Boston area at 1945Z on the 21st day of the
      month. “SIERRA” contains information on Instrument Flight Rules (IFR) and/or
      mountain obscurations.

      (Line 2) This is the third updated issuance of this Boston AIRMET series as indicated by
      “SIERRA UPDT 3” and is valid until 0200Z on the 22nd.

      (Line 3A) The affected states within the BOS area are: Maine, New Hampshire, Vermont,
      Massachusetts, Connecticut, Rhode Island, New York, New Jersey and coastal waters.

      (Line 3B) The affected states within the BOS area are: Maine, New Hampshire, Vermont,
      Massachusetts, New York and Pennsylvania.

      (Line 4A) Within an area bounded by: Caribou, ME; to Saint Johns, New Brunswick; to
      150 nautical miles east of Nantucket, MA; to Newark, NJ; to Ottawa, Ontario; to
      Caribou, ME.

      (Line 4B) Within an area bounded by: Caribou, ME to Millinocket, ME to Concord, NH
      to Slate Run, PA to Syracuse, NY to Caribou, ME.

                                             5-22

11/14/16                          Aviation Weather Services                           AC 00-45H

      (Line 5A) Ceiling below 1,000 feet/visibility below 3 statute miles, precipitation/mist.
      Conditions continuing beyond 0200Z through 0800Z.

      (Line 5B) Mountains Obscured by clouds, precipitation and mist. Conditions continuing
      beyond 0200Z through 0800Z.

      5.2.5.1    AIRMET Updates and Amendments.
                 If an AIRMET is amended, AMD is added after the date/time group on the
                 FAA product line. The update number will be incremented, UPDT is added to
                 end of the line containing the list of affected states (CONUS only). The
                 issuance time of the AIRMET bulletin is updated to reflect the time of the
                 amendment. The ending valid time remains unchanged.

      5.2.5.2    AIRMET Corrections.
                 AIRMETs containing errors are corrected by adding COR after the date/time
                 group on the FAA product line. The issuance time of the AIRMET bulletin is
                 updated to reflect the time of the correction. The ending valid time remains
                 unchanged.