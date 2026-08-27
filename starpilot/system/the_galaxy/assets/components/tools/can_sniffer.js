import { html, reactive } from "/assets/vendor/arrow-core.js"

const state = reactive({
  recording: false,
  selectedPreset: "Mode-Taste",
  customLabel: "",
  elapsedSeconds: 0,
  frameCount: 0,
  recordings: [],
  selectedRecording: null,
  loading: false,
  error: "",
  activeTab: "record",
})

let timerInterval = null

async function updateStatus() {
  try {
    const res = await fetch("/api/can_sniffer/status")
    if (res.ok) {
      const data = await res.json()
      state.recording = data.recording
      state.elapsedSeconds = data.elapsed_seconds
      state.frameCount = data.frame_count
      if (state.recording && !timerInterval) {
        timerInterval = setInterval(updateStatus, 500)
      } else if (!state.recording && timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    }
  } catch (err) {
    console.error(err)
  }
}

async function startRecording() {
  state.error = ""
  const label = state.selectedPreset === "Custom" ? (state.customLabel.trim() || "Eigener Button") : state.selectedPreset
  try {
    state.loading = true
    const res = await fetch("/api/can_sniffer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label })
    })
    if (res.ok) {
      state.recording = true
      state.elapsedSeconds = 0
      state.frameCount = 0
      timerInterval = setInterval(updateStatus, 500)
    } else {
      state.error = "Konnte Aufnahme nicht starten."
    }
  } catch (err) {
    state.error = err.message
  } finally {
    state.loading = false
  }
}

async function stopRecording() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  state.loading = true
  try {
    const res = await fetch("/api/can_sniffer/stop", { method: "POST" })
    if (res.ok) {
      const result = await res.json()
      state.recording = false
      state.selectedRecording = result
      state.activeTab = "detail"
      await fetchRecordings()
    } else {
      state.error = "Fehler beim Stoppen der Aufnahme."
    }
  } catch (err) {
    state.error = err.message
  } finally {
    state.loading = false
  }
}

async function fetchRecordings() {
  try {
    const res = await fetch("/api/can_sniffer/recordings")
    if (res.ok) {
      state.recordings = await res.json()
    }
  } catch (err) {
    console.error(err)
  }
}

async function viewRecording(recId) {
  state.loading = true
  try {
    const res = await fetch(`/api/can_sniffer/recording/${encodeURIComponent(recId)}`)
    if (res.ok) {
      state.selectedRecording = await res.json()
      state.activeTab = "detail"
    }
  } catch (err) {
    alert("Fehler beim Laden: " + err.message)
  } finally {
    state.loading = false
  }
}

async function deleteRecording(recId) {
  if (!confirm("Möchtest du diese Aufnahme wirklich löschen?")) return
  try {
    const res = await fetch(`/api/can_sniffer/recording/${encodeURIComponent(recId)}`, { method: "DELETE" })
    if (res.ok) {
      if (state.selectedRecording && state.selectedRecording.id === recId) {
        state.selectedRecording = null
        state.activeTab = "history"
      }
      await fetchRecordings()
    }
  } catch (err) {
    alert("Fehler beim Löschen: " + err.message)
  }
}

