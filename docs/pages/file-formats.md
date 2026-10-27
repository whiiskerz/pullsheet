# Supported files and uploads

The website has three distinct ways to add information. **Choose the input based on the job**, not simply the extension.

## Datalogs for the Analyze tab

| Input | Notes |
| --- | --- |
| .MaxxECU-Zip-log | MaxxECU archive; may contain log and tune metadata |
| .MaxxECU-Log or .log | Recorded ECU log with actual sensor samples |
| .zip | Supported archive structure containing a compatible log |
| .csv | MaxxECU-style data or recognized Holley EFI exports; others may need mapping |

MaxxECU is the main supported workflow. Similar looking CSV files from other systems are not guaranteed to parse correctly.

## Tune files for Tune Studio

A genuine **.MaxxECU-save** file holds ECU calibration settings. It is not a datalog. Loading it does not provide engine measurements from a drive.

## Written references for SIGNAL Guide

In SIGNAL Guide, expand **My reference documents** and add **.txt, .md, .markdown, .csv or .json**. These become searchable **reference excerpts**, not sensor measurements.

PDF parsing is not implemented. Export readable PDF content to text first; scanned manuals need OCR outside the app.

## Import error?

If the file is empty, finish downloading it from cloud storage. If the parser says no RPM/runtime is found, verify you exported a log and not another file type.

Continue to [How to read a log](#/reading-your-log).