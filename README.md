# RAWEST SIGNAL · v4.0.0

RAWEST Performance local-first MaxxECU log analyzer that runs entirely in your browser. Drop in a log file and get WOT pull breakdowns, health checks, and channel traces back instantly.

**GitHub Pages (after enabling Pages):** https://whiiskerz.github.io/pullsheet/\n\n**Hosting:** GitHub Pages via `.github/workflows/pages.yml`. Under repository **Settings → Pages**, select **GitHub Actions** as the build and deployment source. Then run the workflow or push to `main`. The former Netlify URL is legacy and can be disconnected after Pages is confirmed live.\n\n**Versioning:** `MAJOR.MINOR.PATCH`. The displayed app version, PWA manifest and service-worker cache are updated together for releases.

## RAWEST SIGNAL 4.0 — beginner-first, evidence-first

- **Interactive event timeline:** Real log events are organized by priority; select one to view recorded RPM, throttle, lambda and correctly scaled pressure when available. Sparkline charts identify row position without inventing timestamps.
- **SIGNAL Guide:** Deterministic, offline questions grounded in actual recorded events and Diagnostic Brain hypotheses. Not a cloud AI chatbot; never prescribes a calibration change.
- **Onboarding:** A simple getting-started path teaches exporting, importing and reading a real log, with no fictional engine measurements.
- **Sensor setup assistant:** Offers only unique, recognizable header-name suggestions; explicit user confirmation is required. Selecting a header never verifies sensor scaling or units.
- **Before/after:** A simpler wrapper around existing matched RPM/MAP bin comparisons; incomplete samples or incompatible ethanol are clearly called out.
- **My Garage:** Quick access to local saved build profiles and their log-linked screening.
- **Premium reports:** Branded, printable review and downloadable standalone HTML, ready for print-to-PDF. Includes warnings and evidence limitations.
- **Mobile/offline:** Touch-friendly cards, focus styles, reduced-motion support and updated service-worker shell.

**Important:** Browser-based, local and read-only; cannot flash ECUs, independently verify physical sensors, certify safe engine operation, or prove causality. Workflows use real imports and the existing diagnostics engine.

## Beginner-first experience (v3.3.0)

- **Start here:** Choose **Check my engine**, **Understand my tune**, or **Track my build**; every option opens the existing functional workflow.
- **Easy / Detailed:** Toggle the level of explanation without losing access to any underlying analysis.
- **Real-log companion:** After an actual log is processed, a simple review highlights available checks, flags channel-mapping gaps and gives the next steps. It never substitutes mock data or labels a tune safe.
- **Learn the language:** Built-in interactive help for datalog, AFR, lambda, RPM, TPS, fuel pressure, knock and MAP/boost.
- **Visual refresh:** Improved contrast, hierarchy, touch targets and responsive mobile/desktop layouts.
- **Safety stays first:** Local parsing, verified units, visible unknowns, and no ECU writing or automatic tune prescriptions.

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
