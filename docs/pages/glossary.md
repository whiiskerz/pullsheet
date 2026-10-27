# Tuning language explained

A few common terms you may see in RAWEST SIGNAL and ECU software.

| Term | Beginner meaning |
| --- | --- |
| Datalog | A recording of sensor readings from an ECU over time |
| ECU | The engine computer |
| RPM | Engine revolutions per minute |
| TPS | Throttle position as reported by the ECU |
| MAP | Manifold absolute pressure; **not** the same as gauge boost |
| Lambda | Fuel mixture relative to stoichiometric for the current fuel |
| Target lambda | Mixture requested by the ECU |
| AFR | Air-to-fuel ratio expressed on a specified reference basis |
| Stoichiometric AFR | The chemically stoichiometric ratio for the fuel/reference basis |
| WOT | Wide-open throttle, subject to logged throttle-channel meaning |
| Closed loop | Feedback control based on sensors, only if enabled and active |
| Fuel trim | An adjustment/correction indicator; frozen trims can still be logged |
| Knock indication | An ECU signal requiring contextual review; not standalone detonation proof |
| IAT | Intake-air temperature |
| CLT | Coolant temperature |
| Timebase | The logged time reference required to infer event duration |

## One useful rule

**Measured** means the channel reports a value. **Verified** means its identity, units and interpretation have been independently checked. Those are not the same thing.

Continue to [How to read a log](#/reading-your-log).