# StarPilot (Personal Fork — Hyundai Ioniq Hybrid 2016 & Comma 4)

[![Last Updated](https://img.shields.io/github/last-commit/MarkenJaden/StarPilot-Hyundai-Ioniq-2016/StarPilot)](https://github.com/MarkenJaden/StarPilot-Hyundai-Ioniq-2016)
[![Custom Cloud](https://img.shields.io/badge/Drive-drive.markenjaden.de-38bdf8?logo=cloud)](https://drive.markenjaden.de)

> [!WARNING]
> ### ⚠️ Important Disclaimer & Notice
> This repository is **primarily a personal fork** of StarPilot tailored specifically for a **Hyundai Ioniq Hybrid (2016)** running on a **comma 4 (`mici`)**.
> 
> * **Vehicle-Specific Adaptations:** This fork is actively maintained and adapted to this specific vehicle setup, with further deep CAN and powertrain modifications planned for the future.
> * **Experimental State:** **None of the custom/experimental features implemented here have undergone extensive, exhaustive, or formal fleet testing across all possible driving conditions.**
> * **Use at Your Own Risk:** This software is provided as-is without any warranties. Use entirely at your own risk and responsibility.

---

## 🚀 Fork-Specific Features & Enhancements

In addition to standard openpilot, FrogPilot, and StarPilot features, this fork introduces the following custom developments:

* 🚗 **Hyundai Ioniq Hybrid (2016) C-CAN Telemetry & 6-Phase Energy Tracking:**
  * Real-time classification of Atkinson ICE, $32\text{ kW}$ electric motor, regenerative braking, fuel cut-off, and 6-speed DCT states.
  * 3-tier reporting: Automatic single drive reports upon parking, automated tank-to-tank refuel cycle detection via instrument cluster CAN (`CLU13`), and unlimited custom trips in Galaxy.
* ⚡ **Ultra-Fast Boot & Persistent GPU Kernel Caching:**
  * Cold boot times on comma 4 reduced to $<4\text{ seconds}$ via persistent Tinygrad OpenCL/Adreno JIT shader caching (`/data/tinygrad_cache/`), Python bytecode pre-caching (`/data/pycache`), and I/O-optimized parameter synchronization.
* 🎯 **Radar Lead Vehicle Speed Tracker:**
  * Real-time absolute velocity calculation ($v_{\text{lead}} = (v_{\text{ego}} + v_{\text{rel}}) \cdot 3.6\text{ km/h}$) with an interactive toggle switch in Galaxy's Live Monitor.
* 💡 **Vision & Radar Auto High-Beam Assist (HBA):**
  * Detects oncoming headlights and leading taillights via vision and radar, actively switching high beams through Hyundai `LKAS11` CAN messages.
  * Includes configurable speed thresholds and immediate manual stalk/switch override.
* 🛣️ **Automatic Emergency Corridor (Rettungsgasse) & Highway Lane Bias:**
  * Classifies multi-lane highways via `modelV2` lane probabilities: Leftmost lane biases to the left ($-0.25\text{ m}$), rightmost/middle lanes bias to the right ($+0.25\text{ m}$).
  * **Strict Highway Gating:** Confirmed single-carriageway rural roads (Landstraßen) and urban streets remain strictly lane-centered.
* 🔧 **OBD-II / UDS Diagnostic Trouble Code (DTC) Scanner:**
  * Deep-scan diagnostics across 4 primary ECUs (Engine `0x7E0`, 6-speed DCT `0x7E1`, Hybrid BMS `0x7E2`, ABS/ESP `0x7D1`).
  * Plain-text fault code lookup and 1-click DTC clearing in Galaxy (`/dtc_scanner`).
* 🌐 **Custom Cloud Integration:**
  * Full integration with personal Drive web platform instance at [`drive.markenjaden.de`](https://drive.markenjaden.de).

---

## About StarPilot

**StarPilot** is a custom fork of [comma.ai's openpilot](https://comma.ai/openpilot),
an open source driver assistance system.

Openpilot provides
* Automated Lane Centering
* Adaptive Cruise Control
* Lane Change Assist
* Driver Monitoring *without wheel nags*

StarPilot was formerly a GM targeted fork,
but [has expanded to offer Quality-Of-Life improvements for all](#features)!

StarPilot is built off of [FrogPilot](https://github.com/FrogAi/FrogPilot)
and supports the major features FrogPilot offers.

StarPilot has a vibrant, welcoming community [discord](https://firestar.link/discord).
Stop by to chat or ask questions!

## Documentation

Please see [https://wiki.firestar.link](https://wiki.firestar.link) for hardware lists,
installation guides, and software configuration.

## Features

* Full support for Comma C3, C3X, and C4
* Model switcher with all of comma's tinygrad driving models
* Special longitudinal planner tuning for VoACC (visual only, radar-less) vehicles
* Custom-tuned torque controllers for an expanding list of cars.
* Galaxy: StarPilot's portal to configure your comma device using your phone from anywhere.
Download models, change settings, update software, visualize live model outputs for tuning.
* Always On Lateral (full time steering assist)*
* Speed Limit Controller*
* Learning Curve Speed Controller*
* Conditional Experimental Mode (CEM)*
* Driving Profiles*
* Custom themes*
* Alert Volume Controller*
* Comma Pedal Interceptor support*
* Toyota SDSU support*
* ZSS support*
* High quality dashcam recordings*
* Enhanced tuning for CEM (dynamic experimental mode switching)
* And more!

\* [Inherited from FrogPilot](https://github.com/FrogAi/FrogPilot#openpilot-vs-frogpilot)

## GM-only Features

* Increased LKAS fault resiliency
* ASCM_INT and SASCM support
* Custom lateral torque controller, with special tuning for Bolts
* 50% extra torque on 2017 Chevy Bolt
* Improved lateral and longitudinal tuning
* Dashboard cruise control display speed spoofing for vehicles with pedal interceptor
* Extra steering wheel button functionality for vehicles with pedal interceptor
* Optional toggle to boot comma when remote starting your vehicle

## Developer Features

* Native and cross compilation for Windows, Mac, and Ubuntu
* Custom AGNOS to support C3, C3X, and C4
* To run UI on PC:
  * `./c3` for large UI
  * `./c4` for small UI
* `./build` to produce cross compiled binaries for comma devices.
Uses your comma's sysroot/toolchain
* Toggle: "Use Precompiled Binaries" to allow switching between fast boot / editable builds
* Custom long maneuver tests, specifically designed for regen-only vehicles

## Third-Party Notices
* Portions of this software include modified versions of the Material Design Icons provided by Google under the Apache License 2.0. A copy of the license is included in the `LICENSE-MDI` file.
