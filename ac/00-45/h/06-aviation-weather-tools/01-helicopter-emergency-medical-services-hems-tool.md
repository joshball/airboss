6.1     Helicopter Emergency Medical Services (HEMS) Tool.
        The HEMS Tool is specifically designed to display weather conditions for short-distance
        and low-altitude flights that are common for emergency first responders. HEMS
        operators are extremely sensitive to changing and/or adverse weather conditions and need
        weather information presented for non-weather experts quickly and effectively. To meet
        this need, the Flight Path Tool on the AWC’s Web site was adapted and simplified to
        display high-resolution grids of critical weather parameters, particularly cloud ceiling and
        surface visibility. Using a highly interactive and intuitive tool that focuses on small,
        localized regions, HEMS operators gain critical weather awareness to make all their
        flights safe for crews and patients.

6.1.1   Availability.
        The HEMS Tool is continuously updated and available through the AWC’s Web site at
        http://www.aviationweather.gov/hemst.

6.1.2   Content.
        The HEMS Tool can overlay multiple grids of various weather parameters, as well
        as NWS textual weather observations and forecasts including: ceiling, visibility, flight
        category, winds, relative humidity, temperature, icing, satellite, radar (base and
        composite reflectivity), Airmen’s Meteorological Information (AIRMET) and significant
        meteorological information (SIGMET), Aviation Routine Weather Reports (METAR),
        Terminal Aerodrome Forecasts (TAF), Pilot Weather Reports (PIREP), NWS hazards,
        and Center Weather Advisories (CWA). Some gridded products (e.g., temperature,
        relative humidity, winds, and icing) are three-dimensional (3-D). Other gridded products
        are two-dimensional (2-D) and may represent a “composite” of a 3-D weather
        phenomenon or a surface weather variable, such as horizontal visibility. The tool also
        displays relevant NWS textual weather observations and forecasts needed for aviation.
        These data are either points of observed or forecast weather, often at airports, or regions
        of hazardous weather represented by 2-D polygons.

        The default displays the most recent analysis of flight category; colored flight category
        dots are selected airports, radar loops, SIGMETs, and recent PIREPs. The map can be
        panned in any direction and zoomed by using the “+/-” buttons or the mouse scroll wheel.

                                                6-1

11/14/16                          Aviation Weather Services                           AC 00-45H

      All 3-D data are interpolated to above ground level (AGL) altitudes and can be sliced
      horizontally on 1,000-foot intervals up to 5,000 feet (ft). All data can be animated from
      6 hours before to 6 hours after the current time.

      6.1.2.1    Visibility and Flight Category.
                 Three products are available for the ceiling and visibility analysis (CVA)
                 (see paragraph 4.2.1). The ceiling, visibility, and flight category weather
                 products originate from the CVA product, which is a gridded analysis of
                 ceiling and visibility based on surface observations and satellite imagery, and
                 is updated approximately every 5 minutes. The ceiling and visibility are used
                 together to classify the flight category as visual flight rules (VFR), Marginal
                 Visual Flight Rules (MVFR), instrument flight rules (IFR), and Low
                 Instrument Flight Rules (LIFR). Due to limitations of the observations, the
                 grid cells are approximately 5 kilometers (km) apart at best. In data sparse
                 regions, the best possible estimate of ceiling and visibility is assumed from the
                 nearest surrounding data and may not represent the actual conditions at a
                 specific point. Analyses of these fields are not available if the time slider is
                 moved into the future. Figure 6-1, HEMS Ceiling with Flight
                 Category—Example, Figure 6-2, HEMS Visibility with Flight Category
                 Overlay—Example, and Figure 6-3, HEMS Flight Category with Flight
                 Category Overlay—Example, are examples of the different overlays.

                 By default, the HEMS Tool displays the most recent analysis of flight
                 category colored distinctly for VFR, MVFR, IFR, and LIFR. The
                 classifications (see Table 6-1, Flight Categories) are defined by certain cloud
                 base ceilings and surface visibility values.

                                Table 6-1. Flight Categories

                                              6-2

