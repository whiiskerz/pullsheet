# Compare two logs

SIGNAL can compare supported operating regions between a baseline and a newer log.

## How it works

1. Load a real baseline log.
2. Open **Compare** and save the current log as a baseline on your device.
3. Import a second log recorded in comparable conditions.
4. Examine only overlapping, sufficiently sampled RPM/MAP areas.

## What the result means

A region with a smaller measured-versus-target lambda difference is **closer to target in those recorded samples**. It does not prove the tune or modification caused that change.

Different temperatures, trims, timebases, load, transient states or ethanol content can make a comparison misleading. SIGNAL flags missing/insufficient evidence and large ethanol differences.

## When you get no comparison

That is expected when the logs contain no adequately overlapping operating cells, when relevant channels are absent, or when the same file is used twice.

See [Lambda vs AFR](#/lambda-afr) · [Privacy](#/privacy).