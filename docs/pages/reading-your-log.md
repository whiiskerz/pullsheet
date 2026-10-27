# How to read your log

ECU logs are recordings over time. SIGNAL does not know every modification, operating condition or sensor calibration from a log alone.

## 1. The overview

The first results explain what was measured and what deserves review. A missing reading is **not** an automatic pass.

## 2. The problem timeline

**Moments** lists detected events with a recorded sample range. Select one to inspect the engine speed, throttle, mixture and other available traces around it.

Priority is a **review order**, not a diagnosis. A high-priority warning does not automatically identify the failed component.

## 3. Actual versus commanded readings

A target is what the ECU requested. An actual reading is what a sensor reported. Compare the two using a matching fuel basis, verified sensor channels and the correct operating context.

The fueling graph defaults to **Lambda: actual and target** when both independent channels exist. AFR is optional when it can be supported by matching logged sources.

## 4. Time, units and quality

The analyzer checks whether it has a usable timebase. Without verified time, sample count is not a trustworthy duration. Pressure units and calibration need independent confirmation.

## 5. Your next move

Review the event's evidence, check channel mapping and consult the real ECU configuration. Do not make automatic fuel or ignition adjustments from a single flag.

Related: [Warnings and confidence](#/safety-alerts) · [Sensors and calibration](#/sensor-mapping).