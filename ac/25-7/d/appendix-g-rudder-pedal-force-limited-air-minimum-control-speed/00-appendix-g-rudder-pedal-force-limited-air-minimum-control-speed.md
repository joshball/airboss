APPENDIX G. RUDDER PEDAL FORCE-LIMITED AIR MINIMUM CONTROL SPEED


G.1        One Acceptable Method.
           The following analysis presents one method of addressing rudder pedal force limited air
           minimum control speed. This method is applicable to either jet or propeller driven
           airplanes. The effect of banking into the operating engine is accounted for, and the
           method will work with either fixed pitch or constant speed propellers, including the
           effects of windmilling drag. For rudder deflection limited VMCA, see appendix F of this
           AC.

G.1.1      Given the static lateral/directional equations of motion for straight line, unaccelerated
           flight:
                         ∑ 𝐹𝑦 = 0               𝐶𝑦𝛽 ⋅ 𝛽 + 𝐶𝑦𝛿𝑎 ⋅ 𝛿𝑎 + 𝐶𝑦𝛿𝑟 ⋅ 𝛿𝑟 = 𝐶𝐿 𝑠𝑖𝑛 ∅          (1)
                         ∑ 𝑀𝑥 = 0               𝐶𝑙𝛽 ⋅ 𝛽 + 𝐶𝑙𝛿𝑎 ⋅ 𝛿𝑎 + 𝐶𝑙𝛿𝑟 ⋅ 𝛿𝑟 = 0                 (2)
                         ∑ 𝑀𝑧 = 0               𝐶𝑛𝛽 ⋅ 𝛽 + 𝐶𝑛𝛿𝑎 ⋅ 𝛿𝑎 + 𝐶𝑛𝛿𝑟 ⋅ 𝛿𝑟 = 𝐶𝑛𝑎               (3)

G.1.2      For a reversible control system, rudder force versus deflection is:
                         𝐹𝑅 = 𝐺𝑅 ⋅ 𝑞 ⋅ 𝑆𝑅 ⋅ 𝐶𝑅 ⋅ 𝐶ℎ𝛿𝑅 ∙ 𝛿𝑅
                                        F
                         and δ𝑅 = k R ⋅ VR2
                                            e


G.1.3      Substituting for FR in equations (1) through (3), and solving, results in an identity of the
           form:
                         𝐹𝑅 = 𝐴 ⋅ 𝐹𝑛𝑎 − 𝐵 ⋅ 𝑊 𝑠𝑖𝑛 ∅

G.1.4      All the airspeed terms cancel, indicating that the engine-out rudder force required for
           straight flight is not a function of airspeed, but only of asymmetric power or thrust,
           weight, and bank angle. If asymmetric power or thrust did not vary with airspeed, it
           would be possible to stabilize at any airspeed with the same rudder force. At higher
           speeds, less rudder deflection would be required (varies inversely with Ve2 ), but the
           same force would be required (varies directly with Ve2 ). When a force limited VMCA is
           determined during flight test, the variation in rudder force with airspeed results solely
           from the change in net power or thrust with speed, and if an airspeed (i.e., power or
           thrust level) is reached at which the rudder force is 150 lbs, there is no way to correct
           this force limited VMCA to any other power or thrust level. Therefore, if VMCA is rudder
           pedal force limited, takeoff power or thrust at all flight conditions should be limited to
           the test value of asymmetric power or thrust.

G.1.5      In some cases, it is possible to achieve full rudder deflection at the test altitude without
           reaching a pedal force limit, but with the higher power or thrust at standard conditions,
           a force limit would exist. To preclude missing this crossover effect, the following
           analysis should be performed whenever test day rudder pedal forces are greater than 90


                                                     G-1

