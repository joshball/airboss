4.8     Conditional Steps. In many procedures, some steps should be executed only when
        specified conditions occur. These conditional statements are a frequent source of
        confusion, particularly for novices, or with rarely used procedures. This problem can be
        alleviated by keeping the statements well structured, clearly phrased, and as short as
        possible.

        Conditional statements should present all of the conditions clearly so that the correct
        choice is easy to identify. The steps that are associated with each condition should be
        grouped clearly. The end of this block of steps should be clearly identified and the action
        or procedure to be performed after completion of the block should be clearly specified. If
        there are embedded choices, then these subsidiary conditions also should be clearly
        delineated and the associated steps grouped in an unambiguous fashion.

        Conditions should always precede actions. Actions that are irreversible should be
        identified in the condition preceding the action. Conditional statements may begin with
        one of the following words:

        1. IF – use to indicate a condition that may or may not happen.
        2. WHEN – use to indicate a condition that must be met before an action is taken
           and that condition is very likely to occur (e.g., “WHEN pressure reaches
           120 psi THEN put gear down.”).
        3. THEN – use to identify actions that should be taken when the specified
           condition occurs.
        4. AND – use to combine two conditions that must be met before the action is
           taken.
        5. OR – use to indicate that one or more of several conditions must be met
           before the action is taken.


                                                4-4

1/10/17                                                                                 AC 120-71B


        If alternative formats are used, ensure they are used consistently and the intention is clear.
        For example:

                       IF light x is lit
                               THEN open valve y
                       IF light x is NOT lit
                               THEN open valve z

        Which also may be expressed as:

                       CHOOSE one:
                           Light x is illuminated
                                   ● Open valve y
                           Light x is extinguished
                                   ● Open valve z

4.8.1   Complex Conditional Statements. Avoid using combinations of AND and OR whenever
        possible. In general, use separate steps instead.

4.8.2   Waiting, Continuous Actions, Repeated Actions. In some cases, an action must be
        continued or repeated until some condition occurs. In these cases, specify (1) what
        actions are to be repeated, (2) the conditions under which those actions should be
        stopped, and (3) whether the remaining steps in the procedure can be continued in the
        meantime. For example: “Hold button depressed UNTIL pressure reaches 120 psi, THEN
        GO TO step 5 in this procedure.”