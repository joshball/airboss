APPENDIX F. CORRECTION OF AIR MINIMUM CONTROL SPEED TO
                              STANDARD CONDITIONS


F.1        Overview.
           The following analysis presents three methods of correcting a flight test derived value
           of air minimum control speed to standard conditions. These methods are applicable only
           to rudder deflection limited VMCA, for either jet or propeller driven airplanes. The effect
           of banking into the operating engine is accounted for, and the method will work with
           either fixed pitch or constant speed propellers, including the effects of windmilling
           drag. For rudder pedal force limited VMCA, see appendix G of this AC.


F.2        Theoretical Basis.
           Given the static lateral/directional equations of motion for straight line, unaccelerated
           flight:
                         ∑ 𝐹𝑦 = 0            𝐶𝑦𝛽 ⋅ 𝛽 + 𝐶𝑦𝛿𝑎 ⋅ 𝛿𝑎 + 𝐶𝑦𝛿𝑟 ⋅ 𝛿𝑟 = 𝐶𝐿 𝑠𝑖𝑛 ∅            (1)
                         ∑ 𝑀𝑥 = 0            𝐶𝑙𝛽 ⋅ 𝛽 + 𝐶𝑙𝛿𝑎 ⋅ 𝛿𝑎 + 𝐶𝑙𝛿𝑟 ⋅ 𝛿𝑟 = 0                   (2)
                         ∑ 𝑀𝑧 = 0            𝐶𝑛𝛽 ⋅ 𝛽 + 𝐶𝑛𝛿𝑎 ⋅ 𝛿𝑎 + 𝐶𝑛𝛿𝑟 ⋅ 𝛿𝑟 = 𝐶𝑛𝑎                 (3)
           Where:
                                295 ⋅ 𝑊
                         𝐶𝐿 =
                                 𝑉𝑒2 ∙ 𝑆
                                 295 ⋅ 𝐹𝑛𝑎 ⋅ 𝑙𝑒
                         𝐶𝑛𝑎 =
                                  𝑉𝑒2 ⋅ 𝑆 ⋅ 𝑏
                         W = Weight (lbs)
                         Ve = Equivalent airspeed (kts)
                         S = Wing area (ft2)
                         Fna = Asymmetric net thrust (lbs)
                         Fna = (Fn + Dw) for engine inoperative
                         Fna = (Fn + Fi) for engine at idle
                         Fn = Net thrust of the operating engine (lbs)
                         Fi = Idle engine net thrust (lbs)
                         Dw = Windmill drag (lbs)
                         le = Distance from aircraft center line to engine thrust line (ft)
                         b = Wingspan (ft)


                                                   F-1

05/04/18                                                                                    AC 25-7D
                                                                                           Appendix F

F.3        Constant Cn Method.

F.3.1      For the case where full rudder deflection is achieved, r is a constant, and the system of
           equations can be resolved to an identity that shows that Cna is a linear function of
           CL sin Ø.
                        𝐶𝑛𝑎 = 𝐴 ⋅ 𝐶𝐿 𝑠𝑖𝑛 ∅ + 𝐵                                                    (4)

F.3.2      If it is assumed that test and standard day VMCA occur at the same angle-of-attack and
           bank angle, the asymmetric yawing moment coefficient will be constant, and VMCA can
           be corrected to standard conditions by the relationship:
                                            𝐹𝑛𝑎
                        𝑉𝑀𝐶𝐴𝑠 = 𝑉𝑀𝐶𝐴𝑡 ⋅ √𝐹 𝑠 for turbojets
                                             𝑛𝑎𝑡

                                                     1
                                           𝑇𝐻𝑃𝑠 √𝜎𝑠 3     𝐹𝑛𝑎
                        𝑉𝑀𝐶𝐴𝑠 = 𝑉𝑀𝐶𝐴𝑡 ⋅ [𝑇𝐻𝑃       𝜎
                                                     ] ⋅ √𝐹 𝑠 for propeller driven
                                              𝑡√ 𝑡        𝑛𝑎𝑡

           Where:
                         THPs = Maximum AFM scheduled brake/shaft horsepower multiplied
                                      by standard day propeller efficiency.
                          THPt = Test day brake/shaft horsepower where VMCA was achieved
                                      multiplied by test day propeller efficiency.
                        √𝜎𝑠 = Atmospheric density ratio at standard conditions.
                        √𝜎𝑡 = Atmospheric density ratio at test conditions.

F.3.3      Windmilling shaft horsepower is not considered because the current part 25 takeoff
           requirements for propeller driven airplanes result in such large performance penalties
           with a windmilling propeller that all part 25 turboprops to date have had autofeather
           installed.

F.3.4      Since both net thrust and shaft horsepower vary with speed, use of these equations will
           require an iterative solution. Because this constant Cn method does not consider the
           effect on VMCA due to variations in bank angle, weight, sideslip angle, or adverse yaw,
           its use is limited to corrections of 5 percent or less in asymmetric net thrust or power.

