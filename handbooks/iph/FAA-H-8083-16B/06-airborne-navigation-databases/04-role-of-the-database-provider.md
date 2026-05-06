---
handbook: iph
edition: FAA-H-8083-16B
chapter_number: 6
section_title: Role of the Database Provider
faa_pages: 6-13
section_number: 4
source_url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/FAA-H-8083-16B.pdf
---

# Role of the Database Provider

Role of the Database Provider
Compiling and maintaining a worldwide airborne
navigation database is a large and complex job. Within the
United States, the FAA sources give the database providers
information, in many different formats, which must be
analyzed, edited, and processed before it can be coded
into the database. In some cases, data from outside the
United States must be translated into English so it may be
analyzed and entered into the database. Once the data is
coded, it must be continually updated and maintained.
Once the FAA notifies the database provider that a change
is necessary, the update process begins. The change is
incorporated into a 28-day airborne database revision cycle
based on its assigned priority. If the information does not
reach the coding phase prior to its cutoff date (the date that
new aeronautical information can no longer be included
in the next update), it is held out of revision until the next
cycle. The cutoff date for aeronautical databases is typically
21 days prior to the effective date of the revision.
The integrity of the data is ensured through a process called
cyclic redundancy check (CRC). A CRC is an error detection
algorithm capable of detecting small bit-level changes in
a block of data. The CRC algorithm treats a data block as
a single, large binary value. The data block is divided by a
fixed binary number called a generator polynomial whose
form and magnitude is determined based on the level of
integrity desired. The remainder of the division is the CRC
value for the data block. This value is stored and transmitted
with the corresponding data block. The integrity of the
data is checked by reapplying the CRC algorithm prior to
distribution.


![Figure 6-4. Fly-by-waypoints and fly-over-waypoints.](/handbooks/iph/FAA-H-8083-16B/figures/fig-6-03-fly-by-waypoints-and-fly-over-waypoints.png)
