5.18   World Area Forecast System (WAFS).
       ICAO’s WAFS supplies aviation users with global aeronautical meteorological en route
       forecasts suitable for use in flight-planning systems and flight documentation.

       Two WAFCs, WAFC Washington and WAFC London, have the responsibility to issue
       the WAFS forecasts. WAFC Washington is operated by the NWS’s NCO in College
       Park, Maryland, and the AWC in Kansas City, Missouri. WAFC London is operated by
       the United Kingdom’s Meteorological Office in Exeter, United Kingdom.

5.18.1 WAFS Forecasts.
       Both WAFC Washington and WAFC London issue the following WAFS forecasts in
       accordance with ICAO Annex 3, Meteorological Service for International Air
       Navigation.

       •   Global forecasts of:
              o Upper wind and temperature (i.e., wind and temperature aloft, which is also
                issued in chart form for select areas);
              o Upper-air humidity;
              o Geopotential altitude of flight levels;
              o Flight level and temperature of tropopause (i.e., tropopause forecast);
              o Direction, speed, and flight level of maximum wind;
              o Cumulonimbus clouds;
              o Icing; and
              o Turbulence.
       •   Global forecasts of Significant Weather (SIGWX), i.e., High-Level Significant
           Weather (SIGWX) forecasts (see paragraph 5.17.3).
       •   Select regional areas of Medium-Level Significant Weather (SIGWX) forecasts
           (see paragraph 5.17.2).
       Note: See paragraph 5.17.2.1 and paragraph 5.17.2 for details on the WAFS
       High-Level and Medium-Level SIGWX forecasts.

                                             5-124

11/14/16                          Aviation Weather Services                            AC 00-45H

      5.18.1.1   Issuance.
                 The WAFS forecasts of upper wind, temperature, and humidity; direction,
                 speed, and flight level of maximum wind; flight level and temperature of
                 tropopause; areas of cumulonimbus clouds; icing; turbulence; and
                 geopotential altitude of flight levels are issued four times a day by both
                 WAFC Washington and WAFC London.

                 These forecasts are produced from weather computer models and are not
                 modified by WAFC forecasters. WAFC Washington’s is from the GFS model.
                 These forecasts are issued in grid-point format, i.e., WMO GRIB2 format.

                 The grid-point horizontal resolution for the WAFS forecast is 1.25 degree
                 latitude by 1.25 degree longitude. This is equivalent to a 75 x 75 NM grid box
                 at the equator with the grid boxes becoming progressively smaller toward the
                 poles.

                 These forecasts are valid for fixed valid times at 6, 9, 12, 15, 18, 21, 24, 27,
                 30, 33, and 36 hours after the time (0000, 0600, 1200, and 1800 UTC) on
                 which the forecasts were based.

      5.18.1.2   WAFS Wind and Temperature.
                 Wind and temperature forecasts are issued for flight levels (FL) 050
                 (850 MB), 100 (700 MB), 140 (600 MB), 180 (500 MB), 240 (400MB),
                 270 (350 MB), 300 (300 MB), 320 (275 MB), 340 (250 MB), 360 (225 MB),
                 390 (200 MB), 410 (175 MB), 450 (150 MB) and 530 (100 MB).

                 Note: ICAO uses flight levels below 18,000 MSL for global weather
                 products.

                 WAFC wind and temperature forecasts use a plotting model where the air
                 temperature (degrees Celsius) is the center of the data point and the wind
                 direction and speed follows the standard model (see Figure 5-64, WAFS Wind
                 and Temperature 6-hour Forecast at FL 390—Example) with the exception
                 that wind speed for points in the Southern Hemisphere is flipped. Note the
                 data points do not correspond to any airports or reference points with names
                 or identifiers.

                 WAFS global wind and temperature forecasts are provided in grid point
                 format (e.g., computer format) for use in flight-planning systems. Chart
                 format is also provided on the AWC’s Web page (under “Flight Folder”).

                                             5-125

11/14/16                    Aviation Weather Services                 AC 00-45H

    Figure 5-64. WAFS Wind and Temperature 6-hour Forecast at FL 390—Example

                                     5-126

