import { html, reactive } from "/assets/vendor/arrow-core.js"

const state = reactive({
  loading: false,
  pairingInfo: null,
  error: "",
  copied: false,
  copiedDongle: false,
})

async function fetchPairingInfo() {
  state.loading = true
  state.error = ""
  try {
    const res = await fetch("/api/pairing_info", { cache: "no-store" })
    if (res.ok) {
      state.pairingInfo = await res.json()
    } else {
      const err = await res.json()
      state.error = err.error || "Kopplungs-Informationen konnten nicht geladen werden."
    }
  } catch (err) {
    state.error = err.message
  } finally {
    state.loading = false
  }
}

function copyPairingUrl() {
  if (!state.pairingInfo?.pairing_url) return
  navigator.clipboard.writeText(state.pairingInfo.pairing_url)
  state.copied = true
  setTimeout(() => { state.copied = false; }, 2500)
}

function copyDongleId() {
  if (!state.pairingInfo?.dongle_id) return
  navigator.clipboard.writeText(state.pairingInfo.dongle_id)
  state.copiedDongle = true
  setTimeout(() => { state.copiedDongle = false; }, 2500)
}

export function PairingQR() {
  if (!state.pairingInfo && !state.loading) {
    fetchPairingInfo()
  }

  return html`
    <div style="padding: 1.5rem; max-width: 900px; margin: 0 auto; font-family: Inter, sans-serif; color: #f8fafc;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 0.5rem;">
            <span>📱</span> Gerät koppeln (Pairing QR-Code)
          </h2>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #94a3b8;">
            Verbinde deinen Comma 4 mit Connect (drive.markenjaden.de / connect.comma.ai)
          </p>
        </div>
        <div>
          <button
            style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 700; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;"
            @click="${fetchPairingInfo}"
            disabled="${() => state.loading}"
          >
            <span>🔄</span> ${() => state.loading ? 'Lade...' : 'Neu generieren'}
          </button>
        </div>
      </div>

      <!-- Main Pairing Card -->
      <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem; box-shadow: 0 8px 32px rgba(0,0,0,0.4); margin-bottom: 2rem;">
        
        ${() => state.error ? html`
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            ⚠️ ${state.error}
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; align-items: center;">
          
          <!-- QR Code Display Box -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.5rem;">
            
            <div style="margin-bottom: 1rem; text-align: center;">
              <span style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 0.25rem 0.75rem; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.35);">
                ${() => state.pairingInfo?.service_label || 'CONNECT'}
              </span>
            </div>

            <div style="background: #ffffff; padding: 12px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); line-height: 0; display: inline-block;">
              ${() => state.pairingInfo?.qr_data_url ? html`
                <img
                  src="${state.pairingInfo.qr_data_url}"
                  alt="Pairing QR Code"
                  style="width: 210px; height: 210px; display: block; image-rendering: pixelated;"
                />
              ` : html`
                <div style="width: 210px; height: 210px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 0.9rem; font-weight: 600;">
                  QR-Code wird generiert...
                </div>
              `}
            </div>

            <div style="margin-top: 1rem; font-size: 0.8rem; color: #94a3b8; text-align: center;">
              Scanne diesen Code mit deiner Smartphone-Kamera
            </div>
          </div>

          <!-- Pairing Details & Actions -->
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em;">
                Verbundenes Backend
              </div>
              <div style="font-size: 1.25rem; font-weight: 800; color: #38bdf8; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>🌐</span> ${() => state.pairingInfo?.host || 'Lade...'}
              </div>
            </div>

            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em;">
                Dongle ID
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.3rem;">
                <code style="background: rgba(0,0,0,0.4); padding: 0.4rem 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.95rem; color: #f8fafc; border: 1px solid rgba(255,255,255,0.1);">
                  ${() => state.pairingInfo?.dongle_id || '--'}
                </code>
                <button
                  style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600;"
                  @click="${copyDongleId}"
                >
                  ${() => state.copiedDongle ? '✅ Kopiert!' : '📋 Kopieren'}
                </button>
              </div>
            </div>

            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em;">
                Direkter Pairing-Link
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.3rem;">
                <div style="display: flex; gap: 0.5rem;">
                  <button
                    style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(2,132,199,0.35);"
                    @click="${copyPairingUrl}"
                  >
                    <span>${() => state.copied ? '✅' : '🔗'}</span>
                    ${() => state.copied ? 'Link kopiert!' : 'Kopplungs-Link kopieren'}
                  </button>

                  ${() => state.pairingInfo?.pairing_url ? html`
                    <a
                      href="${state.pairingInfo.pairing_url}"
                      target="_blank"
                      rel="noopener noreferrer"
                      style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 0.6rem 1rem; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem;"
                    >
                      <span>↗️</span> Im Browser öffnen
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      <!-- Instruction Steps -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.25rem;">
        <h3 style="margin-top: 0; font-size: 1rem; color: #38bdf8; margin-bottom: 0.75rem;">
          💡 So koppelst du dein Gerät:
        </h3>
        <ol style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: #cbd5e1; line-height: 1.6;">
          <li>Scanne den QR-Code mit deinem Smartphone oder klicke auf <b>"Im Browser öffnen"</b>.</li>
          <li>Logge dich auf der Connect-Website (<b>${() => state.pairingInfo?.host || 'Connect'}</b>) in dein Konto ein.</li>
          <li>Das Gerät registriert sich automatisch und ist sofort für Routen, Live-Zugriff und Navigation verfügbar.</li>
        </ol>
      </div>

    </div>
  `
}