F.3.5      For corrections beyond 5 percent, the relationship shown in equation (4) should be used,
           and enough flight test data should be obtained to define the correlation between Cna and
           CL sin Ø.


F.4        Graphical Method.

F.4.1      In theory this data could be obtained by varying any combination of asymmetric power
           or thrust, airspeed, weight, and bank angle that would provide a representative variable
           set. However, since VMCA and stall speed are nearly coincident for most airplanes, there
           are some severe constraints on most of the variables. Typically, any reduction in


                                                    F-2

05/04/18                                                                                     AC 25-7D
                                                                                            Appendix F

           maximum asymmetric power or thrust will cause VMCA to decrease below stall speed,
           and any increase in weight will cause stall speed to increase above VMCA. Therefore, the
           only parameter that can reasonably be varied is bank angle.

F.4.2      To maximize the spread between stall and minimum control speed, VMCA tests are
           normally done at the lightest possible weight, at the maximum allowable asymmetric
           power or thrust (even with a short duration overboost, if the engine manufacturer will
           agree). At typical test altitudes (2000 to 3000 feet) and prototype gross weights, it will
           usually still not be possible to define VMCA with the full 5° bank, because of stall buffet.

F.4.3      To obtain the data necessary for extrapolation to the 5° bank limit, and to maximum
           asymmetric power or thrust, testing at three bank angles is required for the definition of
           the Cna versus CL sin Ø relationship. This data should be obtained by shutting down the
           critical engine (normally the left), setting maximum allowable power or thrust on the
           operative engine, and slowing down while maintaining constant heading until full
           rudder deflection is achieved. The first point, a wings level condition, is easy to set up,
           and results in a speed well above stall buffet. A second point, at zero sideslip, will be
           achieved at approximately 2° to 3° bank (flown with a yaw string, or instrumented
           sideslip vane) and will provide an intermediate speed, still above buffet. The third data
           point is flown with as much bank angle that can be used without excessive buffeting (no
           more than would be accepted as the minimum level of stall warning). If necessary, an
           additional point can be obtained by banking 2° to 3° into the inoperative engine.

F.4.4      To use this method, instrumentation is necessary for the determination of net
           thrust/shaft horsepower, and an accurate calibrated airspeed system is required, as well
           as engine/propeller charts for windmill drag, charts for propeller efficiency, and the
           ability to measure bank angle to at least a tenth of a degree.

F.4.5      Data obtained using this method with a typical business jet and a large jet transport are
           shown in figures F-1 and F-2, respectively:


                                                  F-3

05/04/18                                                                                   AC 25-7D
                                                                                          Appendix F

                               Figure F-1. Two-Engine Business Jet


                                Figure F-2. Four-Engine Transport


F.4.6      These plots represent the capability of the airframe to produce yawing moment by a
           combination of rudder deflection (full, in this case), and the sideslip which results from
           the bank angle. In order to determine the limiting condition for VMCA, it is necessary to
           know what the applied yawing moment is (due to the engine-out moments), and to plot
           the applied moments on the same plot, in a similar form. It is possible to do this by
           choosing a gross weight to be used to calculate CL, and since standard bank angle will
           be 5°, the only remaining variable in CL sin Ø is Ve. By choosing the appropriate values


                                                  F-4

05/04/18                                                                                              AC 25-7D
                                                                                                     Appendix F

           of Fn available versus Ve, a plot of Cna versus CL sin Ø can be made which represents
           the applied yawing moments. If the weight chosen represents some standard minimum
           weight, and the available net power or thrust values represent the maximum allowable
           power or thrust scheduled in the AFM, the intersection point of the airframe curve and
           the engine curve will be the desired standard day values, which can be used to calculate
           VMCA.

F.4.7      As an example, the following values of net thrust plus windmill drag have been
           extracted from a typical corporate jet engine spec. The data represent a maximum thrust
           engine, and have been corrected for ram drag and minimum accessory bleed and
           electrical load. The CL sin Ø values are based on a gross weight of 9000 lbs.


                    Table F-1. Example Data for Typical Business Jet Engine

              Ve                          Fna                       Cna                      CLsin
              70                         2,846                   0.079                       0.204
              90                         2,798                   0.047                       0.123
              110                        2,764                   0.031                       0.082
              130                        2,737                   0.022                       0.059
              150                        2,710                   0.016                       0.044

F.4.8      Plotting both the airframe and engine yawing moment curves on the same graph looks
           like:


                      Figure F-3. Yawing Moment—Engine and Airframe


                              0.09
                                                   .124
                              0.08                                  Engine

                              0.07

                              0.06                                             Airframe

                              0.05
                        Cna                                                        .048
                              0.04

                              0.03

                              0.02

                              0.01

                                0
                                     0     0.05   0.1        0.15            0.2      0.25

                                                        CLsin


                                                  F-5

