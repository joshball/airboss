---
handbook: ifh
edition: FAA-H-8083-15B
chapter_number: 9
section_title: System Status
faa_pages: 9-31
section_number: 50
source_url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf
---

# System Status

System Status
The status of GPS satellites is broadcast as part of the data
message transmitted by the GPS satellites. GPS status
information is also available by means of the United States
Coast Guard navigation information service: (703) 313-5907
or on the internet at www.navcen.uscg.gov. Additionally,
satellite status is available through the NOTAM system.
The GPS receiver verifies the integrity (usability) of the
signals received from the GPS constellation through RAIM
to determine if a satellite is providing corrupted information.
At least one satellite, in addition to those required for
navigation, must be in view for the receiver to perform
the RAIM function; thus, RAIM needs a minimum of five
satellites in view or four satellites and a barometric altimeter
(baro-aiding) to detect an integrity anomaly. For receivers
capable of doing so, RAIM needs six satellites in view (or
five satellites with baro-aiding) to isolate the corrupt satellite
signal and remove it from the navigation solution.
RAIM messages vary somewhat between receivers; however,
there are two most commonly used types. One type indicates
that there are not enough satellites available to provide RAIM
integrity monitoring and another type indicates that the RAIM
integrity monitor has detected a potential error that exceeds the
limit for the current phase of flight. Without RAIM capability,
the pilot has no assurance of the accuracy of the GPS position.
Selective Availability. Selective availability is a method
by which the accuracy of GPS is intentionally degraded.
This feature is designed to deny hostile use of precise GPS
positioning data. Selective availability was discontinued on
May 1, 2000, but many GPS receivers are designed to assume
that selective availability is still active. New receivers may
take advantage of the discontinuance of selective availability
based on the performance values in ICAO Annex 10 and do
not need to be designed to operate outside of that performance.
