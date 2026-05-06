---
handbook: ifh
edition: FAA-H-8083-15B
chapter_number: 5
section_title: Flight Management Systems (FMS)
faa_pages: 5-26
section_number: 49
source_url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf
---

# Flight Management Systems (FMS)

Flight Management Systems (FMS)
In the mid-1970s, visionaries in the avionics industry such
as Hubert Naimer of Universal, and followed by others such
as Ed King, Jr., were looking to advance the technology of
aircraft navigation. As early as 1976, Naimer had a vision
of a “Master Navigation System” that would accept inputs
from a variety of different types of sensors on an aircraft
and automatically provide guidance throughout all phases
of flight.
At that time aircraft navigated over relatively short distances
with radio systems, principally VOR or ADF. For long-range
flight inertial navigation systems (INS), Omega, Doppler,
and Loran were in common use. Short-range radio systems
usually did not provide area navigation (RNAV) capability.
Long-range systems were only capable of en route pointto-point navigation between manually entered waypoints
described as longitude and latitude coordinates, with typical
systems containing a limited number of waypoints.
The laborious process of manually entering cryptic latitude
and longitude data for each flight waypoint created high
crew workloads and frequently resulted in incorrect data
entry. The requirement of a separate control panel for each
long-range system consumed precious flight deck space and
increased the complexity of interfacing the systems with
display instruments, flight directors, and autopilots.
The concept employed a master computer interfaced with all
of the navigation sensors on the aircraft. A common control
display unit (CDU) interfaced with the master computer
would provide the pilot with a single control point for all
navigation systems, thereby reducing the number of required
flight deck panels. Management of the various individual
sensors would be transferred from the pilot to the new
computer.
Since navigation sensors rarely agree exactly about position,
Naimer believed that blending all available sensor position
data through a highly sophisticated, mathematical filtering
system would produce a more accurate aircraft position. He
called the process output the “Best Computed Position.”
By using all available sensors to keep track of position, the
system could readily provide area navigation capability.
The master computer, not the individual sensors, would
be integrated into the airplane, greatly reducing wiring
complexity.
To solve the problems of manual waypoint entry, a preloaded database of global navigation information would
be readily accessible by the pilot through the CDU. Using
such a system a pilot could quickly and accurately construct
a flight plan consisting of dozens of waypoints, avoiding
the tedious typing of data and the error potential of latitude/
longitude coordinates. Rather than simply navigating point-

Figure 5-44. A Control Display Unit (CDU) used to control the
flight management system (FMS).
to-point, the master system would be able to maneuver the
aircraft, permitting use of the system for terminal procedures
including departures, arrivals, and approaches. The system
would be able to automate any aspect of manual pilot
navigation of the aircraft. When the first system, called the
UNS-1, was released by Universal in 1982, it was called a
flight management system (FMS). [Figure 5-44]
An FMS uses an electronic database of worldwide
navigational data including navigation aids, airways and
intersections, Standard Instrument Departures (SIDs),
STARs, and Instrument Approach Procedures (IAPs) together
with pilot input through a CDU to create a flight plan. The
FMS provides outputs to several aircraft systems including
desired track, bearing and distance to the active waypoint,
lateral course deviation and related data to the flight guidance
system for the HSI displays, and roll steering command for
the autopilot/flight director system. This allows outputs from
the FMS to command the airplane where to go and when and
how to turn. To support adaptation to numerous aircraft types,
an FMS is usually capable of receiving and outputting both
analog and digital data and discrete information. Currently,
electronic navigation databases are updated every 28 days.
The introduction of the Global Positioning System (GPS) has
provided extremely precise position at low cost, making GPS
the dominant FMS navigation sensor today. Currently, typical
FMS installations require that air data and heading information
be available electronically from the aircraft. This limits FMS
usage in smaller aircraft, but emerging technologies allow
this data from increasingly smaller and less costly systems.
Some systems interface with a dedicated Distance Measuring
Equipment (DME) receiver channel under the control of the
FMS to provide an additional sensor. In these systems, the
FMS determines which DME sites should be interrogated
for distance information using aircraft position and the
navigation database to locate appropriate DME sites. The
FMS then compensates aircraft altitude and station altitude
with the aid of the database to determine the precise distance
to the station. With the distances from a number of sites the
FMS can compute a position nearly as accurately as GPS.
Aimer visualized three-dimensional aircraft control with an
FMS. Modern systems provide Vertical Navigation (VNAV) as
well as Lateral Navigation (LNAV) allowing the pilot to create
a vertical flight profile synchronous with the lateral flight plan.
Unlike early systems, such as Inertial Reference Systems (IRS)
that were only suitable for en route navigation, the modern
FMS can guide an aircraft during instrument approaches.
Today, an FMS provides not only real-time navigation
capability but typically interfaces with other aircraft systems
providing fuel management, control of cabin briefing and
display systems, display of uplinked text and graphic weather
data and air/ground data link communications.


![Figure 5-49. An aircraft equipped with ADS will receive identification, altitude in hundreds of feet (above or below using + or–), direction  of the traffic, and aircraft descent or climb using an up or down arrow.  The yellow target is an illustration of how a non-ADS equipped aircraft would appear on an ADS-equipped ](/handbooks/ifh/FAA-H-8083-15B/figures/fig-5-48-an-aircraft-equipped-with-ads-will-receive-ident.png)
