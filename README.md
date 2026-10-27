# RAWEST SIGNAL · v4.0.2

**Know your build. Know your next move.**

RAWEST SIGNAL is a beginner-friendly, local-first ECU datalog review app by RAWEST Performance. Upload a real log, understand what it shows, explore flagged moments, and investigate potential causes without needing a professional tuning interface.

**[Open the app](https://whiiskerz.github.io/pullsheet/)** · **[Help Center & Documentation](https://whiiskerz.github.io/pullsheet/docs/)** · **[Source code](https://github.com/whiiskerz/pullsheet)**

> **Safety:** This is a read-only screening and educational tool, not an ECU tuning or engine-health certification. Sensor mappings, wiring and calibrations must be verified before trusting readings.

## Start here

1. Export an actual datalog from your ECU logging software.
2. Open the app and choose **Analyze my log** to select the exported file.
3. Review the explanation, tap a moment in the event timeline and inspect RPM, throttle and mixture.
4. Open **Sensors** to resolve missing or conflicting channel mappings.
5. Use **SIGNAL Guide** to interpret logged evidence and review relevant reference notes.
6. Save a report to PDF with your browser's Print command.

**Supported log formats:** .MaxxECU-Zip-log, .MaxxECU-Log, .log, .zip, and .csv. MaxxECU is primary; Holley CSV is supported; some other CSV files require manual channel mapping. Genuine MTune .MaxxECU-save files go in Tune Studio instead of the log picker.

## New in 4.0.2

- **Auto-scroll after successful log import.** The browser moves to the plain-English findings automatically, without jumping during sensor remaps, unit toggles, or failed imports.
- **Notion-style docs hub.** Replaced the old long Help page with 15 Markdown-powered articles, grouped sidebar, mobile navigation, full-text search, page table of contents, copy-link control, page-to-page navigation and direct GitHub edit links.
- **Simple publishing.** To add a public article, create docs/pages/new-guide.md, then add its slug and metadata in docs/catalog.js. Changes deploy automatically through GitHub Pages.
- **Local-first operation stays unchanged.** This is a docs website, not a remote Notion workspace or real-time collaborative CMS. True Notion synchronization would require a connected integration or separate publishing pipeline.

## Previously in 4.0.1

- **Fixed Target AFR:** The graph no longer treats an empty channel array as a usable target.
- **Lambda by default:** It plots actual and target lambda from independent logged channels, especially useful for flex fuel.
- **Optional AFR:** The graph uses a matched logged AFR pair, or converts both lambda traces using *logged* stoichiometric AFR. It never assumes gasoline 14.7 on an unknown fuel blend.
- **Clear unavailable states:** The chart explains missing or insufficient fuel channels instead of silently producing a blank trace.
- **Help Center:** A searchable guide at [the docs website](https://whiiskerz.github.io/pullsheet/docs/).
- **Reference uploads:** In **SIGNAL Guide → My reference documents**, import text/Markdown/CSV/JSON files. The app can find matching excerpts, kept separate from logged measurements.

## Upload options

| What you want | Where to add it | Input |
|---|---|---|
| Analyze ECU sensor data | Analyze my log | Actual log or supported CSV |
| Inspect MaxxECU tune settings | Tune Studio | MTune .MaxxECU-save |
| Search reference text | SIGNAL Guide → My reference documents | .txt, .md, .markdown, .csv, .json |
| Publish public documentation | GitHub repo → docs directory | Public guides that you have permission to share |

**Reference library limits:** 10 files, 200 KB each and 500 KB total, stored only in the current browser.

**PDF limitation:** PDF parsing and OCR are not included. Export text from readable PDFs into .txt or .md before importing. Uploading a PDF as a log will not make it analyzable.

**Important distinction:** Text references are local search results, *not* machine learning, an LLM knowledge base, or verified ECU evidence.

## What v4 already supports

- Responsive beginner-first interface with Easy / Detailed views.
- Event timeline with recorded engine data and conservative safety flags.
- SIGNAL Guide, backed by deterministic log-based hypotheses.
- Channel setup assistant and manual mapping.
- Matched RPM/load before-and-after comparison with data-quality restrictions.
- My Garage build profiles saved to your device.
- Read-only MaxxECU calibration inspection.
- Branded reports, including print-to-PDF and standalone HTML export.
- Installable PWA with offline caching of core site assets.

## Privacy

Logs and local reference documents are processed in the browser. There is no account, cloud storage, remote file analysis, or automatic tuning service in this release. Saved browser data can be lost when site storage is cleared or you change devices; back up Garage data and exports.

**Do not commit private datalogs, VINs, passwords, personal data or copyrighted manuals into the public GitHub repository.** Public documentation can be contributed to the docs directory only when redistribution is permitted.

## Running and testing locally

The site is static HTML, CSS and JavaScript. Clone the repository and serve it over a local static server. Open index.html for the app or docs/index.html for the Markdown knowledge base.

With Node 22+ you can run: **node --test tests/*.test.js**

GitHub Actions verifies JavaScript syntax and behavior tests, and deploys through the Pages workflow.

## Your own website domain

You can use a domain you own with GitHub Pages via **Settings → Pages → Custom domain** and your DNS provider's CNAME/A records. Set the domain in GitHub first, configure DNS second, and turn on HTTPS when available.

[Official GitHub custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

A custom domain is just the branded address. Adding accounts, payment subscriptions, cloud document uploads or genuine backend AI would require additional infrastructure and privacy/security work.

---

Built by [@whiiskerzbuilt](https://instagram.com/whiiskerzbuilt) · RAWEST Performance.
