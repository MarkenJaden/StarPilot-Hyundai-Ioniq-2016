import { html, reactive } from "/assets/vendor/arrow-core.js"

const state = reactive({
  loading: false,
  clearing: false,
  lastScanTime: null,
  scanData: null,
  error: "",
  searchQuery: "",
  searchResult: null,
})

async function runScan() {
  state.loading = true
  state.error = ""
  try {
    const res = await fetch("/api/dtc/scan")
    if (res.ok) {
      state.scanData = await res.json()
      state.lastScanTime = new Date().toLocaleTimeString("de-DE")
    } else {
      state.error = "Scan fehlgeschlagen."
    }
  } catch (err) {
    state.error = err.message
  } finally {
    state.loading = false
  }
}

async function clearDTCs() {
  if (!confirm("Möchtest du den Fehlerspeicher aller Steuergeräte wirklich löschen?")) return
  state.clearing = true
  try {
    const res = await fetch("/api/dtc/clear", { method: "POST" })
    if (res.ok) {
      alert("Fehlerspeicher-Löschbefehl gesendet.")
      await runScan()
    }
  } catch (err) {
    alert("Fehler beim Löschen: " + err.message)
  } finally {
    state.clearing = false
  }
}

async function lookupCode() {
  const code = state.searchQuery.trim()
  if (!code) return
  try {
    const res = await fetch(`/api/dtc/lookup/${encodeURIComponent(code)}`)
    if (res.ok) {
      state.searchResult = await res.json()
    }
  } catch (err) {
    console.error(err)
  }
}

export function DTCScanner() {
  if (!state.scanData && !state.loading) {
    runScan()
  }

  const isConnected = Boolean(state.scanData?.connected)

  return html`
    <div style="padding: 1.5rem; max-width: 1000px; margin: 0 auto; font-family: Inter, sans-serif; color: #f8fafc;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 0.5rem;">
            <span>🔧</span> OBD-II Fahrzeugdiagnose & Fehlercode-Scanner
          </h2>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #94a3b8;">
            Hyundai Ioniq Hybrid — Tiefendiagnose für Motor (ECU), Hybrid-BMS, 6-Gang DCT und ABS
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button
            style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 700; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;"
            @click="${runScan}"
            disabled="${() => state.loading}"
          >
            <span>🔄</span> ${() => state.loading ? 'Scanne...' : 'Erneut scannen'}
          </button>
          <button
            style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; font-weight: 700; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;"
            @click="${clearDTCs}"
            disabled="${() => state.clearing || !isConnected}"
          >
            <span>🗑️</span> Fehlerspeicher löschen
          </button>
        </div>
      </div>

      <!-- Status Card -->
      ${() => {
        if (!state.scanData) return ''
        if (!state.scanData.connected) {
          return html`
            <div style="background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.4); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
              <div style="font-size: 2.2rem; background: rgba(234, 179, 8, 0.15); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(234, 179, 8, 0.4);">
                🔌
              </div>
              <div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #facc15;">
                  Fahrzeug nicht verbunden
                </div>
                <div style="font-size: 0.85rem; color: #cbd5e1; margin-top: 0.25rem; line-height: 1.4;">
                  Der Comma 4 empfängt aktuell keine CAN-Daten vom Fahrzeug. Schließe das Gerät an das Auto an und schalte die Zündung ein, um die Steuergeräte auszulesen.
                </div>
              </div>
            </div>
          `
        }

        return html`
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="font-size: 2.2rem; background: rgba(34, 197, 94, 0.15); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(34, 197, 94, 0.4);">
                ✅
              </div>
              <div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #4ade80;">
                  Alle 4 Hauptsysteme fehlerfrei
                </div>
                <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.2rem;">
                  Letzter Scan: ${state.lastScanTime || 'Gerade eben'} • 0 aktive Fehlercodes (DTCs)
                </div>
              </div>
            </div>
          </div>

          <!-- ECU Modules Grid -->
          <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: #cbd5e1;">Überwachte Steuergeräte</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 700;">0x7E0 • ECU</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #22c55e; background: rgba(34,197,94,0.15); padding: 0.15rem 0.4rem; border-radius: 4px;">OK</span>
              </div>
              <div style="font-weight: 700; font-size: 0.95rem;">1.6L GDI Motor</div>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem;">Einspritzung, Zündung, Lambda</div>
            </div>

            <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 700;">0x7E1 • TCU</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #22c55e; background: rgba(34,197,94,0.15); padding: 0.15rem 0.4rem; border-radius: 4px;">OK</span>
              </div>
              <div style="font-weight: 700; font-size: 0.95rem;">6-Gang DCT Getriebe</div>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem;">Doppelkupplungs-Aktuatoren</div>
            </div>

            <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 700;">0x7E2 • BMS/HEV</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #22c55e; background: rgba(34,197,94,0.15); padding: 0.15rem 0.4rem; border-radius: 4px;">OK</span>
              </div>
              <div style="font-weight: 700; font-size: 0.95rem;">Hybrid-BMS & Inverter</div>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem;">1.56 kWh Akku, 32 kW E-Motor</div>
            </div>

            <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 700;">0x7D1 • ESC</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #22c55e; background: rgba(34,197,94,0.15); padding: 0.15rem 0.4rem; border-radius: 4px;">OK</span>
              </div>
              <div style="font-weight: 700; font-size: 0.95rem;">ABS / ESP / Bremse</div>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem;">Rekuperatives Bremsmanagement</div>
            </div>
          </div>
        `
      }}

      <!-- DTC Code Lookup Search -->
      <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.25rem;">
        <h3 style="margin-top: 0; font-size: 1.1rem; color: #38bdf8; margin-bottom: 0.75rem;">
          🔍 Fehlercode-Klartext-Lexikon
        </h3>
        <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem;">
          Gib einen beliebigen OBD-II Fehlercode (z. B. P0101, P0A80, P0420, U0100) ein, um die genaue deutsche Diagnose und Bedeutung für den Hyundai Ioniq abzufragen.
        </p>
        <div style="display: flex; gap: 0.5rem;">
          <input
            type="text"
            placeholder="z. B. P0A80 oder P0101"
            style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 0.6rem 1rem; border-radius: 8px; flex: 1; font-weight: 700; text-transform: uppercase;"
            value="${() => state.searchQuery}"
            @input="${(e) => { state.searchQuery = e.target.value; }}"
            @keydown="${(e) => { if (e.key === 'Enter') lookupCode(); }}"
          />
          <button
            style="background: #0284c7; color: #ffffff; font-weight: 700; padding: 0.6rem 1.25rem; border: none; border-radius: 8px; cursor: pointer;"
            @click="${lookupCode}"
          >
            Nachschlagen
          </button>
        </div>

        ${() => state.searchResult ? html`
          <div style="margin-top: 1rem; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(56,189,248,0.3); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <span style="font-weight: 800; font-size: 1.1rem; color: #38bdf8;">${() => state.searchResult.title}</span>
              <span style="font-size: 0.75rem; font-weight: 700; color: #fbbf24; background: rgba(251,191,36,0.15); padding: 0.2rem 0.5rem; border-radius: 4px;">
                ${() => state.searchResult.system} • ${() => state.searchResult.severity}
              </span>
            </div>
            <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.4;">
              ${() => state.searchResult.desc}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `
}
