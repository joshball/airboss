---
handbook: iph
edition: FAA-H-8083-16B
chapter_number: 6
section_title: Path and Terminator Legs
faa_pages: 6-5
section_number: 3
subsection_number: 1
source_url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/FAA-H-8083-16B.pdf
---

# Path and Terminator Legs

Path and Terminator Legs
There are currently 23 different leg types, or path and
terminators that have been created in the ARINC 424
standard that enable RNAV systems to follow the complex
paths that make up instrument departures, arrivals, and
approaches. They describe to navigation avionics a path

to be followed and the criteria that must be met before
the path concludes and the next path begins. Although
there are 23 leg types available, none of the manufactured
database equipment is capable of using all of the leg types.
Pilots must continue to monitor procedures for accuracy
and not rely solely on the information that the database
is showing. If the RNAV system does not have the leg type
Figure 6-5. Initial fix.
Figure 6-7. Constant radius arc or RF leg.
Next
segment
LE
ARC
CENTER
FIX
Previous
segment
demanded by procedures, data packers have to select one
or a combination of available lleg types to give the best
approximation, which can result in an incorrect execution
of the procedure. Below is a list of the 23 leg types and
their uses that may or may not be used by all databases.
TF LEG
Figure 6-6. Track to a fix leg type.
Figure 6-8. Course to a fix or CF leg.
CF LEG
080°
Course is flown making adjustment for wind
DF LEG
Unspecified position
Initial fix or IF leg—defines a database fix as a point
in space and is only required to define the beginning
of a route or procedure. [Figure 6-5]
Track to a fix or TF leg—defines a great circle track
over the ground between two known database
fixes and the preferred method for specification of
straight legs (course or heading can be mentioned
on charts but designer should ensure TF leg is used
for coding). [Figure 6-6]
Constant radius arc or RF leg—defines a constant
radius turn between two databases fixes, lines
tangent to the arc, and a center fix. [Figure 6-7]
Course to a fix or CF leg—defines a specified course
to a specific database fix. Whenever possible, TF legs
Figure 6-9. Direct to a fix or DF leg.
Figure 6-10. Fix to an altitude or FA leg.
FA LEG
080°
Unspecified position
8,000'
FA leg is flown making adjustment for wind

should be used instead of CF legs to avoid magnetic
variation issues. [Figure 6-8]
database fix until manual termination of the leg.
[Figure 6-13]
Direct to a fix or DF leg—defines an unspecified track
starting from an undefined position to a specified
fix. [Figure 6-9]
Course to an altitude or CA leg—defines a specified
course to a specific altitude at an unspecified
position. [Figure 6-14]
Fix to an altitude or FA leg—defines a specified track
Course to a DME distance or CD leg—defines a
Figure 6-11. Track from a fix from a distance or FC leg.
FC LEG
9 NM
080°
Figure 6-12. Track from a fix to a DME distance or FD leg.
FD LEG
D 10
080°
FM LEG
080°
Manual
termination
FM leg is flown making adjustment for wind
Figure 6-13. From a fix to a manual termination or FM leg.
over the ground from a database fix to a specified
altitude at an unspecified position. [Figure 6-10]
Track from a fix from a distance or FC leg—defines
a specified track over the ground from a database
fix for a specific distance. [Figure 6-11]
Track from a fix to a distance measuring equipment
(DME) distance or FD leg—defines a specified track
over the ground from a database fix to a specific
DME distance that is from a specific database DME
NAVAID. [Figure 6-12]
From a fix to a manual termination or FM leg—
defines a specified track over the ground from a
Figure 6-14. Course to an altitude or CA leg.
CA LEG
090°
Unspecified position
9,000'
Course is flown making adjustment for wind
Figure 6-15. Course to a DME distance of CD leg.
CD LEG
090°
D 10
Figure 6-16. Course to an intercept or CI leg.
CI LEG
090°
070°
Next leg
Figure 6-17. Course to a radial termination or CR leg.
CR LEG
120°
170°

