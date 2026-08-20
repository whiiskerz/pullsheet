# PULLSHEET

MaxxECU log analyzer that runs entirely in your browser. Drop in a log file and get WOT pull breakdowns, health checks, and channel traces back instantly.

**Live app:** https://pullsheet-app.netlify.app

## What it does

- Reads `.MaxxECU-Zip-log`, `.MaxxECU-Log`, `.log`, `.zip`, and plain `.csv` exports (Holley EFI, Haltech, AEM, Link, and similar loggers work too — map channels by hand in I/O Config if auto-detect misses one)
- Parses RPM, TPS, MAP/boost, ignition timing, knock retard, coolant/oil/trans temps, fuel pressure, AFR vs target, battery voltage, VSS, and gear
- Estimates 0-60 and eighth-mile times per WOT pull from the actual VSS trace, no assumed drivetrain constants
- Flags likely issues with a weighted health score and plain-language reasons
- Compares two logs side by side (before/after a tune change, part swap, etc.)
- Tracks history across multiple vehicles
- Exports a report via the native share sheet, print-to-PDF, or a saved chart image
- Works offline once loaded (installable as a home-screen app on iOS/Android)

## Privacy

Nothing is uploaded anywhere. Log files are parsed and rendered entirely in your browser — there's no server-side component and no analytics.

## Running locally

It's a static site with no build step. Clone the repo and open `index.html`, or serve the folder with any static file server.

---

Built by @whiiskerzbuilt.
