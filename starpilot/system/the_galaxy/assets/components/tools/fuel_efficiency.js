import { html, reactive } from "/assets/vendor/arrow-core.js"

const state = reactive({
  loading: true,
  activeTab: "live", // "live", "drives", "tank", "trips"
  live: null,
  stats: null,
  drives: [],
  selectedDrive: null,
  tankData: null,
  customTrips: [],
  error: "",
  showRadarSpeed: localStorage.getItem("galaxy_show_radar_speed") === "true",
  showRefuelModal: false,
  showNewTripModal: false,
  refuelForm: {
    liters: "",
    pricePerLiter: "1.75",
    notes: "",
  },
  newTripForm: {
    name: "",
    description: "",
  }
})

let pollTimer = null

const PHASE_CONFIG = {
  ev_driving: {
    label: "Rein Elektrisch (EV)",
    icon: "🌱",
    color: "#22c55e",
    description: "Fahrt ausschließlich über den Elektromotor, Verbrennungsmotor aus.",
  },
  regen_braking: {
    label: "Rekuperation / Rekuperatives Bremsen",
    icon: "⚡",
    color: "#06b6d4",
    description: "Verzögerung lädt die Hybridbatterie auf.",
  },
  decel_fuel_cut: {
    label: "Schubabschaltung (Segeln)",
    icon: "💨",
    color: "#38bdf8",
    description: "Kraftstoffeinspritzung vollständig unterbrochen (0.0 l/100km).",
  },
  ice_cruise: {
    label: "Verbrenner Konstantfahrt (Teillast)",
    icon: "🚗",
    color: "#fbbf24",
    description: "1.6L Kappa GDI im effizienten Atkinson-Cruising-Betrieb.",
  },
  ice_acceleration: {
    label: "Verbrenner Last / Beschleunigung",
    icon: "🔥",
    color: "#f97316",
    description: "Hohe Leistungsanforderung mit Verbrenner und Hybrid-Boost.",
  },
  idle_engine_off: {
    label: "Stillstand (EV-Stop / Motor AUS)",
    icon: "🛑",
    color: "#a855f7",
    description: "Fahrzeug steht, Verbrennungsmotor ist abgeschaltet.",
  },
  idle_engine_on: {
    label: "Stillstand (Motor AN / Standladen)",
    icon: "⚙️",
    color: "#ef4444",
    description: "Fahrzeug steht, Motor läuft (Batterieladung / Katalysatorheizen).",
  },
}

function formatDuration(seconds) {
  const s = Math.round(seconds || 0)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) {
    return `${hrs}h ${mins}m`
  }
  return `${mins}m ${secs}s`
}

function formatValue(val, digits = 1) {
  const n = Number(val)
  return Number.isFinite(n) ? n.toFixed(digits) : '0.0'
}

function formatDate(ts) {
  if (!ts) return "N/A"
  const d = new Date(ts * 1000)
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
}

// API Loaders
async function fetchLiveStats() {
  try {
    const res = await fetch("/api/fuel_efficiency/stats")
    if (res.ok) {
      const data = await res.json()
      state.live = data
      state.stats = data
      state.loading = false
    }
  } catch (err) {
    state.error = err.message
  }
}

async function fetchDrives() {
  try {
    const res = await fetch("/api/fuel_efficiency/drives")
    if (res.ok) {
      const data = await res.json()
      state.drives = data.drives || []
    }
  } catch (err) {
    console.error("Error fetching drives:", err)
  }
}

async function fetchTank() {
  try {
    const res = await fetch("/api/fuel_efficiency/tank")
    if (res.ok) {
      state.tankData = await res.json()
    }
  } catch (err) {
    console.error("Error fetching tank data:", err)
  }
}

async function fetchCustomTrips() {
  try {
    const res = await fetch("/api/fuel_efficiency/custom_trips")
    if (res.ok) {
      const data = await res.json()
      state.customTrips = data.trips || []
    }
  } catch (err) {
    console.error("Error fetching custom trips:", err)
  }
}

