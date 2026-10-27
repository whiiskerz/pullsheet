# Lambda vs AFR

**Lambda is the recommended default fuel-mixture display for flex-fuel setups.** It expresses mixture relative to the stoichiometric point of the current fuel, so it avoids the confusion of switching AFR references as ethanol concentration changes.

## What do the numbers mean?

| Reading | Meaning |
| --- | --- |
| Lambda 1.00 | Stoichiometric for the current fuel, **not** a universal high-load target |
| Actual lambda above target | Measured reading is leaner than the ECU's commanded target, assuming valid sensors |
| Actual lambda below target | Measured reading is richer than the commanded target |
| AFR | Ratio of air to fuel expressed on a particular fuel or display basis |

## Why wasn't Target AFR appearing?

A MaxxECU log may record **Lambda target** without a literal Target AFR column. Previously a blank target array could appear as a working button.

SIGNAL now prefers separately logged actual/target lambda. For optional AFR display, it requires either a matching logged actual/target AFR pair **or** separately logged actual/target lambda plus the ECU's recorded stoichiometric AFR. It does not silently assume gasoline 14.7 for unknown or ethanol blends.

## The graph should always show both sides

Select **Lambda** or **AFR** near the graph. Read the on-screen source note when a mode is unavailable.

> Do not calculate tune adjustments from the displayed error alone. Fuel cut, sensor delay, transients, corrections, load and calibration can all affect the result.

See [Sensors and calibration](#/sensor-mapping).