05/04/18                                                                                  AC 25-7D
                                                                                         Appendix F

F.4.9      The intersection of the airframe and the engine curve shows values of:
                        𝐶𝑛𝑎 = 0.048        𝐶𝐿 𝑠𝑖𝑛 ∅ = 0.124

F.4.10     Since the engine Cn curve was based on W = 9000 lbs, the standard day value of VMCA
           can be determined from:
                                             295 ⋅ 𝑊
                        𝐶𝐿 𝑠𝑖𝑛 ∅ = 0.124 =
                                              𝑉𝑒2 ⋅ 𝑆
                             0.1108 ⋅ 9000
                        𝑉𝑒2 =
                                 0.124
                        𝑉𝑀𝐶𝐴 = 89.7 𝐾𝐸𝐴𝑆

F.4.11     If the airframe data is obtained from flight test, there are no assumptions or
           simplifications, and the value of VMCA derived from this method includes all the effects
           of bank angle, sideslip, adverse yaw, angle-of-attack, etc. Also, since the standard day
           value of Cna will always be less than the test value, no extrapolation is required, and
           there is no restriction on the value of standard day power or thrust that may be used.


F.5        Equation Method

F.5.1      A single test day value of VMCA can also be corrected to standard conditions (using all
           the appropriate variables) without using this graphical method, provided either the slope
           of the Cna versus CL sin Ø relationship is known (from wind tunnel, or analytical
           estimates), or one is willing to use a default (conservative) value. Power or thrust
           extrapolation using slope values not based on flight test is limited to 10 percent of the
           test day power or thrust. The following analysis shows the derivation of this
           single-point correction equation:

F.5.2      If the test day engine Cna curve was added to the previous plot, it would be possible to
           see how far, and in what direction, the correction from test to standard day was made.
           Assuming that a single value of VMCA was determined at 3000 feet at a weight of
           9000 lbs, a test day engine Cna curve could be plotted using the same technique used for
           the standard day curve, except substituting the 3000-foot thrust values from the engine
           specification:


                                                 F-6

05/04/18                                                                                                          AC 25-7D
                                                                                                                 Appendix F

    Table F-2. Example Data for Typical Business Jet Engine at Altitude of 3,000 Feet

              Ve                             Fna                                Cna                      CLsin
              70                            2,634                          0.073                         0.204
              90                            2,589                          0.043                         0.123
              110                           2,554                          0.029                         0.082
              130                           2,528                           0.02                         0.059
              150                           2,510                          0.015                         0.044

F.5.3      The following Cna versus CL sin Ø plot shows the airframe curve, the standard day
           engine curve, and the test day curve:


 Figure F-4. Yawing Moment—Engine and Airframe at Altitude of 3,000 Feet (Test Day)


                            0.09
                                                            .124          .147 Standard Day
                            0.08                                                      Engine

                            0.07

                            0.06
                                                                                               .052
                      Cna   0.05
                                                                                               .048
                            0.04
                                       Airframe
                            0.03

                            0.02                     Test Day
                                                      Engine
                            0.01
                                   0          0.05        0.1            0.15           0.2       0.25

                                                                CLsin


F.5.4      From the airframe/engine curve intersections:
                            𝐶𝑛𝑡 = 0.052              𝐶𝑛𝑠 = 0.048
                            𝐶𝐿 𝑠𝑖𝑛 ∅𝑡 = 0.147 𝐶𝐿 𝑠𝑖𝑛 ∅𝑠 = 0.124
                            𝑉𝑀𝐶𝐴𝑡 = 82.4 𝐾𝐸𝐴𝑆                                                         𝑉𝑀𝐶𝐴𝑠 = 89.7 𝐾𝐸𝐴𝑆

F.5.5      This is a thrust correction of approximately 8 percent. If the constant Cn method had
           been used, the test value of .052 would have applied, and the corresponding 𝑉𝑀𝐶𝐴𝑡


                                                            F-7

05/04/18                                                                                   AC 25-7D
                                                                                          Appendix F

           would have been 85.7 KEAS, an error of 4 knots (5 percent) in the non-conservative
           direction.

