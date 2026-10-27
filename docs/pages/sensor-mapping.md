# Sensors and calibration

A column name tells SIGNAL what a number **might represent**. It does not prove the physical sender, calibration, wiring or units are correct.

## Fix a missing signal

1. Import the log.
2. Go to **Sensors**.
3. Review any unique header suggestion. The app asks for confirmation before choosing a channel.
4. If no clear suggestion exists, open the full channel settings and compare the exported header against your real ECU configuration.
5. Re-run analysis with your corrected map.

## Common channels

| Channel | What you need to verify |
| --- | --- |
| RPM | Engine speed signal and actual logged coverage |
| TPS | Real throttle-position semantics |
| Lambda | Measured wideband value, not the target |
| Target lambda | Separate ECU-commanded channel |
| Fuel pressure | Original units, sensor location, sender calibration and regulator reference |
| Oil pressure | Source scaling and whether reading is plausible for conditions |
| MAP | Absolute versus gauge units and correct channel |
| Runtime | Trustworthy timebase when timing events |

## Mapping collisions

Never use the same source column for both actual and target mixture. SIGNAL blocks or qualifies certain conclusions when a collision is detected.

A pressure conversion into PSI is not proof the physical sender is calibrated.

Related: [Understanding warnings](#/safety-alerts) · [Troubleshooting](#/troubleshooting).