05/04/18                                                                                                          AC 25-7D
                                                                                                                 Appendix G

           percent of the part 25 limit (i.e., 135 lbs after amendment 25-42; 162 lbs prior to
           amendment 25-42).

           G.1.5.1      At any convenient airspeed (typically 1.13 VSR with minimum takeoff
                        flaps), shut down the critical engine, and leave it windmilling (propeller
                        feathered if autofeather is required), apply maximum available
                        power/thrust to the operating engine, and while maintaining constant
                        heading, vary the bank angle from 10° to less than 5° in approximately
                        2°-3° increments, noting the rudder force at each stabilized bank angle.

           G.1.5.2      Plot the rudder force versus Wsin Ø for each of the test points. See
                        figure G-1.)


                                        Figure G-1. Rudder Force Versus WsinΦ


                                                            250
                                                                      Wsin =


                            Rudder Pedal Force (FR) - lbs
                                                            200       784 lbs
                                                                                          FR=166 lbs
                                                            150


                                                            100


                                                            50


                                                             0


                                                            -50
                                                              400   800            1200                1600
                                                                      Wsinlbs


           G.1.5.3      Calculate WS sin 5° where WS is either the average test weight, or the
                        lightest weight scheduled in the AFM, and define standard day rudder
                        force (FRs) as the intersection of this value of WS sin 5° and the curve from
                        step (2). For example:
                        𝐹𝑛𝑎𝑡 = 2600 𝑙𝑏𝑠                                         𝑉 = 1.13 𝑉𝑆𝑅                  𝑊𝑠 = 9000 𝑙𝑏𝑠

           G.1.5.4      Determine the maximum allowable asymmetric thrust from the
                        relationship:


                                                                          G-2

05/04/18                                                                                                     AC 25-7D
                                                                                                            Appendix G

                                                                                                      150
                                                                                 𝐹𝑛𝑎𝑚𝑎𝑥 = 𝐹𝑛𝑎𝑡 ⋅ (𝐹 )1
                                                                                                       𝑅𝑠


                               Assuming a 180 lb force limit:
                                                                                         180
                                                                        𝐹𝑛𝑎𝑚𝑎𝑥 = 2600 ⋅ (    ) = 2820 𝑙𝑏𝑠
                                                                                         166
               G.1.5.5         Plot the maximum scheduled AFM thrust versus airspeed (see figure G-2),
                               and determine VMCA at the intersection of this curve and Fnamax:


                                                Figure G-2. Plot to Determine VMCA


                                                3000


                                                            80.5 KEAS
                                                2950

                                                2900

                                                2850

                                   Fna - lbs.
                                                                                          2820 lbs
                                                2800

                                                2750

                                                2700

                                                2650

                                                2600
                                                       60     80           100      120   140        160

                                                                            Ve - kts.


G.1.6          If the force limited VMCA value is high enough to adversely impact the takeoff speed
               schedule, it can be reduced to an acceptable value by derating takeoff power or thrust.
               For example, if the standard day rudder force (FRs) was 140 lbs on an amendment 25-42
               airplane, the maximum allowable asymmetric takeoff thrust would be:
                                                              150
                               𝐹𝑛𝑎𝑚𝑎𝑥 = 2600 ⋅                    = 2686 𝑙𝑏𝑠
                                                              140


    180
1
    (      ) prior to amendment 25-42.
    𝐹 𝑅𝑠


                                                                            G-3

05/04/18                                                                                           AC 25-7D
                                                                                                  Appendix G

G.1.7      Using the same maximum asymmetric thrust available versus airspeed as before:


            Figure G-3. Plot to Determine VMCA for an Amendment 25-42 Airplane


                                  3000


                                                                           172 KEAS
                                  2950

                                  2900

                                  2850

                     Fna - lbs.   2800

                                  2750

                                  2700                   2686 lbs

                                  2650

                                  2600
                                         60   80   100   120   140    160             180   200

                                                         Ve - kts.


G.1.8      Because of the shallow thrust lapse rate with airspeed, the force limited VMCA for these
           conditions would be 172 knots, which is obviously unacceptable. To reduce this value
           back to 80 knots (or any other speed), takeoff thrust should be derated to a level that
           provides a maximum asymmetric thrust value of Fnamax at the desired VMCA (80 knots in
           this example). The amount of derate required can be determined from the following
           plot:


                                                                     G-4

05/04/18                                                                                           AC 25-7D
                                                                                                  Appendix G

                      Figure G-4. Plot to Determine VMCA for Derate Thrust


                                     3000

                                     2900        80 KEAS

                                     2800


                         Fna - lbs   2700                                         2686 lbs
                                                                                       Maximum
                                     2600                                               Thrust

                                     2500                                            Derated
                                                                                    Thrust (5%)
                                     2400
                                            50             100              150         200

                                                                 Ve - kts


G.1.9      For a given weight and bank angle, rudder pedal force is determined solely by
           asymmetric thrust; consequently, takeoff thrust should be limited to a value that results
           in a pedal force no greater than 150 lbs (180 lbs prior to amendment 25-42).


                                                                  G-5

05/04/18                                                                                 AC 25-7D
                                                                                        Appendix H