import { useEffect, useState, useSyncExternalStore } from 'react'

// "Descargar la app" en computadora, tablet y teléfono.
// TallerDiesel es una app web instalable (PWA): queda como ícono en el escritorio o en la pantalla de
// inicio, abre a pantalla completa y no ocupa espacio como una app de tienda.
//  - Chrome / Edge / Samsung Internet / Android: el navegador permite instalar con un botón.
//  - iPhone / iPad (Safari): Apple no permite el botón; se muestran los pasos (Compartir → Agregar a inicio).
//  - Otros navegadores: se explica cómo hacerlo o qué navegador usar.
// Uso: <InstalarApp /> una vez en la app; abrirInstalarApp() desde cualquier botón.

const EVENTO_ABRIR = 'td:instalar-app'
let promptGuardado = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()          // se guarda para lanzarlo cuando la persona toque "Descargar app"
    promptGuardado = e
  })
  window.addEventListener('appinstalled', () => {
    promptGuardado = null
    try { localStorage.setItem('td_app_instalada', '1') } catch { /* sin almacenamiento */ }
    window.dispatchEvent(new Event('td:app-instalada'))
  })
}

export function abrirInstalarApp() {
  window.dispatchEvent(new Event(EVENTO_ABRIR))
}

// La app está instalada si se abrió desde su ícono (pantalla completa) o si se instaló desde este navegador.
export function yaInstalada() {
  if (typeof window === 'undefined') return false
  const abiertaComoApp = ['standalone', 'fullscreen', 'minimal-ui'].some(m => window.matchMedia?.(`(display-mode: ${m})`).matches)
    || window.navigator.standalone === true
  if (abiertaComoApp) return true
  try { return localStorage.getItem('td_app_instalada') === '1' } catch { return false }
}

function suscribirInstalada(cb) {
  window.addEventListener('td:app-instalada', cb)
  const mq = window.matchMedia?.('(display-mode: standalone)')
  mq?.addEventListener?.('change', cb)
  return () => { window.removeEventListener('td:app-instalada', cb); mq?.removeEventListener?.('change', cb) }
}

/** true cuando la app ya está instalada → se oculta el botón "Descargar app". */
export function useAppInstalada() {
  return useSyncExternalStore(suscribirInstalada, yaInstalada, () => false)
}

function detectarPlataforma() {
  const ua = navigator.userAgent || ''
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1   // iPad que se presenta como Mac
  const ios = /iPhone|iPad|iPod/i.test(ua) || iPadOS
  const android = /Android/i.test(ua)
  const samsung = /SamsungBrowser/i.test(ua)
  const firefox = /Firefox|FxiOS/i.test(ua)
  const edge = /Edg\//i.test(ua)
  const chromeIOS = /CriOS/i.test(ua)
  const safari = ios && !chromeIOS && !/FxiOS|EdgiOS/i.test(ua)
  const tablet = iPadOS || /iPad|Tablet/i.test(ua) || (android && !/Mobile/i.test(ua))
  return {
    ios, android, samsung, firefox, edge, safari, chromeIOS, tablet,
    dispositivo: tablet ? 'tablet' : (ios || android) ? 'teléfono' : 'computadora',
  }
}