specified course to a specific DME distance that is
from a specific database DME NAVAID. [Figure 6-15]
Course to an intercept or CI leg—defines a specified
course to intercept a subsequent leg. [Figure 6-16]
Course to a radial termination or CR leg—defines a
course to a specified radial from a specific database
VOR NAVAID. [Figure 6-17]
defines a specified heading to a specific altitude
termination at an unspecified position. [Figure 6-19]
Heading to a DME distance termination or VD
leg—defines a specified heading terminating at a
specified DME distance from a specific database
DME NAVAID. [Figure 6-20]
Heading to an intercept or VI leg—defines a
Figure 6-18. Arc to a fix or AF leg.
Boundary radial
245°
D10
LE
Figure 6-19. Heading to an altitude termination or VA leg.
VA LEG
Unspecified position
8,000'
090°
No correction made for wind
Arc to a fix or AF leg—defines a track over the ground
at a specified constant distance from a database
DME NAVAID. [Figure 6-18]
Heading to an altitude termination or VA leg—
VD LEG
090°
D 10
Figure 6-20. Heading to a DME distance termination or VD leg.
Figure 6-21. Heading to an intercept or VI leg.
VI LEG
090°
070°
Next leg
specified heading to intercept the subsequent leg
at an unspecified position. [Figure 6-21]
Heading to a manual termination or VM leg—
defines a specified heading until a manual
termination. [Figure 6-22]
Heading to a radial termination or VR leg—defines a
specified heading to a specified radial from a specific
VM LEG
Manual termination
070°
No correction made for wind
Figure 6-22. Heading to a manual termination or VM leg.
Figure 6-23. Heading to a radial termination or VR leg.
VR LEG
120°
170°

Figure 6-24. Procedure turn or PI leg.
PI
063°
018°
database VOR NAVAID. [Figure 6-23]
Procedure turn or PI leg—defines a course reversal
starting at a specific database fix and includes
outbound leg followed by a left or right turn and
180° course reversal to intercept the next leg. [Figure
6-24]
Racetrack course reversal or altitude termination
(HA), single circuit terminating at the fix (base turn)
(HF), or manual termination (HM) leg types—define
racetrack pattern or course reversals at a specified
database fix. [Figure 6-25]
Figure 6-25. Racetrack course reversal or HA, HF, and HM leg.
HA, HF, HM
076°
Previous leg
HA - Terminates at an altitude
HF - Terminates at the fix after one orbit
HM - Manually terminated
The GRAND JUNCTION FIVE DEPARTURE for Grand Junction
Regional in Grand Junction, Colorado, provides a good
example of different types of path and terminator legs
used. [Figure 6-26] When this procedure is coded into the
navigation database, the person entering the data into the
records must identify the individual legs of the flightpath
and then determine which type of terminator should be
used.
The first leg of the departure for Runway 11 is a climb
via runway heading to 6,000 feet mean sea level (MSL)
and then a climbing right turn direct to a fix. When this is
entered into the database, a heading to an altitude (VA)
value must be entered into the record’s path and terminator
field for the first leg of the departure route. This path and
terminator tells the avionics to provide course guidance
based on heading, until the aircraft reaches 6,000 feet,
and then the system begins providing course guidance
for the next leg. After reaching 6,000 feet, the procedure
calls for a right turn direct to the Grand Junction (JNC)
VORTAC. This leg is coded into the database using the path
and terminator direct to a fix (DF) value, which defines an
unspecified track starting from an undefined position to a
specific database fix.
Another commonly used path and terminator value is
heading to a radial (VR) which is shown in Figure 6-27
using the CHANNEL ONE DEPARTURE procedure for Santa
Ana, California. The first leg of the runway 19L/R procedure
requires a climb on runway heading until crossing the I-SNA
1 DME fix or the SLI R-118, this leg must be coded into the
database using the VR value in the Path and Terminator
field. After crossing the I-SNA 1 DME fix or the SLI R-118, the
avionics should cycle to the next leg of the procedure that
in this case, is a climb on a heading of 175° until crossing SLI
R-132. This leg is also coded with a VR Path and Terminator.
The next leg of the procedure consists of a heading of 200°
until intercepting the SXC R-084. In order for the avionics to
correctly process this leg, the database record must include
the heading to an intercept (VI) value in the Path and
Terminator field. This value directs the avionics to follow
a specified heading to intercept the subsequent leg at an
unspecified position.
The path and terminator concept is a very important part
of airborne navigation database coding. In general, it is not
necessary for pilots to have an in-depth knowledge of the
ARINC coding standards; however, pilots should be familiar
with the concepts related to coding in order to understand
the limitations of specific RNAV systems that use databases.
