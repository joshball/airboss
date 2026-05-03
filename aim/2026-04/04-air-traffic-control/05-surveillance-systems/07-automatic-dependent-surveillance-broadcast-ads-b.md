# Automatic Dependent Surveillance-Broadcast (ADS-B) Services

Surveillance-Broadcast (ADS-B) Services
a. Introduction.
1. Automatic Dependent Surveillance-Broadcast (ADS-B) is a surveillance technology deployed
throughout the NAS (see FIG 4-5-7). The ADS-B
system is composed of aircraft avionics and a ground
infrastructure. Onboard avionics determine the
position of the aircraft by using the GNSS and
transmit its position along with additional information about the aircraft to ground stations for use by
ATC and other ADS-B services. This information is
transmitted at a rate of approximately once per
second. (See FIG 4-5-8 and FIG 4-5-9.)
2. In the United States, ADS-B equipped
aircraft exchange information is on one of two
frequencies: 978 or 1090 MHz. The 1090 MHz
frequency is associated with Mode A, C, and S
transponder operations. 1090 MHz transponders
with integrated ADS-B functionality extend the
transponder message sets with additional ADS-B
information. This additional information is known
as an “extended squitter” message and referred to as
1090ES. ADS-B equipment operating on 978 MHz
is known as the Universal Access Transceiver (UAT).
3. ADS B avionics can have the ability to both
transmit and receive information. The transmission
of ADS-B information from an aircraft is known as
ADS-B Out. The receipt of ADS-B information by
an aircraft is known as ADS-B In. On January 1,
2020, all aircraft operating within the airspace
defined in 14 CFR Part 91 § 91.225 will be required
to transmit the information defined in § 91.227
using ADS-B Out avionics.
4. In general, operators flying at 18,000 feet and
above will require equipment which uses 1090 ES.
Those that do not fly above 18,000 may use either
UAT or 1090ES equipment. (Refer to 14 CFR 91.225
and 91.227.) While the regulation will not require it,
operators equipped with ADS-B In will realize
additional benefits from ADS-B broadcast services:
Traffic Information Service – Broadcast (TIS-B)
(Paragraph 4-5-8) and Flight Information Service -
Broadcast (FIS-B) (Paragraph 4-5-9).

Surveillance Systems


FIG 4-5-7

ADS-B, TIS-B, and FIS-B:
Broadcast Services Architecture

b. ADS-B Certification and Performance
Requirements.
ADS-B equipment may be certified as a surveillance
source for air traffic separation services using
ADS-B Out. ADS-B equipment may also be
certified for use with ADS-B In advisory services
that enable appropriately equipped aircraft to
display traffic and flight information. Refer to the
aircraft’s flight manual supplement or Pilot
Operating Handbook for the capabilities of a specific
aircraft installation.

Surveillance Systems

c. ADS-B Capabilities and Procedures.
1. ADS-B enables improved surveillance services, both air-to-air and air-to-ground, especially
in areas where radar is ineffective due to terrain or
where it is impractical or cost prohibitive. Initial NAS
applications of air-to-air ADS-B are for “advisory”
use only, enhancing a pilot’s visual acquisition of
other nearby equipped aircraft either when airborne
or on the airport surface. Additionally, ADS-B will
enable ATC and fleet operators to monitor aircraft
throughout the available ground station coverage
area.

4-5-15


FIG 4-5-8

En Route - ADS-B/ADS-R/TIS-B/FIS-B Service Ceilings/Floors

FIG 4-5-9

Terminal - ADS-B/ADS-R/TIS-B/FIS-B Service Ceilings/Floors

4-5-16

Surveillance Systems

2. An aircraft’s Flight Identification (FLT ID),
also known as registration number or airline flight
number, is transmitted by the ADS-B Out avionics.
The FLT ID is comprised of a maximum of seven
alphanumeric characters and also corresponds to the
aircraft identification annotated on the ATC flight
plan. The FLT ID for airline and commuter aircraft is
associated with the company name and flight number
(for example, AAL3342). The FLT ID is typically
entered by the flightcrew during preflight through
either a Flight Management System (FMS) interface
(Control Display Unit/CDU) or transponder control
panel. The FLT ID for General Aviation (GA) aircraft
is associated with the aircraft’s registration number.
The aircraft owner can preset the FLT ID to the
aircraft’s registration number (for example,
N235RA), since it is a fixed value, or the pilot can
enter it into the ADS-B Out system prior to flight.
ATC systems use transmitted FLT IDs to uniquely
identify each aircraft within a given airspace and
correlate them to a filed flight plan for the provision
of surveillance and separation services. If the FLT ID
is not entered correctly, ATC automation systems
may not associate surveillance tracks for the aircraft
to its filed flight plan. Therefore, Air Traffic services
may be delayed or unavailable until this is corrected.
Consequently, it is imperative that flightcrews and
GA pilots ensure the FLT ID entry correctly matches
the aircraft identification annotated in the filed ATC
flight plan.
3. Each ADS-B aircraft is assigned a unique
ICAO address (also known as a 24-bit address) that
is broadcast by the ADS-B transmitter. The ICAO
address is programmable at installation. Should
multiple aircraft broadcast the same ICAO address
while transiting the same ADS-B Only Service
Volume, the ADS-B network may be unable to track
the targets correctly. If radar reinforcement is
available, tracking will continue. If radar is
unavailable, the controller may lose target tracking
entirely on one or both targets. Consequently, it is
imperative that the ICAO address entry is correct.
Aircraft that is equipped with ADS-B avionics on the
UAT datalink have a feature that allows it to broadcast
an anonymous 24-bit ICAO address. In this mode,
the UAT system creates a randomized address that
does not match the actual ICAO address assigned to
the aircraft. After January 1, 2020, and in the airspace
identified in § 91.225, the UAT anonymous 24-bit