function Pasos({ plataforma }) {
  const p = plataforma
  if (p.ios) {
    return (
      <ol className="inst-pasos">
        {!p.safari && <li>Abre <strong>www.tallerdiesel.com</strong> en <strong>Safari</strong> (en {p.chromeIOS ? 'Chrome' : 'este navegador'} de iPhone/iPad no se puede instalar).</li>}
        <li>Toca el botón <strong>Compartir</strong> <span className="inst-icono">⬆️</span> {p.tablet ? 'arriba a la derecha' : 'abajo, en el centro'}.</li>
        <li>Baja y elige <strong>"Agregar a pantalla de inicio"</strong> <span className="inst-icono">➕</span>.</li>
        <li>Toca <strong>Agregar</strong>. Listo: el ícono de TallerDiesel aparece en tu pantalla.</li>
      </ol>
    )
  }
  if (p.android) {
    return (
      <ol className="inst-pasos">
        <li>Toca el menú <strong>⋮</strong> {p.samsung ? 'o ☰ (abajo a la derecha)' : 'arriba a la derecha'} del navegador.</li>
        <li>Elige <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong>.</li>
        <li>Confirma con <strong>Instalar</strong>. El ícono aparece junto a tus otras apps.</li>
        {p.firefox && <li>Si no ves la opción, abre el sitio en <strong>Chrome</strong>.</li>}
      </ol>
    )
  }
  if (p.firefox) {
    return (
      <ol className="inst-pasos">
        <li>Firefox en computadora no instala apps web. Abre <strong>www.tallerdiesel.com</strong> en <strong>Chrome</strong> o <strong>Edge</strong>.</li>
        <li>Haz clic en el ícono <strong>⊕ Instalar</strong> que aparece a la derecha de la barra de direcciones.</li>
      </ol>
    )
  }
  return (
    <ol className="inst-pasos">
      <li>Haz clic en el ícono <strong>⊕ / 🖥️ Instalar</strong> a la derecha de la barra de direcciones{p.edge ? ' (o menú … → Aplicaciones → Instalar este sitio)' : ' (o menú ⋮ → Transmitir, guardar y compartir → Instalar)'}.</li>
      <li>Confirma con <strong>Instalar</strong>. TallerDiesel queda en tu escritorio y en el menú de inicio.</li>
      <li>En Mac con Safari: menú <strong>Archivo → Agregar al Dock</strong>.</li>
    </ol>
  )
}

export default function InstalarApp() {
  const [abierta, setAbierta] = useState(false)
  const [plataforma, setPlataforma] = useState(null)
  const [estado, setEstado] = useState('')

  useEffect(() => {
    const abrir = async () => {
      if (yaInstalada()) { setPlataforma(detectarPlataforma()); setEstado('instalada'); setAbierta(true); return }
      // Si el navegador lo permite, se instala directo con su ventana propia
      if (promptGuardado) {
        const ev = promptGuardado
        promptGuardado = null
        try {
          ev.prompt()
          const { outcome } = await ev.userChoice
          if (outcome === 'accepted') return
        } catch { /* sigue con las instrucciones */ }
      }
      setPlataforma(detectarPlataforma())
      setEstado('')
      setAbierta(true)
    }
    window.addEventListener(EVENTO_ABRIR, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR, abrir)
  }, [])

  useEffect(() => {
    if (!abierta) return undefined
    const esc = e => { if (e.key === 'Escape') setAbierta(false) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [abierta])

  if (!abierta || !plataforma) return null
  return (
    <div className="modal-overlay" style={{ zIndex: 4000 }} onClick={() => setAbierta(false)}>
      <style>{`
        .inst-pasos { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 10px; line-height: 1.45; font-size: 0.92rem; }
        .inst-icono { display: inline-block; padding: 0 4px; border-radius: 6px; background: #f3f4f6; }
        html[data-tema="oscuro"] .inst-icono { background: #1f2937; }
      `}</style>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="inst-titulo"
        style={{ maxWidth: 440, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: '#111827', color: 'white', padding: '1.25rem 1.5rem', borderBottom: '3px solid var(--naranja)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/android-chrome-192x192.png" alt="" width="48" height="48" style={{ borderRadius: 12 }} />
          <div>
            <div id="inst-titulo" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {estado === 'instalada' ? '✅ Ya tienes la app' : '📲 Descargar TallerDiesel'}
            </div>
            <div style={{ color: '#fdba74', fontSize: '0.8rem' }}>En tu {plataforma.dispositivo} · gratis · sin ocupar espacio</div>
          </div>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {estado === 'instalada'
            ? <p style={{ margin: 0 }}>Ya estás usando TallerDiesel como app instalada en este {plataforma.dispositivo}.</p>
            : <Pasos plataforma={plataforma} />}
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 14, marginBottom: 0 }}>
            La app se actualiza sola: siempre tendrás la versión más reciente, igual que en el navegador.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setAbierta(false)}>Entendido</button>
          </div>
        </div>
      </div>
    </div>
  )
}
