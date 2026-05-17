5.4.3   CWA Format and Example.

              Figure 5-21. Center Weather Advisory (CWA) Decoding Example

                                               5-32

11/14/16                               Aviation Weather Services                                 AC 00-45H

                     Table 5-8. Decoding a Center Weather Advisory (CWA)

  Line                       Content                                        Description
                               ZDV                                     ARTCC Identification
                                2                              Phenomenon Number (single digit, 1-6)
      1
                               CWA                                 Product Type (UCWA/CWA)
                             032140                           Beginning and/or issuance UTC date/time
                               ZDV                                     ARTCC Identification
                               CWA                                         Product Type
                                2                              Phenomenon Number (single digit, 1-6)
      2
                               02                           Issuance Number (issued sequentially for each
                                                                       Phenomenon Number)
                       VALID TIL 032340Z                            Ending valid UTC date/time
           FROM FMN TO 10N FMN TO 20NE FMN TO 10E                      Phenomenon Location
      3                  FMN TO FMN
           ISOLD SEV TS NR FMN MOVG NEWD 10KTS.                       Phenomenon Description
           TOP FL410. WND GSTS TO 55KTS. HAIL TO
      4    1 INCH RPRTD AT FMN. SEV TS CONTG BYD
                           2340Z

          The CWA in Figure 5-21, Center Weather Advisory (CWA) Decoding Example, is
          decoded as follows:

          (Line 1) Center Weather Advisory issued for the Denver ARTCC (ZDV) CWSU. The “2”
          after ZDV in the first line denotes this is the second meteorological event of the local
          calendar day. This CWA was issued/begins on the 3rd day of the month at 2140 UTC.

          (Line 2) The Denver ARTCC (ZDV) is identified again. The “202” in the second line
          denotes the phenomena number again (2) and the issuance number (02) for this
          phenomenon. This CWA is the valid until the 3rd day of the at 2340 UTC.

          (Line 3) From Farmington, New Mexico to 10 nautical miles north of Farmington,
          New Mexico to 20 nautical miles northeast of Farmington, NM to 10 nautical mile east of
          Farmington, New Mexico to Farmington, New Mexico.

          (Line 4) Isolated severe thunderstorms near Farmington moving northeastward at
          10 knots. Tops to Flight Level 410. Wind gusts to 55 knots. Hail to one inch reported at
          Farmington. Severe thunderstorms continuing beyond 2340 UTC.