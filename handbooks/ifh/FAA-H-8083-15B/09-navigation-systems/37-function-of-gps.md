---
handbook: ifh
edition: FAA-H-8083-15B
chapter_number: 9
section_title: Function of GPS
faa_pages: 9-26
section_number: 37
source_url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf
---

# Function of GPS

Function of GPS
GPS operation is based on the concept of ranging and
triangulation from a group of satellites in space that act
as precise reference points. The receiver uses data from a
minimum of four satellites above the mask angle (the lowest
angle above the horizon at which it can use a satellite).
The aircraft GPS receiver measures distance from a satellite
using the travel time of a radio signal. Each satellite transmits
a specific code, called a course/acquisition (CA) code, which
contains information about satellite position, the GPS system
time, and the health and accuracy of the transmitted data.
Knowing the speed at which the signal traveled (approximately
186,000 miles per second) and the exact broadcast time,
the distance traveled by the signal can be computed from
the arrival time. The distance derived from this method of
computing distance is called a pseudo-range because it is not
a direct measurement of distance, but a measurement based
on time. In addition to knowing the distance to a satellite, a
receiver needs to know the satellite’s exact position in space,
its ephemeris. Each satellite transmits information about its
exact orbital location. The GPS receiver uses this information
to establish the precise position of the satellite.
Using the calculated pseudo-range and position information
supplied by the satellite, the GPS receiver/processor
mathematically determines its position by triangulation
from several satellites. The GPS receiver needs at least four
satellites to yield a three-dimensional position (latitude,
longitude, and altitude) and time solution. The GPS receiver
computes navigational values (distance and bearing to
a WP, groundspeed, etc.) by using the aircraft’s known
latitude/longitude and referencing these to a database built
into the receiver.
The GPS receiver verifies the integrity (usability) of the
signals received from the GPS constellation through receiver
autonomous integrity monitoring (RAIM) to determine if a
satellite is providing corrupted information. RAIM needs
a minimum of five satellites in view or four satellites and
a barometric altimeter baro-aiding to detect an integrity
anomaly. For receivers capable of doing so, RAIM needs
six satellites in view (or five satellites with baro-aiding)
to isolate a corrupt satellite signal and remove it from the
navigation solution.
Generally, there are two types of RAIM messages. One
type indicates that there are not enough satellites available
to provide RAIM and another type indicates that the RAIM
has detected a potential error that exceeds the limit for the
current phase of flight. Without RAIM capability, the pilot
has no assurance of the accuracy of the GPS position.
Aircraft using GPS navigation equipment under IFR for
domestic en route, terminal operations, and certain IAPs,
must be equipped with an approved and operational alternate
means of navigation appropriate to the flight. The avionics
necessary to receive all of the ground-based facilities
appropriate for the route to the destination airport and any
required alternate airport must be installed and operational.
Ground-based facilities necessary for these routes must also
be operational. Active monitoring of alternative navigation
equipment is not required if the GPS receiver uses RAIM for
integrity monitoring. Active monitoring of an alternate means

of navigation is required when the RAIM capability of the
GPS equipment is lost. In situations where the loss of RAIM
capability is predicted to occur, the flight must rely on other
approved equipment, delay departure, or cancel the flight.


![Figure 9-37. Standard two-bar VASI.](/handbooks/ifh/FAA-H-8083-15B/figures/fig-9-35-standard-two-bar-vasi.png)