11/14/16                             Aviation Weather Services                AC 00-45H

           Figure 6-1. HEMS Ceiling with Flight Category Overlay—Example

               Note: Ceilings above 3,000 ft are transparent.

           Figure 6-2. HEMS Visibility with Flight Category Overlay—Example

              Note: Visibilities above 5 miles (mi) are transparent.

                                                    6-3

11/14/16                             Aviation Weather Services                                     AC 00-45H

       Figure 6-3. HEMS Flight Category with Flight Category Overlay—Example

            Note: The flight category is colored for MVFR, IFR, and LIFR. The VFR areas are transparent.
            Yellow is used instead of red for coloring because it’s more difficult to distinguish between red and
            magenta on the image backgrounds.

      6.1.2.2    Radar.
                 The HEMS Tool uses the Multi-Radar/Multi-System (MRMS) mosaic
                 produced by NWS. The radar image combines more than 140 radars from
                 around the country into a single image. Additional post-processing is
                 performed to remove some ground clutter and Anomalous Propagation (AP).
                 Due to limitations of the radar, such as blockage by mountains, spacing of
                 radar locations, and over processing of clutter and AP, there may be
                 precipitation when radar data does not detect or show a complete weather
                 picture.

                 The image used in HEMS is the lowest reflectivity scan from the nearest
                 radar. This is a 1 km image for the continental United States (CONUS). Like
                 the satellite images, the radar mosaic is sliced up and put into the tile cache to
                 provide the maximum resolution and optimal transmission bandwidth. The tile
                 cache is only updated every 10 minutes (MRMS data is available every
                 2 minutes).

                 The HEMS display (see Figure 6-4, HEMS Radar Display—Example)
                 incorporates the latest radar image plus the previous four into a loop of radar
                 data showing the progression of precipitation echoes. By moving the time

                                                    6-4

11/14/16                         Aviation Weather Services                           AC 00-45H

                slider into the past, the radar loop will always show the latest five images
                ending in the time shown in the slider box.

                      Figure 6-4. HEMS Radar Display—Example

      6.1.2.3   Satellite.
                The HEMS Tool uses a global satellite mosaic constructed from the
                five geostationary satellites plus the appropriate polar global imagery. The
                resulting image is created every 30 minutes from the available imagery.
                Images are sliced up and provided through a progressive tile cache to optimize
                data transmission and image resolution.

                Note: A limitation of the satellite imagery is that the European
                Meteosat imagery is only available every 3 hours; therefore, imagery
                over Europe and Central Asia may be up to 3 hours old.

                There are three types of satellite imagery available in HEMS:

                   Infrared (IR): This is a 10 km image where brighter grays show
                   colder cloud temperatures (see Figure 6-5, HEMS Satellite
                   Imagery—Example).
                   Visible: This is a 5 km image showing visible reflection from
                   clouds and the ground surface. Consequentially, these images will
                   be black at night.
                   Water Vapor: This is a 10 km image where brighter grays show
                   higher areas of water vapor.

                                             6-5

11/14/16                         Aviation Weather Services                           AC 00-45H

                    Figure 6-5. HEMS Satellite Imagery—Example

      6.1.2.4   Icing.
                The icing severity product is a 3-D product and provides depictions at
                specified altitudes AGL at 1,000 foot-intervals up to 5,000 ft. In regions of
                steep terrain, these altitudes may have significant deviations from actual
                height above terrain given the limiting factor of grid cell size, which is
                approximately 13 km, and the resolution of the topography in the model. The
                icing severity product (see Figure 6-6, HEMS Icing Severity—Example)
                combines a multitude of weather observations (e.g., temperature, humidity,
                satellite, observed surface weather and pilot reports, radar data) to diagnose
                areas of expected trace, light, moderate, and heavy icing. Separate overall
                icing probability (from 5 to 85 percent) (see Figure 6-7, HEMS Icing
                Probability—Example) is provided as well.

                These products originate from the Current Icing Product (CIP) and Forecast
                Icing Product (FIP) (see paragraph 5.19.1). These products start with data
                from the Rapid Refresh (RAP) model, which is run hourly. FIP has forecasts
                at 1, 2, 3, 6, 9, 12, 15, and 18 hours. The time slider will use CIP for current
                and past times and time-adjusted FIP for future times.

                                             6-6

