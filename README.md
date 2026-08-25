# StarPilot (Personal Fork — Hyundai Ioniq Hybrid 2016 & Comma 4)

[![Last Updated](https://img.shields.io/github/last-commit/MarkenJaden/StarPilot-Hyundai-Ioniq-2016/StarPilot)](https://github.com/MarkenJaden/StarPilot-Hyundai-Ioniq-2016)
[![Custom Cloud](https://img.shields.io/badge/Drive-drive.markenjaden.de-38bdf8?logo=cloud)](https://drive.markenjaden.de)

> [!WARNING]
> ### ⚠️ Wichtiger Hinweis / Disclaimer
> Dies ist ein **primär persönlicher Fork** von StarPilot, der speziell auf meinen **Hyundai Ioniq Hybrid (2016)** und die Nutzung auf dem **Comma 4 (`mici`)** zugeschnitten ist.
> 
> * **Zukünftige Anpassungen:** Ich werde diesen Fork in Zukunft kontinuierlich weiterentwickeln und noch tiefgehender an mein spezifisches Fahrzeug anpassen.
> * **Experimenteller Status:** **Keine der hier implementierten experimentellen Funktionen wurde ausführlich, dauerhaft oder unter allen denkbaren Verkehrsbedingungen getestet.**
> * **Nutzung auf eigene Gefahr:** Die Nutzung dieser Software erfolgt ausschließlich auf eigenes Risiko und eigene Verantwortung.

---

## 🚀 Spezifische Features in diesem Fork

Zusätzlich zu den Standard-Features von StarPilot und FrogPilot beinhaltet dieser Fork folgende Eigenentwicklungen:

* 🚗 **Hyundai Ioniq Hybrid (2016) C-CAN Telemetrie & 6-Phasen-Energiemonitor:**
  * Echtzeit-Erfassung von Atkinson-Verbrennungsmotor, $32\text{ kW}$ E-Motor, Rekuperation, Schubabschaltung und DCT-Getriebe.
  * 3-Stufen-Berichte: Einzelfahrten beim Parken, automatische Volltankerfassung (Tank-zu-Tank via Tacho-CAN `CLU13`) und unbegrenzte eigene Trips in Galaxy.
* ⚡ **Ultra-Fast Boot & Persistentes GPU-Kernel-Caching:**
  * Reduziert die Startzeit auf dem Comma 4 auf $<4\text{ Sekunden}$ durch persistentes Tinygrad OpenCL/Adreno JIT-Shader-Caching (`/data/tinygrad_cache/`), Python-Bytecode-Caching (`/data/pycache`) und I/O-optimierten Param-Sync.
* 🎯 **Vordermann-Radar Geschwindigkeits-Tracker:**
  * Live-Berechnung der absoluten Geschwindigkeit des vorausfahrenden Fahrzeugs in km/h ($v_{\text{lead}} = (v_{\text{ego}} + v_{\text{rel}}) \cdot 3{,}6$) mit eigenem Toggle-Switch im Galaxy Live-Monitor.
* 💡 **Automatisches Fernlicht via Vision & Radar (Auto High-Beam Assist):**
  * Erkennt Gegenverkehr und vorausfahrende Fahrzeuge per Kamera und Radar und schaltet Fernlicht über Hyundai `LKAS11` CAN-Nachrichten automatisch ab/an.
  * Vollständiger manueller Fahrer-Override über den Blinkerhebel / Lichtschalter.
* 🛣️ **Automatischer Rettungsgassen- & Autobahn-Spurversatz:**
  * Erkennt mehrspurige Autobahnen anhand der Spurwahrscheinlichkeiten von `modelV2`: Linke Spur versetzt nach links ($-0{,}25\text{ m}$), rechte/mittlere Spuren versetzen nach rechts ($+0{,}25\text{ m}$).
  * **Autobahn-Gating:** Bleibt auf Landstraßen (1 Spur pro Richtung) und in Städten exakt mittig zentriert.
* 🔧 **OBD-II / UDS Fahrzeugdiagnose & Fehlercode-Scanner:**
  * Tiefenscan aller 4 Steuergeräte (Motor 0x7E0, 6-Gang-DCT 0x7E1, Hybrid-BMS 0x7E2, ABS/ESP 0x7D1).
  * Deutsche Klartext-Diagnose und 1-Klick-Löschfunktion für den Fehlerspeicher direkt in Galaxy (`/dtc_scanner`).
* 🌐 **Eigene Cloud-Anbindung:**
  * Vollständige Anbindung an die eigene Web-Plattform [`drive.markenjaden.de`](https://drive.markenjaden.de).

---

## Über StarPilot

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
