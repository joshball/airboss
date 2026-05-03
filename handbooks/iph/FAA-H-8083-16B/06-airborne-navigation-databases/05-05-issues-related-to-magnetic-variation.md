---
handbook: iph
edition: FAA-H-8083-16B
chapter_number: 6
section_title: Issues Related To Magnetic Variation
faa_pages: 6-16
section_number: 5
subsection_number: 5
source_url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/FAA-H-8083-16B.pdf
---

# Issues Related To Magnetic Variation

Issues Related To Magnetic Variation
Magnetic variations for locations coded into airborne
navigation databases can be acquired in several ways. In
many cases they are supplied by government agencies in
the epoch year variation format. Theoretically, this value
is determined by government sources and published for
public use every five years. Providers of airborne navigation
databases do not use annual drift values; instead the
database uses the epoch year variation until it is updated by
the appropriate source provider. In the United States, this
is the National Oceanic and Atmospheric Administration
(NOAA). In some cases the variation for a given location is
a value that has been calculated by the avionics system.
These dynamic magnetic variation values can be different
than those used for locations during aeronautical charting
and must not be used for conventional NAVAIDs or airports.
Discrepancies can occur for many reasons. Even when the
variation values from the database are used, the resulting
calculated course might be different from the course
depicted on the charts. Using the magnetic variation for the
region instead of the actual station declination can result
in differences between charted and calculated courses and
Figure 6-31. Manufacturer’s naming conventions.

incorrect ground track. Station declination is only updated
when a NAVAID is site checked by the governing authority
that controls it, so it is often different than the current
magnetic variation for that location. Using an onboard
means of determining variation usually entails coding
some sort of earth model into the avionics memory. Since
magnetic variation for a given location changes predictably
over time, this model may only be correct for one time in
the lifecycle of the avionics. This means that if the intended
lifecycle of a GPS unit were 20 years, the point at which the
variation model might be correct would be when the GPS
unit was 10 years old. The discrepancy would be greatest
when the unit was new, and again near the end of its life
span.
Another issue that can cause slight differences between
charted course values and those in the database
occurs when a terminal procedure is coded using
magnetic variation of record. When approaches or other
procedures are designed, the designers use specific rules
to apply variation to a given procedure. Some controlling
government agencies may elect to use the epoch year
variation of an airport to define entire procedures at that
airport. This may result in course discrepancies between
the charted value and the value calculated using the actual
variations from the database.