// Action Handlers
async function submitRefuel(e) {
  e.preventDefault()
  try {
    const res = await fetch("/api/fuel_efficiency/tank/refuel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        liters: parseFloat(state.refuelForm.liters) || null,
        pricePerLiter: parseFloat(state.refuelForm.pricePerLiter) || 1.75,
        notes: state.refuelForm.notes,
      })
    })
    if (res.ok) {
      state.showRefuelModal = false
      state.refuelForm.liters = ""
      state.refuelForm.notes = ""
      await fetchTank()
    }
  } catch (err) {
    alert("Fehler beim Speichern der Tankung: " + err.message)
  }
}

async function submitNewTrip(e) {
  e.preventDefault()
  if (!state.newTripForm.name.trim()) return
  try {
    const res = await fetch("/api/fuel_efficiency/custom_trips/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.newTripForm.name,
        description: state.newTripForm.description,
      })
    })
    if (res.ok) {
      state.showNewTripModal = false
      state.newTripForm.name = ""
      state.newTripForm.description = ""
      await fetchCustomTrips()
    }
  } catch (err) {
    alert("Fehler beim Erstellen des Trips: " + err.message)
  }
}

async function toggleTripActive(tripId) {
  try {
    const res = await fetch(`/api/fuel_efficiency/custom_trips/${tripId}/toggle`, { method: "POST" })
    if (res.ok) await fetchCustomTrips()
  } catch (err) {
    console.error(err)
  }
}

async function deleteTrip(tripId) {
  if (!confirm("Möchtest du diesen Trip wirklich löschen?")) return
  try {
    const res = await fetch(`/api/fuel_efficiency/custom_trips/${tripId}`, { method: "DELETE" })
    if (res.ok) await fetchCustomTrips()
  } catch (err) {
    console.error(err)
  }
}

async function triggerDriveReset() {
  if (!confirm("Aktuelle Fahrt abschließen und als Bericht archivieren?")) return
  try {
    const res = await fetch("/api/fuel_efficiency/reset", { method: "POST" })
    if (res.ok) {
      await fetchLiveStats()
      await fetchDrives()
      await fetchTank()
      await fetchCustomTrips()
    }
  } catch (err) {
    alert("Fehler beim Zurücksetzen: " + err.message)
  }
}