Surveillance Systems


address feature may only be used when the operator
has not filed a flight plan and is not requesting ATC
services. In the anonymity mode, the aircraft’s
beacon code must set to 1200, and depending on the
manufacturer’s implementation, the aircraft’s call
sign might not be transmitted. Operators should be
aware that in UAT anonymous mode they will not be
eligible to receive ATC separation and flight
following services, and will likely not benefit from
enhanced ADS-B search and rescue capabilities.
4. ADS-B systems integrated with the
transponder will automatically set the applicable
emergency status when 7500, 7600, or 7700 are
entered into the transponder. ADS B systems not
integrated with the transponder, or systems with
optional emergency codes, will require that the
appropriate emergency code is entered through a pilot
interface. ADS-B is intended for in-flight and
airport surface use. ADS-B systems should be
turned “on” -- and remain “on” -- whenever
operating in the air and moving on the airport
surface. Civil and military Mode A/C transponders and ADS-B systems should be adjusted to the
“on” or normal operating position as soon as
practical, unless the change to “standby” has been
accomplished previously at the request of ATC.
d. ATC Surveillance Services using ADS-B -
Procedures and Recommended Phraseology
Radar procedures, with the exceptions found in this
paragraph, are identical to those procedures prescribed for radar in AIM Chapter 4 and Chapter 5.
1. Preflight:
If a request for ATC services is predicated on ADS-B
and such services are anticipated when either a VFR
or IFR flight plan is filed, the aircraft’s FLT ID as
entered in Item 7 of the ICAO flight plan (Block 2 of
FAA domestic flight plan) must be entered in the
ADS-B avionics.
2. Inflight:
When requesting ADS-B services while airborne,
pilots should ensure that their ADS-B equipment is
transmitting their aircraft’s registration number or
the approved FAA/ICAO company or organizational
designator, prior to contacting ATC. Aircraft
equipped with a “VFR” or anonymous feature, will
not broadcast the appropriate aircraft identification
information and should disable the anonymous
feature before contacting ATC.

4-5-17


3. Aircraft with an Inoperative/Malfunctioning
ADS-B Transmitter:
(a) ATC will inform the flight crew when the
aircraft’s ADS-B transmitter appears to be inoperative or malfunctioning:
PHRASEOLOGY-
YOUR ADS-B TRANSMITTER APPEARS TO BE
INOPERATIVE/MALFUNCTIONING. STOP ADS-B
TRANSMISSIONS.

(b) ATC will inform the flight crew if it
becomes necessary to turn off the aircraft’s ADS-B
transmitter.
PHRASEOLOGY-
STOP ADS-B TRANSMISSIONS.

(c) Other malfunctions and considerations:
Loss of automatic altitude reporting capabilities
(encoder failure) will result in loss of ATC altitude
advisory services.
e. ADS-B Limitations.
1. The ADS-B cockpit display of traffic is NOT
intended to be used as a collision avoidance system
and does not relieve the pilot’s responsibility to “see
and avoid” other aircraft. (See paragraph 5-5-8, See
and Avoid). ADS-B must not be used for avoidance
maneuvers during IMC or other times when there is
no visual contact with the intruder aircraft. ADS-B is
intended only to assist in visual acquisition of other
aircraft. No avoidance maneuvers are provided nor
authorized, as a direct result of an ADS-B target
being displayed in the cockpit.
2. Use of ADS-B radar services is limited to the
service volume of the GBT.
NOTE-
The coverage volume of GBTs are limited to line-of-sight.

f. Reports of ADS-B Malfunctions.
Users of ADS-B can provide valuable assistance in
the correction of malfunctions by reporting instances
of undesirable system performance. Since ADS-B
performance is monitored by maintenance personnel
rather than ATC, report malfunctions to the nearest
Flight Service Station (FSS) facility by radio or
telephone. Reporters should identify:
1. Condition observed.
2. Date and time of observation.
3. Altitude and location of observation.

4-5-18

4. Type and call sign of the aircraft.
5. Type and software version of avionics
system.