11/14/16                      Aviation Weather Services                                      AC 00-45H

                 Figure 6-6. HEMS Icing Severity—Example

           The severity is colored in shades of blue, with the lightest for trace and the darkest for
           heavy.

               Figure 6-7. HEMS Icing Probability—Example

           The probability is colored in shades starting at blue (5 percent), through yellow
           (50 percent), to orange (>75 percent).

                                             6-7

11/14/16                             Aviation Weather Services                                  AC 00-45H

      6.1.2.5    Temperature, Relative Humidity, and Wind Speed.
                 Temperature (see Figure 6-8, HEMS Temperature—Example), relative
                 humidity (see Figure 6-9, HEMS Relative Humidity—Example), and wind
                 speed data (see Figure 6-10, HEMS Wind Speed with Windbarb—Example)
                 is derived from the AGL grids provided as part of the RAP model output.
                 Data are presented on 1,000 ft AGL increments to 5,000 ft. These grids are
                 available from the RAP model output every hour and forecasts run 7 hours
                 into the future. If the time slider is moved into the past, the RAP analysis for
                 that hour is shown.

                         Figure 6-8. HEMS Temperature—Example

            The temperature data are colored from blues for the coldest temperatures to reds for the warmest.
            Delineation between light blue and yellow is used to show the freezing level.

                                                   6-8

11/14/16                         Aviation Weather Services                                    AC 00-45H

                  Figure 6-9. HEMS Relative Humidity—Example

            The humidity data are colored from oranges for very dry, to yellow for 50 percent, to
            dark green for near 100 percent. Oranges would be more indicative of clear skies while greens
            would show cloud or low-visibility areas.

           Figure 6-10. HEMS Wind Speed with Windbarb—Example

           The wind speed data are colored from blues for the lightest winds to light green for stronger
           winds.

                                               6-9

11/14/16                           Aviation Weather Services                            AC 00-45H

      6.1.2.6     Data Overlays.
                  The HEMS Tool allows the user to select multiple fields to be overlaid on the
                  grids including: METARs/TAFs, Flight Category, PIREPs, Windbarbs,
                  SIGMETs and G-AIRMETs (Graphical Airmen’s Meteorological
                  Information), CWAs, and NWS hazards. These fields may be selected on or
                  off in the drop-down Overlays menu. Figure 6-11, HEMS Data Overlays with
                  Text METAR—Example, is an example.

      6.1.2.6.1   METARs/TAFs.
                  The METAR observations plotted using the standard station model where
                  temperature, dewpoint, winds, altimeter setting, weather, ceiling, and visibility
                  are displayed around the station location.

                  The data plotted comes from the latest available observation, including
                  Special Weather Reports (SPECI). The stations displayed follow a progressive
                  priority scheme that will show more stations depending on how far the user
                  zooms in. This density can be changed through the Configuration menu. If the
                  time slider is moved into the past, the nearest observation before the listed
                  time is displayed. If the slider is moved into the future, the TAF for that
                  station is shown. It should be noted there are fewer TAF stations than
                  available METAR sites. More configuration options are available, including
                  parameters displayed, scale factor of graphic, and whether the TAF is
                  included in the pop-up display.

      6.1.2.6.2   Flight Category.
                  This displays only the flight conditions at a particular airport as a colored dot.
                  The flight category display uses the same priority filter system as the METAR
                  plots, but the density is much higher.

      6.1.2.6.3   PIREPs.
                  This displays turbulence and icing PIREPs. The default is to show only
                  PIREPs reported in the last 90 minutes, and only those below 12,500 ft. These
                  options can be changed in the Configuration menu.

                                               6-10

