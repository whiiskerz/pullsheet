# Troubleshooting

## I added a log and nothing happened

Confirm the file is not empty or still waiting for a cloud download. Import a compatible recorded ECU log, not an unrelated archive or a tune-only file. A successful new import scrolls to the results automatically.

## Target AFR toggle shows unavailable

Your log may have **Lambda target** but no Target AFR. Use Lambda mode with independent actual/target channels. AFR requires a matching logged pair or logged stoichiometric AFR for both conversions.

## Sensor reading looks impossible

Check the sensor's source column, units, physical sender calibration and wiring in actual ECU software. A selected header is only a mapping.

## Chart is empty

Confirm a real log and its necessary runtime/RPM fields were parsed. Some analysis needs verified time, MAP, TPS and independent wideband channels. Blank or untrusted values are not drawn as fabricated traces.

## The app looks outdated

Refresh while online and reopen the installed app. The service worker caches assets for offline use. **Do not clear site storage before backing up** browser-only Garage and references.

## I can't see reference docs on my other phone

They are intentionally stored on the current device/browser. Remote accounts and sync have not been added.

## Other questions

See [Supported files](#/file-formats) or [Privacy and limitations](#/privacy).