11/14/16                         Aviation Weather Services                           AC 00-45H

      5.18.1.3   Humidity, Maximum Wind, Tropopause Forecasts.
                 No specific charts are issued for global upper-air humidity, maximum wind,
                 height of tropopause, and altitude of flight levels. These products are provided
                 in grid point format (e.g., computer format) for use in flight-planning systems.
                 Data from these forecasts are used by the WAFC forecasters to produce the
                 High-Level and Medium-Level SIGWX forecasts, which contain tropopause
                 and jet stream forecasts.

                 Humidity data is produced for FLs 50 (850 MB), 100 (700 MB), 140
                 (600 MB), and 180 (500 MB).

      5.18.1.4   WAFS Turbulence, Icing, and Cumulonimbus Cloud Forecasts.
                 WAFS global turbulence, icing, and cumulonimbus cloud forecasts are
                 provided in grid point format (e.g., computer format) for use in flight-planning
                 systems, but the AWC does make these available on their Web site in web
                 display format and not chart format. The Web display allows the user to select
                 various products and flight levels and view the forecasts as single time steps
                 or in a movie loop sequence. More detailed information is provided on
                 http://www.aviationweather.gov under WAFS Forecasts.

                 The WAFS global turbulence, icing, and cumulonimbus cloud forecasts are
                 actually a blend of the WAFC Washington global turbulence, icing, and
                 cumulonimbus cloud forecasts and the WAFC London global turbulence,
                 icing, and cumulonimbus cloud forecasts. In other words, each WAFC
                 produces their own global turbulence, icing, and cumulonimbus cloud
                 forecasts using their own global computer models (WAFC Washington uses
                 NCEP’s GFS model). The two WAFC’s forecasts, for turbulence, icing, and
                 cumulonimbus cloud only, are then merged together to eliminate any
                 differences between the two sets of forecasts.

                 WAFCs provide written guidance material on these WAFS forecasts,
                 available on ICAO’s Meteorology Web page. Consult the Guidance on the
                 Harmonized WAFS Grids for Cumulonimbus Cloud, Icing and Turbulence
                 Forecasts - 11 September 2012 at
                 http://www.icao.int/safety/meteorology/WAFSOPSG/Pages/GuidanceMaterial
                 .aspx.

      5.18.1.4.1 WAFS Turbulence.
                 Two kinds of turbulence forecasts are provided: Clear Air Turbulence (CAT)
                 and in-cloud turbulence.

                 Clear Air Turbulence.

                 As of 2015, WAFS CAT forecasts are derived from an algorithm that is based
                 on the Ellrod Index. The Ellrod Index results from an objective technique for
                 forecasting CAT. The index is calculated based on the product of horizontal
                 deformation and vertical wind shear derived from numerical model forecast

                                            5-127

11/14/16                               Aviation Weather Services                              AC 00-45H

                      winds aloft. Future upgrades to this product are planned, which may include
                      replacing the Ellrod Index with global version of the GTG forecast
                      (see paragraph 5.19.2).

                      The theoretical limit to the data range is zero to 99, but over 98 percent of the
                      values will be below 11, and they will rarely exceed 40. The numbers are not
                      a probability but are instead a potential of encountering turbulence of any
                      severity. The WAFCs suggests that a value of 6 should be considered as a
                      threshold for moderate or greater turbulence. AWC’s WAFS Web site
                      provides a display (see Figure 5-65, WAFS CAT Forecast—Example) of
                      WAFS forecasts, which includes CAT forecasts with values from 5 to 35.

                      CAT forecasts are produced for six vertical layers, each having a depth of
                      50 MB (see Table 5-26, WAFS Clear Air Turbulence Forecasts). Approximate
                      equivalent flight levels for each of the layers are shown in the right column of
                      the table. AWC’s WAFS Web site provides a display of WAFS forecasts,
                      which includes CAT forecasts.

                         Table 5-26. WAFS Clear Air Turbulence Forecasts

           Layer centred at (MB)             Layers from (MB)              Approximate Flight level

                   150                            125-175                          410-480
                   200                            175-225                          360-410
                   250                            225-275                          320-360
                   300                            275-325                          280-320
                   350                            325-375                          250-280
                   400                            375-425                          220-250

                                                  5-128