11/14/16                          Aviation Weather Services                         AC 00-45H

      6.1.2.6.4   SIGMETs.
                  This displays the current valid SIGMETs. This will show both domestic and
                  international SIGMETs. Individual SIGMET types can be toggled on and off
                  through the configuration menu. SIGMETs can be distinguished by their red
                  outline and red labels.

      6.1.2.6.5   G-AIRMET.
                  This displays the current valid G-AIRMETs. This will show all G-AIRMET
                  types, which can be cluttered. Each type can be toggled on and off through the
                  Configuration menu.

      6.1.2.6.6   Center Weather Advisories (CWA).
                  This displays the CWA issued by the Center Weather Service Units (CWSU)
                  at each air route traffic control center (ARTCC). CWAs can be distinguished
                  by the black outline and black labels.

      6.1.2.6.7   NWS Hazards.
                  This displays all current warnings, watches, and advisories. The Configuration
                  menu will allow the user to select “Warnings” which will only show tornado,
                  severe thunderstorm, blizzard, winter storm, and ice storm warnings.

      6.1.2.6.8   Windbarbs.
                  This displays windbarbs from the RAP model based on the height selected
                  through one of the weather displays (CVA, Icing and RAP temperature,
                  relative humidity (RH), and wind speed). If the user selects temperature at
                  2,000 ft AGL, the display would also show the winds at 2,000 ft AGL. The
                  windbarbs are filtered based on zoom level. As the display is zoomed in, more
                  windbarbs will show.

                                             6-11

11/14/16                          Aviation Weather Services                                   AC 00-45H

           Figure 6-11. HEMS Data Overlays with Text METAR—Example

             Note: Text information from these fields can be accessed by clicking on the station or in the
             polygon, or by selecting “hover” in the Configure menu and scrolling the mouse over the area
             of interest.

               Data can be customized in the Configure menu (see Figure 6-12, Configure
               Menu—Example). The user can select the type of background map; the level
               of transparency for the weather overlays; the types of SIGMETs,
               G-AIRMETs, PIREPs, and NWS hazards they wish to view; the preferred
               satellite view; and the density of observations.

                                               6-12

11/14/16                             Aviation Weather Services                          AC 00-45H

                           Figure 6-12. Configure Menu—Example

        6.1.2.7    ESRI Basemaps and Overlays.
                   The HEMS Tool has high-resolution basemaps for the entire United
                   States (U.S.). More detail is revealed as the user zooms in. The user can select
                   their preferred Environmental Systems Research Institute (ESRI) basemap
                   through the HEMS Configure menu. Options include Terrain, Road, or
                   Satellite, and the user can select a light, dark, or simple map background. The
                   default basemap is the ESRI Terrain view.

                   Map overlays include highways, roads, counties, top jet routes, ARTCC
                   boundaries, Navigation Aids (NAVAID), airports, and runways. These can be
                   toggled on or off in the Overlays menu.

6.1.3   Strengths and Limitations.

        6.1.3.1    HEMS Strengths.

                      One-stop shop for multiple data fields.
                      Focused on low-altitude flights common to HEMS.
                      Simplified display for non-meteorologist users.
                      Available 24/7.

        6.1.3.2    HEMS Limitations.

                      Due to limitations of the observations, the ceiling, visibility, and
                      flight category grid cells are approximately 5 km apart. In data

                                               6-13

11/14/16                            Aviation Weather Services                            AC 00-45H

                       sparse regions, the best possible estimate of ceiling and visibility is
                       assumed from the nearest surrounding data and may not represent
                       the actual conditions at a specific point.
                       Due to limitations of the radar, such as blockage by mountains,
                       spacing of radar locations and over processing of clutter and AP,
                       there may be precipitation when radar data does not detect or show
                       a complete weather picture. The most commonly seen example is
                       very shallow clouds with light precipitation, like freezing drizzle or
                       snow. An excellent Web site with more information concerning
                       radar technology and limitations is found at the NWS
                       JetStream-Online School for Weather, under Radar Frequently
                       Asked Questions (FAQ).
                       In regions of steep terrain, AGL altitudes may have significant
                       deviations from actual height above terrain, given the limiting
                       factor of grid cell size, which is approximately 13 km, and the
                       resolution of the topography in the model.

6.1.4   Use.
        The HEMS Tool has been specially designed to meet the needs of emergency first
        responders flying short-distance, low-altitude flight routes. This tool is not designed for
        General Aviation (GA) or commercial flights and does not constitute an official weather
        brief.