export function CANSniffer() {
  updateStatus()
  fetchRecordings()

  const presets = [
    { name: "Mode-Taste", icon: "🎵", desc: "Audio / Mode Umschaltung" },
    { name: "Stern-Taste", icon: "⭐", desc: "Favoriten / Custom Taste" },
    { name: "LKAS / LFA", icon: "🛣️", desc: "Spurhalteassistent Taste" },
    { name: "Sprachsteuerung", icon: "🗣️", desc: "Voice Assistant Taste" },
    { name: "Mute-Taste", icon: "🔇", desc: "Audio Stummschalten" },
    { name: "Cancel-Taste", icon: "❌", desc: "Tempomat Cancel" },
    { name: "Custom", icon: "✏️", desc: "Eigener Name" },
  ]

  return html`
    <div style="padding: 1.5rem; max-width: 1050px; margin: 0 auto; font-family: Inter, sans-serif; color: #f8fafc;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 0.5rem;">
            <span>📡</span> CAN Tasten-Recorder & Sniffer
          </h2>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #94a3b8;">
            Hyundai Ioniq 2016 — Zeichne CAN-Bus-Signale direkt beim Drücken von Lenkradtasten auf und analysiere Bit-Deltas
          </p>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <button
            style="background: ${() => state.activeTab === 'record' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)'}; border: 1px solid ${() => state.activeTab === 'record' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; color: #f8fafc; font-weight: 700; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;"
            @click="${() => { state.activeTab = 'record'; }}"
          >
            🔴 Aufnahme
          </button>
          <button
            style="background: ${() => state.activeTab === 'history' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)'}; border: 1px solid ${() => state.activeTab === 'history' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; color: #f8fafc; font-weight: 700; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;"
            @click="${() => { state.activeTab = 'history'; fetchRecordings(); }}"
          >
            📁 Gespeicherte (${() => state.recordings.length})
          </button>
        </div>
      </div>

      ${() => state.error ? html`
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
          ⚠️ ${() => state.error}
        </div>
      ` : ''}

      <!-- TAB: RECORD -->
      ${() => state.activeTab === 'record' ? html`
        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
          
          <h3 style="margin-top: 0; font-size: 1.1rem; color: #cbd5e1; margin-bottom: 1rem;">1. Wähle die Taste aus, die du aufzeichnen möchtest:</h3>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">
            ${presets.map(p => html`
              <div
                style="background: ${() => state.selectedPreset === p.name ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.7)'}; border: 2px solid ${() => state.selectedPreset === p.name ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; border-radius: 10px; padding: 0.85rem; cursor: pointer; transition: all 0.2s;"
                @click="${() => { if (!state.recording) state.selectedPreset = p.name; }}"
              >
                <div style="font-size: 1.4rem; margin-bottom: 0.25rem;">${p.icon}</div>
                <div style="font-weight: 700; font-size: 0.95rem; color: ${() => state.selectedPreset === p.name ? '#38bdf8' : '#f8fafc'};">${p.name}</div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.2rem;">${p.desc}</div>
              </div>
            `)}
          </div>

          ${() => state.selectedPreset === 'Custom' ? html`
            <div style="margin-bottom: 1.5rem;">
              <input
                type="text"
                placeholder="Eigener Tasten-Name (z.B. Tempomat Res+)"
                style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(56,189,248,0.4); color: #fff; padding: 0.6rem 1rem; border-radius: 8px; width: 100%; box-sizing: border-box; font-weight: 600;"
                value="${() => state.customLabel}"
                @input="${(e) => { state.customLabel = e.target.value; }}"
              />
            </div>
          ` : ''}

          <h3 style="font-size: 1.1rem; color: #cbd5e1; margin-bottom: 1rem;">2. Aufnahme starten & Taste drücken:</h3>
          
          <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.2rem; margin-bottom: 1.5rem;">
            <div style="font-size: 0.9rem; color: #94a3b8; line-height: 1.5;">
              💡 <b>So geht's am besten:</b><br>
              1. Klicke unten auf <b>"Aufnahme starten"</b>.<br>
              2. Drücke und halte die Taste am Lenkrad <b>3 bis 5 Mal hintereinander</b> (jeweils ca. 1 Sekunde halten und wieder loslassen).<br>
              3. Klicke auf <b>"Aufnahme stoppen & analysieren"</b>. Das System filtert automatisch alle unbeteiligten CAN-Signale heraus.
            </div>
          </div>

          <!-- Action Button & Live Status -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1rem 0;">
            ${() => !state.recording ? html`
              <button
                style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; font-size: 1.1rem; font-weight: 800; padding: 0.9rem 2.5rem; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 16px rgba(2,132,199,0.4); display: flex; align-items: center; gap: 0.6rem;"
                @click="${startRecording}"
                disabled="${() => state.loading}"
              >
                <span>⏺️</span> Aufnahme starten
              </button>
            ` : html`
              <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.8rem; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); padding: 0.6rem 1.5rem; border-radius: 30px;">
                  <span style="display: inline-block; width: 12px; height: 12px; background: #ef4444; border-radius: 50%;"></span>
                  <span style="font-weight: 800; color: #f87171; font-size: 1rem;">AUFNAHME LÄUFT... (${() => state.elapsedSeconds}s • ${() => state.frameCount} Frames)</span>
                </div>

                <button
                  style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; font-size: 1.1rem; font-weight: 800; padding: 0.9rem 2.5rem; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 16px rgba(239,68,68,0.4); display: flex; align-items: center; gap: 0.6rem;"
                  @click="${stopRecording}"
                  disabled="${() => state.loading}"
                >
                  <span>⏹️</span> Aufnahme stoppen & analysieren
                </button>
              </div>
            `}
          </div>
        </div>
      ` : ''}

      <!-- TAB: DETAIL (ANALYSIS VIEW) -->
      ${() => state.activeTab === 'detail' && state.selectedRecording ? html`
        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56,189,248,0.3); border-radius: 14px; padding: 1.5rem; margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <div>
              <span style="font-size: 0.8rem; background: rgba(56,189,248,0.2); color: #38bdf8; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 4px;">
                ANALYSE-ERGEBNIS
              </span>
              <h3 style="margin: 0.4rem 0 0 0; font-size: 1.3rem; color: #ffffff;">
                ${() => state.selectedRecording.label}
              </h3>
              <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.2rem;">
                ${() => state.selectedRecording.timestamp} • ${() => state.selectedRecording.duration}s Dauer • ${() => state.selectedRecording.total_frames} Frames erfasst
              </div>
            </div>

            <button
              style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600;"
              @click="${() => { state.activeTab = 'record'; }}"
            >
              ⬅️ Neue Aufnahme
            </button>
          </div>

          <h4 style="font-size: 1.05rem; color: #38bdf8; margin-bottom: 0.75rem;">
            🎯 Erkannte Tasten-Signalkandidaten (${() => state.selectedRecording.analysis?.candidates?.length || 0})
          </h4>
          
          ${() => (state.selectedRecording.analysis?.candidates || []).length === 0 ? html`
            <div style="background: rgba(30, 41, 59, 0.5); padding: 1.5rem; border-radius: 10px; text-align: center; color: #94a3b8;">
              Keine Signaländerungen während der Aufnahme erkannt. Stelle sicher, dass die Zündung an ist und drücke die Taste mehrfach.
            </div>
          ` : html`
            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
              ${state.selectedRecording.analysis.candidates.map((c, idx) => html`
                <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid ${idx === 0 ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; border-radius: 10px; padding: 1rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                      <span style="font-weight: 800; font-size: 1.1rem; color: ${idx === 0 ? '#38bdf8' : '#ffffff'}; font-family: monospace;">
                        CAN ID: ${c.hex_id} (${c.address})
                      </span>
                      <span style="font-size: 0.75rem; background: rgba(255,255,255,0.1); padding: 0.15rem 0.5rem; border-radius: 4px;">
                        Bus ${c.bus}
                      </span>
                      ${idx === 0 ? html`
                        <span style="font-size: 0.75rem; font-weight: 800; background: rgba(34,197,94,0.2); color: #4ade80; padding: 0.15rem 0.5rem; border-radius: 4px;">
                          TOP TREFFER ★
                        </span>
                      ` : ''}
                    </div>

                    <div style="font-size: 0.8rem; color: #94a3b8;">
                      ${c.changes_count} Zustandswechsel • ${c.unique_payload_count} eindeutige Werte
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; font-size: 0.85rem; color: #cbd5e1; background: rgba(15,23,42,0.6); padding: 0.75rem; border-radius: 6px;">
                    <div>
                      <span style="color: #94a3b8;">Geänderte Bytes:</span> <b>Byte ${c.changed_bytes.join(', ')}</b>
                    </div>
                    <div>
                      <span style="color: #94a3b8;">Payload-Werte (Hex):</span> 
                      <code style="color: #38bdf8; background: rgba(0,0,0,0.3); padding: 0.1rem 0.3rem; border-radius: 3px;">
                        ${c.sample_hex_values.slice(0, 3).join(' ➔ ')}
                      </code>
                    </div>
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      ` : ''}

      <!-- TAB: HISTORY -->
      ${() => state.activeTab === 'history' ? html`
        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 1.5rem;">
          <h3 style="margin-top: 0; font-size: 1.1rem; color: #cbd5e1; margin-bottom: 1rem;">
            📁 Bisherige Aufnahmen (${() => state.recordings.length})
          </h3>

          ${() => state.recordings.length === 0 ? html`
            <div style="text-align: center; padding: 2rem; color: #94a3b8;">
              Noch keine Aufnahmen vorhanden. Starte eine neue Aufnahme unter dem Reiter "Aufnahme".
            </div>
          ` : html`
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${state.recordings.map(rec => html`
                <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 800; font-size: 1.05rem; color: #f8fafc;">
                      ${rec.label}
                    </div>
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem;">
                      ${rec.timestamp} • ${rec.duration}s • ${rec.total_frames} Frames • ${rec.candidate_count} Kandidaten: <b style="color: #38bdf8;">${rec.top_candidates.join(', ')}</b>
                    </div>
                  </div>

                  <div style="display: flex; gap: 0.5rem;">
                    <button
                      style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 700; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer;"
                      @click="${() => viewRecording(rec.id)}"
                    >
                      🔍 Analyse ansehen
                    </button>
                    <button
                      style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; font-weight: 700; padding: 0.4rem 0.6rem; border-radius: 6px; cursor: pointer;"
                      @click="${() => deleteRecording(rec.id)}"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      ` : ''}

    </div>
  `
}