export function FuelEfficiency() {
  if (!pollTimer) {
    fetchLiveStats()
    fetchDrives()
    fetchTank()
    fetchCustomTrips()

    pollTimer = setInterval(() => {
      if (state.activeTab === "live") fetchLiveStats()
      else if (state.activeTab === "tank") fetchTank()
      else if (state.activeTab === "trips") fetchCustomTrips()
    }, 1000)
  }

  return html`
    <link rel="stylesheet" href="/assets/components/tools/fuel_efficiency.css" />
    <div class="fuel-efficiency-container">
      <div class="fuel-header">
        <h2>
          <i class="bi bi-fuel-pump"></i>
          Hyundai Ioniq Hybrid — Verbrauchs- & Phasenanalyse
        </h2>
        <div class="fuel-actions" style="display: flex; gap: 0.75rem; align-items: center;">
          <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.85rem; color: #38bdf8; font-weight: 600;">
            <input type="checkbox" checked="${() => state.showRadarSpeed}" @change="${(e) => { state.showRadarSpeed = e.target.checked; localStorage.setItem('galaxy_show_radar_speed', String(e.target.checked)); }}" />
            <span>🎯 Vordermann Radar</span>
          </label>
          <button class="fuel-btn primary" @click="${triggerDriveReset}">
            <i class="bi bi-flag-fill"></i>
            Fahrt abschließen
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="fuel-nav-tabs">
        <button class="${() => 'fuel-tab-btn ' + (state.activeTab === 'live' ? 'active' : '')}" @click="${() => { state.activeTab = 'live'; state.selectedDrive = null; }}">
          <i class="bi bi-broadcast"></i> Live-Monitor
        </button>
        <button class="${() => 'fuel-tab-btn ' + (state.activeTab === 'drives' ? 'active' : '')}" @click="${() => { state.activeTab = 'drives'; fetchDrives(); }}">
          <i class="bi bi-journal-text"></i> Einzelfahrten (${() => state.drives.length})
        </button>
        <button class="${() => 'fuel-tab-btn ' + (state.activeTab === 'tank' ? 'active' : '')}" @click="${() => { state.activeTab = 'tank'; fetchTank(); }}">
          <i class="bi bi-fuel-pump-fill"></i> Tankfüllungen
        </button>
        <button class="${() => 'fuel-tab-btn ' + (state.activeTab === 'trips' ? 'active' : '')}" @click="${() => { state.activeTab = 'trips'; fetchCustomTrips(); }}">
          <i class="bi bi-signpost-2-fill"></i> Eigene Trips (${() => state.customTrips.length})
        </button>
      </div>

      <!-- TAB CONTENTS -->
      ${() => {
        if (state.activeTab === 'live') return renderLiveView()
        if (state.activeTab === 'drives') return renderDrivesView()
        if (state.activeTab === 'tank') return renderTankView()
        if (state.activeTab === 'trips') return renderTripsView()
        return ''
      }}

      <!-- REFUEL MODAL -->
      ${() => state.showRefuelModal ? html`
        <div class="modal-overlay">
          <div class="modal-card">
            <h3 style="margin-top: 0;">⛽ Tankfüllung eintragen</h3>
            <p style="color: #a1a1aa; font-size: 0.9rem;">Trage hier deine getankten Liter ein, um den bisherigen Zyklus abzuschließen und die Real-Verbrauchsrechnung zu starten.</p>
            
            <div class="form-group">
              <label>Getankte Kraftstoffmenge (Liter)*</label>
              <input type="number" step="0.01" class="form-input" placeholder="z. B. 38.50" value="${() => state.refuelForm.liters}" @input="${(e) => { state.refuelForm.liters = e.target.value; }}" required />
            </div>

            <div class="form-group">
              <label>Spritpreis (€ / Liter) - Optional</label>
              <input type="number" step="0.001" class="form-input" placeholder="z. B. 1.749" value="${() => state.refuelForm.pricePerLiter}" @input="${(e) => { state.refuelForm.pricePerLiter = e.target.value; }}" />
            </div>

            <div class="form-group">
              <label>Notiz / Tankstelle - Optional</label>
              <input type="text" class="form-input" placeholder="z. B. Aral E10 Autobahn" value="${() => state.refuelForm.notes}" @input="${(e) => { state.refuelForm.notes = e.target.value; }}" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
              <button class="fuel-btn" @click="${() => { state.showRefuelModal = false; }}">Abbrechen</button>
              <button class="fuel-btn primary" @click="${submitRefuel}">Speichern & Abschließen</button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- NEW CUSTOM TRIP MODAL -->
      ${() => state.showNewTripModal ? html`
        <div class="modal-overlay">
          <div class="modal-card">
            <h3 style="margin-top: 0;">📍 Neuen Trip anlegen</h3>
            <p style="color: #a1a1aa; font-size: 0.9rem;">Erstelle einen benannten Langzeit-Zähler, der Kilometer und Kraftstoff über mehrere Fahrten hinweg summiert.</p>

            <div class="form-group">
              <label>Name des Trips*</label>
              <input type="text" class="form-input" placeholder="z. B. Italien Urlaub 2026 oder Arbeitsweg" value="${() => state.newTripForm.name}" @input="${(e) => { state.newTripForm.name = e.target.value; }}" required />
            </div>

            <div class="form-group">
              <label>Beschreibung - Optional</label>
              <input type="text" class="form-input" placeholder="z. B. Autobahn + Landstraße voll beladen" value="${() => state.newTripForm.description}" @input="${(e) => { state.newTripForm.description = e.target.value; }}" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
              <button class="fuel-btn" @click="${() => { state.showNewTripModal = false; }}">Abbrechen</button>
              <button class="fuel-btn primary" @click="${submitNewTrip}">Trip starten</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `
}

function renderLiveView() {
  const currentPhaseKey = state.live?.currentPhase || "idle_engine_off"
  const phaseInfo = PHASE_CONFIG[currentPhaseKey] || {
    label: currentPhaseKey,
    icon: "🚘",
    color: "#a1a1aa",
    description: "",
  }

  const instantL = state.live?.instantLPer100km ?? 0
  const avgL = state.live?.tripAvgLPer100km ?? 0
  const tripDist = state.live?.tripDistanceKm ?? 0
  const tripDuration = state.live?.tripDurationSeconds ?? 0
  const evDistPct = state.live?.evDistancePct ?? 0
  const evTimePct = state.live?.evTimePct ?? 0
  const regenKWh = state.live?.tripRegenKWh ?? 0
  const rpm = state.live?.engineRpm ?? 0
  const phases = state.stats?.phases || {}

  return html`
    <div>
      ${() => state.showRadarSpeed ? html`
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 2rem; background: rgba(56, 189, 248, 0.15); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(56, 189, 248, 0.4);">
              🎯
            </div>
            <div>
              <div style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; color: #38bdf8; text-transform: uppercase;">
                Radar Vordermann-Tracking
              </div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #ffffff; display: flex; align-items: baseline; gap: 0.4rem;">
                <span>${() => state.live?.leadCarSpeedKph !== null && state.live?.leadCarSpeedKph !== undefined ? state.live.leadCarSpeedKph : '--'}</span>
                <span style="font-size: 0.85rem; font-weight: 600; color: #94a3b8;">km/h</span>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 1.5rem; text-align: right;">
            <div>
              <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">Abstand</div>
              <div style="font-size: 1.15rem; font-weight: 700; color: #4ade80;">
                ${() => state.live?.leadCarDistanceM !== null && state.live?.leadCarDistanceM !== undefined ? state.live.leadCarDistanceM + ' m' : '--'}
              </div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">Differenz (&Delta;v)</div>
              <div style="font-size: 1.15rem; font-weight: 700; color: ${() => (state.live?.leadCarRelSpeedKph || 0) < 0 ? '#ef4444' : '#38bdf8'};">
                ${() => state.live?.leadCarRelSpeedKph !== null && state.live?.leadCarRelSpeedKph !== undefined ? (state.live.leadCarRelSpeedKph > 0 ? '+' : '') + state.live.leadCarRelSpeedKph + ' km/h' : '--'}
              </div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">Radar-Lock</div>
              <div style="font-size: 0.85rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: ${() => state.live?.leadCarStatus ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)'}; color: ${() => state.live?.leadCarStatus ? '#22c55e' : '#94a3b8'};">
                ${() => state.live?.leadCarStatus ? 'LOCK' : 'SEARCH'}
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="current-phase-card" style="border-color: ${phaseInfo.color}">
        <div class="phase-info">
          <div class="phase-icon" style="background: ${phaseInfo.color}22">
            ${phaseInfo.icon}
          </div>
          <div class="phase-details">
            <div class="phase-title">Aktuelle Fahrphase</div>
            <div class="phase-name" style="color: ${phaseInfo.color}">
              ${phaseInfo.label}
            </div>
            <div style="font-size: 0.85rem; color: #a1a1aa; margin-top: 0.2rem;">
              ${phaseInfo.description}
            </div>
          </div>
        </div>
        <div class="phase-status-badge" style="background: ${phaseInfo.color}22; color: ${phaseInfo.color}; border-color: ${phaseInfo.color}44;">
          ${() => state.live?.isEvMode ? '🌱 EV AKTIV' : '🔥 ICE AKTIV'}
        </div>
      </div>

      <div class="fuel-metrics-grid">
        <div class="metric-card">
          <div class="metric-label"><i class="bi bi-speedometer2"></i> Momentanverbrauch</div>
          <div class="metric-value">${formatValue(instantL, 1)} <span class="metric-unit">l/100km</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="bi bi-pie-chart-fill"></i> Ø Verbrauch (Fahrt)</div>
          <div class="metric-value" style="color: #4ade80">${formatValue(avgL, 2)} <span class="metric-unit">l/100km</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="bi bi-lightning-charge-fill"></i> EV-Streckenanteil</div>
          <div class="metric-value" style="color: #22c55e">${formatValue(evDistPct, 1)} <span class="metric-unit">%</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="bi bi-battery-charging"></i> Rekuperiert</div>
          <div class="metric-value" style="color: #06b6d4">${formatValue(regenKWh, 3)} <span class="metric-unit">kWh</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="bi bi-gear-wide-connected"></i> Motordrehzahl</div>
          <div class="metric-value">${rpm} <span class="metric-unit">U/min</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label"><i class="bi bi-pin-map-fill"></i> Gefahrene Distanz</div>
          <div class="metric-value">${formatValue(tripDist, 2)} <span class="metric-unit">km</span></div>
        </div>
      </div>

      <div class="ev-ratio-card">
        <div style="display: flex; justify-content: space-between; font-weight: 600;">
          <span>Energieaufteilung der aktuellen Fahrt</span>
          <span style="color: #4ade80;">Dauer: ${formatDuration(tripDuration)}</span>
        </div>
        <div class="ev-progress-bar-wrap">
          <div class="ev-bar-segment ev" style="width: ${evDistPct}%" title="Rein Elektrisch"></div>
          <div class="ev-bar-segment ice" style="width: ${100 - evDistPct}%" title="Verbrenner"></div>
        </div>
        <div class="ev-bar-legend">
          <div><span class="legend-dot" style="background: #22c55e"></span> EV-Modus: ${formatValue(evDistPct, 1)}% (${formatValue(evTimePct, 1)}% Zeit)</div>
          <div><span class="legend-dot" style="background: #f97316"></span> Verbrenner: ${formatValue(100 - evDistPct, 1)}%</div>
          <div><span class="legend-dot" style="background: #06b6d4"></span> Rekuperation: ${formatValue(regenKWh, 3)} kWh</div>
        </div>
      </div>

      <div class="phases-table-card">
        <h3 style="margin-top: 0; margin-bottom: 1rem;">Phasenaufschlüsselung der aktuellen Fahrt</h3>
        <table class="phases-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Dauer</th>
              <th>Strecke</th>
              <th>Ø Geschw.</th>
              <th>Ø Drehzahl</th>
              <th>Verbrauch</th>
              <th>Ø l/100km</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(PHASE_CONFIG).map(([key, cfg]) => {
              const p = phases[key] || { durationSeconds: 0, timePercent: 0, distanceKm: 0, distancePercent: 0, avgSpeedKph: 0, avgRpm: 0, fuelLiters: 0, avgLPer100km: 0 }
              return html`
                <tr>
                  <td><span class="phase-pill" style="background: ${cfg.color}22; color: ${cfg.color};">${cfg.icon} ${cfg.label}</span></td>
                  <td>${formatDuration(p.durationSeconds)} (${p.timePercent}%)</td>
                  <td>${p.distanceKm.toFixed(2)} km (${p.distancePercent}%)</td>
                  <td>${p.avgSpeedKph.toFixed(0)} km/h</td>
                  <td>${p.avgRpm} U/min</td>
                  <td>${p.fuelLiters.toFixed(3)} l</td>
                  <td style="font-weight: 600; color: ${p.avgLPer100km > 7 ? '#ef4444' : '#4ade80'}">${p.avgLPer100km.toFixed(2)} l/100km</td>
                </tr>
              `
            })}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderDrivesView() {
  return html`
    <div class="phases-table-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0;">Automatisch archivierte Einzelfahrten</h3>
        <button class="fuel-btn" @click="${fetchDrives}"><i class="bi bi-arrow-clockwise"></i> Aktualisieren</button>
      </div>
      ${state.drives.length === 0 ? html`<p style="color: #a1a1aa;">Noch keine archivierten Fahrten vorhanden. Nach jedem Abstellen des Fahrzeugs wird hier automatisch ein detaillierter Bericht abgelegt.</p>` : html`
        <table class="phases-table">
          <thead>
            <tr>
              <th>Fahrt-ID / Datum</th>
              <th>Distanz</th>
              <th>Dauer</th>
              <th>Ø Verbrauch</th>
              <th>EV-Anteil</th>
              <th>Rekuperiert</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${state.drives.map(drive => html`
              <tr>
                <td><strong>${formatDate(drive.startTime)}</strong> (${drive.driveId || drive.filename})</td>
                <td>${drive.tripDistanceKm} km</td>
                <td>${formatDuration(drive.tripDurationSeconds)}</td>
                <td style="font-weight: 700; color: #4ade80;">${drive.tripAvgLPer100km} l/100km</td>
                <td><span style="color: #22c55e;">${drive.evDistancePct}%</span></td>
                <td><span style="color: #06b6d4;">${drive.tripRegenKWh} kWh</span></td>
                <td>
                  <button class="fuel-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="window.__selectDrive('${drive.driveId || drive.filename}')">
                    <i class="bi bi-eye"></i> Details
                  </button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      `}

      ${state.selectedDrive ? html`
        <div class="phases-table-card" style="border: 2px solid #3b82f6; margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; color: #60a5fa;">Detailbericht: ${state.selectedDrive.driveId} (${formatDate(state.selectedDrive.startTime)})</h3>
            <button class="fuel-btn" @click="${() => { state.selectedDrive = null; }}"><i class="bi bi-x"></i> Schließen</button>
          </div>
          <table class="phases-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Dauer</th>
                <th>Strecke</th>
                <th>Ø Geschw.</th>
                <th>Ø Drehzahl</th>
                <th>Sprit</th>
                <th>Ø l/100km</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(PHASE_CONFIG).map(([key, cfg]) => {
                const p = state.selectedDrive.phases?.[key] || { durationSeconds: 0, timePercent: 0, distanceKm: 0, distancePercent: 0, avgSpeedKph: 0, avgRpm: 0, fuelLiters: 0, avgLPer100km: 0 }
                return html`
                  <tr>
                    <td><span class="phase-pill" style="background: ${cfg.color}22; color: ${cfg.color};">${cfg.icon} ${cfg.label}</span></td>
                    <td>${formatDuration(p.durationSeconds)} (${p.timePercent}%)</td>
                    <td>${p.distanceKm.toFixed(2)} km (${p.distancePercent}%)</td>
                    <td>${p.avgSpeedKph.toFixed(0)} km/h</td>
                    <td>${p.avgRpm} U/min</td>
                    <td>${p.fuelLiters.toFixed(3)} l</td>
                    <td style="font-weight: 600; color: ${p.avgLPer100km > 7 ? '#ef4444' : '#4ade80'}">${p.avgLPer100km.toFixed(2)} l/100km</td>
                  </tr>
                `
              })}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `
}

function renderTankView() {
  const currentTank = state.tankData?.currentTank || {}
  const tankHistory = state.tankData?.history || []

  return html`
    <div>
      <div class="tank-summary-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <div style="font-size: 0.85rem; color: #a1a1aa; text-transform: uppercase; font-weight: 600;">Aktueller Tankzyklus</div>
            <h3 style="margin: 0.25rem 0 0 0; font-size: 1.3rem;">Seit letztem Tankstopp</h3>
          </div>
          <button class="fuel-btn primary" @click="${() => { state.showRefuelModal = true; }}">
            <i class="bi bi-plus-circle-fill"></i> Tankfüllung eintragen
          </button>
        </div>

        <div class="fuel-metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Gefahren seit Tanken</div>
            <div class="metric-value">${formatValue(currentTank.distanceKm, 1)} <span class="metric-unit">km</span></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Verbrauchter Kraftstoff</div>
            <div class="metric-value">${formatValue(currentTank.fuelLiters, 2)} <span class="metric-unit">Liter</span></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Ø Tank-Verbrauch</div>
            <div class="metric-value" style="color: #4ade80">${formatValue(currentTank.avgLPer100km, 2)} <span class="metric-unit">l/100km</span></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">EV-Anteil Tank</div>
            <div class="metric-value" style="color: #22c55e">${formatValue(currentTank.evDistancePct, 1)} <span class="metric-unit">%</span></div>
          </div>
        </div>
      </div>

      <div class="phases-table-card">
        <h3 style="margin-top: 0; margin-bottom: 1rem;">Tank-Historie & Quittungen</h3>
        ${tankHistory.length === 0 ? html`<p style="color: #a1a1aa;">Noch keine archivierten Tankstopps vorhanden. Klicke oben auf "Tankfüllung eintragen", um einen neuen Tankzyklus zu beginnen.</p>` : html`
          <table class="phases-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Getankt</th>
                <th>Spritpreis</th>
                <th>Distanz Zyklus</th>
                <th>Ø Real-Verbrauch</th>
                <th>Kosten / 100km</th>
                <th>Notiz</th>
              </tr>
            </thead>
            <tbody>
              ${tankHistory.map(item => html`
                <tr>
                  <td>${formatDate(item.timestamp)}</td>
                  <td><strong>${item.liters} l</strong></td>
                  <td>${item.pricePerLiter ? item.pricePerLiter.toFixed(2) + ' €/l' : '--'}</td>
                  <td>${item.distanceKm ? item.distanceKm.toFixed(1) + ' km' : '--'}</td>
                  <td style="font-weight: 700; color: #4ade80;">${item.avgLPer100km ? item.avgLPer100km.toFixed(2) + ' l/100km' : '--'}</td>
                  <td>${item.costPer100km ? item.costPer100km.toFixed(2) + ' €' : '--'}</td>
                  <td>${item.notes || '-'}</td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `
}

function renderTripsView() {
  return html`
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0;">Eigene Langzeit-Trips & Zähler (z. B. Urlaub, Pendelstrecke)</h3>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #a1a1aa;">Tracke beliebige Routen unabhängig von Zündung und Einzelfahrten.</p>
        </div>
        <button class="fuel-btn primary" @click="${() => { state.showNewTripModal = true; }}">
          <i class="bi bi-plus-circle-fill"></i> Neuen Trip anlegen
        </button>
      </div>

      ${state.customTrips.length === 0 ? html`
        <div class="phases-table-card" style="text-align: center; padding: 2rem;">
          <p style="color: #a1a1aa; margin-bottom: 1rem;">Du hast noch keine benutzerdefinierten Trips angelegt.</p>
          <button class="fuel-btn primary" @click="${() => { state.showNewTripModal = true; }}">Jetzt ersten Trip erstellen</button>
        </div>
      ` : html`
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
          ${state.customTrips.map(trip => html`
            <div class="custom-trip-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div>
                  <h4 style="margin: 0; font-size: 1.15rem; color: #38bdf8;">${trip.name}</h4>
                  <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.2rem;">${trip.description || 'Keine Beschreibung'}</div>
                </div>
                <div style="display: flex; gap: 0.3rem;">
                  <button class="fuel-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" title="Zähler auf 0 setzen" @click="${() => resetCustomTrip(trip.id)}">
                    <i class="bi bi-arrow-counterclockwise"></i>
                  </button>
                  <button class="fuel-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; color: #ef4444;" title="Löschen" @click="${() => deleteCustomTrip(trip.id)}">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>

              <div class="fuel-metrics-grid" style="margin-top: 0.75rem; margin-bottom: 0.5rem;">
                <div class="metric-card" style="padding: 0.5rem;">
                  <div class="metric-label" style="font-size: 0.75rem;">Distanz</div>
                  <div class="metric-value" style="font-size: 1.1rem;">${formatValue(trip.distanceKm, 1)} <span class="metric-unit">km</span></div>
                </div>
                <div class="metric-card" style="padding: 0.5rem;">
                  <div class="metric-label" style="font-size: 0.75rem;">Ø Verbrauch</div>
                  <div class="metric-value" style="font-size: 1.1rem; color: #4ade80;">${formatValue(trip.avgLPer100km, 2)} <span class="metric-unit">l/100km</span></div>
                </div>
                <div class="metric-card" style="padding: 0.5rem;">
                  <div class="metric-label" style="font-size: 0.75rem;">EV-Anteil</div>
                  <div class="metric-value" style="font-size: 1.1rem; color: #22c55e;">${formatValue(trip.evDistancePct, 1)} <span class="metric-unit">%</span></div>
                </div>
                <div class="metric-card" style="padding: 0.5rem;">
                  <div class="metric-label" style="font-size: 0.75rem;">Kraftstoff</div>
                  <div class="metric-value" style="font-size: 1.1rem;">${formatValue(trip.fuelLiters, 2)} <span class="metric-unit">l</span></div>
                </div>
              </div>
              <div style="font-size: 0.75rem; color: #71717a; text-align: right;">Erstellt: ${formatDate(trip.createdAt)}</div>
            </div>
          `)}
        </div>
      `}
    </div>
  `
}

// Window helpers for inline HTML handlers
window.__selectDrive = async (id) => {
  try {
    const res = await fetch(`/api/fuel_efficiency/drives/${id}`)
    if (res.ok) {
      state.selectedDrive = await res.json()
    }
  } catch (err) {
    console.error(err)
  }
}

window.__toggleTrip = (id) => toggleTripActive(id)
window.__deleteTrip = (id) => deleteTrip(id)