F.5.6      Noting that the correction from test day to standard day is along the Cn versus CL sin Ø
           curve, which is a straight line, and denoting the slope of the airframe curve as Kβ, the
           intersection of the standard day thrust line with the airframe curve as Cns and CL sin Ø,
           and the intersection of the test day thrust line with the airframe curve as Cnt and
           CL sin Ø, the following equation can be derived:

                        Given the point slope form of a straight line,
                                            𝑌2 − 𝑌1 = 𝑚(𝑋2 − 𝑋1 )

                        Correspondingly,
                                    𝐶𝑛𝑠 − 𝐶𝑛𝑡 = 𝐾𝛽 (𝐶𝐿 𝑠𝑖𝑛 ∅𝑠 −𝐶𝐿 𝑠𝑖𝑛 ∅𝑡 )
                                  𝐶𝑛𝑠 − 𝐾𝛽 ⋅ 𝐶𝐿 𝑠𝑖𝑛 ∅𝑠 = 𝐶𝑛𝑡 − 𝐾𝛽 ⋅ 𝐶𝐿 𝑠𝑖𝑛 ∅𝑡
                            𝐹𝑛𝑎𝑠 ⋅ 𝑙𝑒         𝑊𝑠 𝑠𝑖𝑛 ∅𝑠   𝐹𝑛𝑎𝑡 ⋅ 𝑙𝑒         𝑊𝑡 𝑠𝑖𝑛 ∅𝑡
                                       − 𝐾𝛽 ⋅           =            − 𝐾𝛽 ⋅
                            𝑞𝑠 ⋅ 𝑆 ⋅ 𝑏         𝑞𝑠 ⋅ 𝑆     𝑞𝑡 ⋅ 𝑆 ⋅ 𝑏         𝑞𝑡 ⋅ 𝑆

                        Substituting
                                                      𝑉𝑒2
                                                   𝑞=
                                                      295
                        And then multiplying through by
                                                  𝑉𝑒2𝑠 ⋅ 𝑆
                                                   295
                                 𝑙𝑒                𝑉𝑒2𝑠       𝑙𝑒
                           𝐹𝑛𝑎𝑠 ⋅ − 𝐾𝛽 𝑊𝑠 𝑠𝑖𝑛 ∅𝑠 = 2 ⋅ [𝐹𝑛𝑎𝑡 ⋅ − 𝐾𝛽 𝑊𝑡 𝑠𝑖𝑛 ∅𝑡 ]
                                 𝑏                 𝑉𝑒𝑡        𝑏

                        And finally,
                                                                      1
                                                 𝑙                    2
                                         𝐹𝑛𝑎𝑠 ⋅ ( 𝑒 ) − 𝐾𝛽 𝑊𝑠 𝑠𝑖𝑛 ∅𝑠
                         𝑉𝑀𝐶𝐴𝑠 = 𝑉𝑀𝐶𝐴𝑡 [         𝑏                   ] 𝑓𝑜𝑟 𝑡𝑢𝑟𝑏𝑜𝑗𝑒𝑡𝑠
                                                 𝑙𝑒
                                         𝐹𝑛𝑎𝑡 ⋅ ( ) − 𝐾𝛽 𝑊𝑡 𝑠𝑖𝑛 ∅𝑡
                                                 𝑏
                        And
                                                                             1
                                                                         2
                                       𝑆𝐻𝑃𝑠 × 𝜂𝑠 √𝜎𝑠 𝑙𝑒
                                 326 ⋅              ⋅ ( ) − 𝐾𝛽 𝑊𝑠 𝑠𝑖𝑛 ∅𝑠
                                          𝑉𝑀𝐶𝐴𝑠        𝑏
                𝑉𝑀𝐶𝐴𝑠 = 𝑉𝑀𝐶𝐴𝑡                                                    𝑓𝑜𝑟 𝑡𝑢𝑟𝑏𝑜𝑝𝑟𝑜𝑝𝑠
                                        𝑆𝐻𝑃𝑡 × 𝜂𝑡 √𝜎𝑡 𝑙𝑒
                                  326 ⋅              ⋅ ( ) − 𝐾𝛽 𝑊𝑡 𝑠𝑖𝑛 ∅𝑡
                                [          𝑉𝑀𝐶𝐴𝑡        𝑏                 ]


                                                  F-8

05/04/18                                                                                    AC 25-7D
                                                                                           Appendix F

F.5.7      In the simplified form of the lateral directional equations, K is 𝐶𝑛𝛽 ⁄𝐶𝑦𝛽 , which is the
           directional static margin. The value of K typically varies from approximately 0.14 to
           0.19, depending on the lateral/directional characteristics of the airplane being tested. As
           with the graphical method, if K is determined by flight test, power or thrust corrections
           to VMCA are based on an interpolation of flight test defined airframe capability, and
           there is no limit on the amount of the power or thrust correction to VMCA. A somewhat
           conservative default value of 0.20 for K may be used if flight test data is not available;
           however, in this case, any power or thrust extrapolation is limited to 10 percent of the
           test day power or thrust. To assure that corrections for bank angle and weight do not
           result in standard day VMCA values at or below stall speed, the corrections made by
           either the graphical or equation method should not result in a VMCA, which is based on a
           CL sin Ø that is greater than CLMAX sin 5°.


                                                  F-9

05/04/18                                                                                      AC 25-7D
                                                                                             Appendix G