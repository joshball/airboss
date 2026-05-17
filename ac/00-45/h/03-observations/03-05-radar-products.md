3.3.5   Radar Products.
        The NWS produces many radar products that serve a variety of users. Some of these
        products are of interest to the aviation community. This paragraph will discuss radar
        mosaics, composite reflectivity, base reflectivity, and the radar coded message
        products.

        3.3.5.1    Radar Mosaic.
                   A radar mosaic consists of multiple single-site radar images combined to
                   produce a radar image on a regional or national scale. Regional and national
                   mosaics can be found on the Web sites of NWS, AWC, all NWS WFOs, as
                   well as commercial aviation weather providers.

                                                   3-41

11/14/16                        Aviation Weather Services                          AC 00-45H

                Radar mosaics can be assembled from either composite reflectivity
                (see paragraph 3.3.5.2) or base reflectivity (see paragraph 3.3.5.3), depending
                on the Web site or data provider. At this time, NWS national (see Figure 3-9,
                NWS National Radar Mosaic Example, Which Utilizes NEXRAD Base
                Reflectivity) and regional (see Figure 3-10, NWS Regional Radar Mosaic
                Sector Example, Which Utilizes NEXRAD Base Reflectivity), and Alaska
                (see Figure 3-11, Alaska Radar Mosiac Example) radar mosaic sectors are
                assembled using only base reflectivity data (0.5º radar beam angle with a
                124 NM range) and are set up to display all echoes (precipitation and
                non-precipitation). Most commercial aviation weather providers use
                composite reflectivity for their mosaics and configure the display to eliminate
                most non-precipitation echoes. NEXRAD radar data data-linked to aircraft
                cockpit displays via FAA Flight Information Service-Broadcast (FIS-B) use
                the composite reflectivity data for their radar mosaics.

       Figure 3-9. NWS National Radar Mosaic Example, Which Utilizes NEXRAD
                                  Base Reflectivity

                                           3-42

11/14/16                         Aviation Weather Services                                 AC 00-45H

Figure 3-10. NWS Regional Radar Mosaic Sector Example, Which Utilizes NEXRAD Base
                                   Reflectivity

                      Figure 3-11. Alaska Radar Mosaic Example

                Many areas of Alaska do not have radar coverage. These areas are shaded gray.

                                              3-43

11/14/16                        Aviation Weather Services                           AC 00-45H

      3.3.5.2   Composite Reflectivity.
                Because the highest precipitation intensity can be at any altitude, the
                composite reflectivity product (see Figure 3-12, WSR-88D Weather Radar
                Composite Reflectivity, Single-Site Product Example) is needed. Composite
                reflectivity is the maximum echo intensity (reflectivity) detected within a
                column of the atmosphere above a location. During its tilt sequence, the radar
                scans through all of the elevation slices to determine the highest decibel value
                in the vertical column (see Figure 3-13, Creation of a Composite Reflectivity,
                Single-Site Product), then displays that value on the product. When compared
                with base reflectivity, the composite reflectivity can reveal important storm
                structure features and intensity trends of storms (see Figure 3-14, Weather
                Radar 0.5º Base Reflectivity (left) versus Composite Reflectivity (right)
                Comparison).

                NEXRAD radar displays on airplane avionics use the composite reflectivity
                data for their radar mosaics.

    Figure 3-12. WSR-88D Weather Radar Composite Reflectivity, Single-Site Product
                                    Example

                                            3-44

11/14/16                                 Aviation Weather Services                                     AC 00-45H

            Figure 3-13. Creation of a Composite Reflectivity, Single-Site Product

      The composite reflectivity product displays the highest reflectivity of all elevation scans.

                 Figure 3-14. Weather Radar 0.5º Base Reflectivity (left) versus
                           Composite Reflectivity (right) Comparison

  This composite reflectivity shows that in many locations the highest precipitation intensity occurs at an
  altitude higher than precipitation detected at the elevation of the base elevation angle.

       3.3.5.3       Base Reflectivity.
                     Base reflectivity product is a display of both the location and intensity of
                     reflectivity data from the lowest elevation angle, or 0.5º above the horizon.

                                                       3-45

11/14/16                         Aviation Weather Services                           AC 00-45H

                The Base reflectivity product is one elevation scan, whereas composite
                reflectivity looks at all elevation scans. Base reflectivity products are
                available several minutes sooner than composite reflectivity products.

                Precipitation at any location may be heavier than depicted on the base
                reflectivity image because it is occurring above the lowest elevation angle.
                Both a short-range (see Figure 3-15, WSR-88D Weather Radar Short-Range
                (124 NM) Base Reflectivity, Single Site Product Example) and long-range
                (see Figure 3-16, WSR-88D Weather Radar Long-Range (248 NM) Base
                Reflectivity, Single Site Product Example) image are available from the
                0.5º base reflectivity product. The maximum range of the short-range,
                single-site radar base reflectivity product is 124 NM from the radar location.
                Long-range, single-site, base reflectivity product’s range is 248 NM from the
                radar location.

                When using a single-site radar, i.e., not using a radar mosaic, echoes farther
                than 124 NM (short-range) or 248 NM (long-range) from the radar site will
                not be displayed, even if precipitation may be occurring at these greater
                distances.

     Figure 3-15. WSR-88D Weather Radar Short-Range (124 NM) Base Reflectivity,
                           Single-Site Product Example

                                            3-46

11/14/16                        Aviation Weather Services                        AC 00-45H

Figure 3-16. WSR-88D Weather Radar Long-Range (248 NM) Base Reflectivity, Single-Site
                                Product Example

      3.3.5.4   Radar Coded Message (RCM).
                With the deployment of the WSR-88D (NEXRAD) radar network in the
                1990s, the manual radar observations, known by the acronyms ROB, SD, and
                RAREP, was replaced by the RCM. The RCM is the encoded and transmitted
                report of radar features observed by a WSR-88D radar. The RCM is generated
                automatically and has no human input or oversight.

                The actual RCM is highly detailed, complicated, and not intended for use by
                the pilot or operator in raw format. However, the RCM is used to generate
                certain radar charts or displays, such as “The Current RCM Radar Plot,”
                available on http://www.aviationweather.gov (see Figure 3-17, Radar Coded
                Message (RCM) Display), as well as other weather service provider’s
                Web sites.

                The RCM display is updated every 30 minutes. The display is an image
                representation of the NEXRAD radar composite reflectivity overlaid with
                cloud and echo tops and centroid movement. The RCM display includes the

                                           3-47

11/14/16                               Aviation Weather Services                                  AC 00-45H

                    maximum echo top for each radar’s area of coverage. The other tops shown on
                    the display are derived from the satellite images.

                    The echo tops shown on the display can be erroneous in some cases. The
                    algorithm computes echo tops (the altitude of echoes greater than or equal to
                    18 dBZ) within the range of the radar. This can lead to spurious values when
                    precipitation is far from the site. Values greater than 50,000 ft (500 ft on the
                    plot) can be disregarded, especially if their locations do not correspond to any
                    precipitation.

                         Figure 3-17. Radar Coded Message (RCM) Display

  The display is an image representation of the NEXRAD radar composite reflectivity overlaid with cloud
  and echo tops and centroid movement.