11/14/16                               Aviation Weather Services                                AC 00-45H

                          Figure 5-65. WAFS CAT Forecast—Example

  WAFS CAT 6-hour forecast for a layer centered at FL300 (300MB), i.e., from FL280 to FL320, for values from
  5 (yellow shade) to 35 (red shade).

                    In-Cloud Turbulence.

                    The in-cloud turbulence algorithms are based on the model indicating the
                    presence of a cloud and the change in potential energy with height, which is a
                    measure of instability. The range of values in the data is from 0 to 1 and is a
                    potential for encountering in-cloud turbulence. AWC’s WAFS Web site
                    provides a display of WAFS forecasts, which includes in-cloud turbulence.
                    In-cloud turbulence values from .005 to .035 are displayed (see Figure 5-66,
                    WAFS Turbulence Forecast—Example).

                    In-cloud turbulence forecasts are produced for five vertical layers, each
                    having a depth of 100 MB. Approximate equivalent flight levels for each of
                    the layers are shown in the right column of Table 5-27, WAFS In-Cloud
                    Turbulence Forecasts.

                                                   5-129

11/14/16                             Aviation Weather Services                                AC 00-45H

                      Table 5-27. WAFS In-Cloud Turbulence Forecasts

       Layers centred at (MB)               Layers from (MB)               Approximate Flight level

                300                             250-350                            270-340
                400                             350-450                            210-270
                500                             450-550                            160-210
                600                             550-650                            120-160
                700                             650-750                            080-120

                      Figure 5-66. WAFS Turbulence Forecast—Example

       WAFS In-Cloud Turbulence 6-hour forecast (purple shade) for a layer centered at FL240 (400MB),
       i.e., from FL210 to FL270.

      5.18.1.4.2 Icing.
                 The icing forecasts are derived from algorithms that are based on a
                 combination of cloud condensate (ice and water), temperature, relative
                 humidity, and vertical motion parameters that predict the presence of
                 super-cooled liquid droplets. The output is in a value range from 0 to 1 and is
                 a potential for the presence of icing. The higher the value, the greater the risk
                 of encountering icing. Future upgrades are planned to this model to change the
                 output to indicate the severity of icing.

                                                 5-130

11/14/16                                Aviation Weather Services                                   AC 00-45H

                    WAFS global icing forecasts are produced for six vertical layers, each having
                    a depth of 100 MB (see Table 5-28, WAFS Global Icing Forecasts).
                    Approximate equivalent flight levels for each of the layers are given in the
                    column of the Table 5-28. AWC’s WAFS Web site provides a display of icing
                    forecasts using a threshold of 0.7 or greater (see Figure 5-67, WAFS Icing
                    Forecast—Example).

                             Table 5-28. WAFS Global Icing Forecasts

        Layer centered at (MB)                 Layers from (MB)                 Approximate flight levels

                  300                               250-350                             270-340
                  400                               350-450                             210-270
                  500                               450-550                             160-210
                  600                               550-650                             120-160
                  700                               650-750                             080-120
                  800                               750-850                             050-080

                           Figure 5-67. WAFS Icing Forecast—Example

   A 6-hour forecast of icing (blue shade) for a layer centered at FL140 (600MB), i.e., from FL120 to FL160,
   using a threshold of 0.7 or greater.

                                                    5-131

11/14/16                                Aviation Weather Services                                 AC 00-45H

       5.18.1.4.3 Cumulonimbus Cloud (CB) Forecasts.
                  CB cloud forecasts are based on an algorithm gives information relating to
                  base, top, and horizontal extent (coverage) of any expected CB clouds. The
                  algorithm is based on Convective rainfall rates.

                     The horizontal extent component is expressed as a value between 0 and 1,
                     representing the fraction of sky covered by CB cloud within a grid box.
                     A value of 0.5 implies 50 percent coverage of CB cloud in that grid box
                     (a grid box is 1.25 degrees latitude by 1.25 degrees longitude in size).

                     Where CB clouds are forecast to exist, a base and a top of the CB cloud is
                     provided, represented by a height that can be converted into a flight level.
                     CB base and top forecasts are provided in meters above MSL. AWC’s WAFS
                     Web site provides a display of CB cloud forecasts with the CB tops shown in
                     flight levels (see Figure 5-68, WAFS CB Cloud Forecast—Example).

                        Figure 5-68. WAFS CB Cloud Forecast—Example

 A 6-hour forecast of CB clouds (grey shade) where coverage is more than 0.3, i.e., 30 percent.

                                                     5-132

11/14/16                           Aviation Weather Services                            AC 00-45H

       5.18.1.5   Use.
                  WAFS forecasts are for use in flight planning and flight documentation for
                  international air navigation.