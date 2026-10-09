import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { INACTIVIDAD_MS, AVISO_INACTIVIDAD_MS, CLAVE_ACTIVIDAD, CLAVE_SESION_EXPIRADA } from '../config/tiempos'

// Lo que cuenta como "actividad" del usuario. Las consultas automáticas cada 30 s NO cuentan.
const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart', 'click']

/**
 * Cierra la sesión tras 5 minutos sin actividad (INACTIVIDAD_MS).
 *  - A los 4:30 avisa con una cuenta regresiva (AVISO_INACTIVIDAD_MS) y permite seguir conectado.
 *  - El tiempo se calcula con la hora de la última actividad (no con un temporizador), así que
 *    también cuenta si se durmió el equipo o se dejó la pestaña en segundo plano.
 *  - La actividad se comparte entre pestañas: moverte en una mantiene viva la sesión en todas,
 *    y si una pestaña cierra la sesión, las demás también.
 */
export default function SesionInactividad() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [segundos, setSegundos] = useState(null)   // null = sin aviso; número = cuenta regresiva
  const accionesRef = useRef({})
  // `logout` y `navigate` cambian de identidad en cada render: se guardan en refs para que el
  // efecto de abajo (listeners + reloj) solo se reinicie cuando cambia el usuario.
  const logoutRef = useRef(logout)
  const navigateRef = useRef(navigate)
  useEffect(() => { logoutRef.current = logout; navigateRef.current = navigate })

  useEffect(() => {
    if (!user) { setSegundos(null); return undefined }

    const leerGuardada = () => Number(localStorage.getItem(CLAVE_ACTIVIDAD)) || 0
    // Sin marca guardada (sesión anterior a esta función) se arranca desde ahora.
    let ultima = leerGuardada() || Date.now()
    let ultimaEscritura = 0
    let cerrando = false

    const salir = (porInactividad) => {
      if (cerrando) return
      cerrando = true
      if (porInactividad) {
        try { sessionStorage.setItem(CLAVE_SESION_EXPIRADA, '1') } catch { /* modo privado */ }
      }
      navigateRef.current('/login', { replace: true })
      logoutRef.current()
    }

    const revisar = () => {
      const inactivo = Date.now() - Math.max(ultima, leerGuardada())   // incluye actividad de otras pestañas
      if (inactivo >= INACTIVIDAD_MS) { salir(true); return }
      const restante = INACTIVIDAD_MS - inactivo
      setSegundos(AVISO_INACTIVIDAD_MS > 0 && restante <= AVISO_INACTIVIDAD_MS ? Math.ceil(restante / 1000) : null)
    }

    const marcar = () => {
      const ahora = Date.now()
      // Si ya se había vencido (equipo dormido, etc.) una acción tardía no "revive" la sesión.
      if (ahora - Math.max(ultima, leerGuardada()) >= INACTIVIDAD_MS) { revisar(); return }
      ultima = ahora
      if (ahora - ultimaEscritura > 1000) {        // se guarda como máximo 1 vez por segundo
        ultimaEscritura = ahora
        try { localStorage.setItem(CLAVE_ACTIVIDAD, String(ahora)) } catch { /* sin almacenamiento */ }
      }
    }

    const alAlmacenar = (e) => {
      if (e.key === CLAVE_ACTIVIDAD) revisar()
      // Otra pestaña cerró la sesión (borró los tokens o limpió el almacenamiento)
      else if (e.key === null || (e.key === 'access_token' && !e.newValue)) salir(false)
    }

    accionesRef.current = {
      seguir: () => { marcar(); setSegundos(null) },
      cerrar: () => salir(false),
    }

    // ¿La sesión ya estaba vencida al abrir/recargar la página? Se revisa ANTES de escuchar eventos.
    revisar()
    if (cerrando) return undefined
    const id = setInterval(revisar, 1000)
    EVENTOS.forEach(ev => window.addEventListener(ev, marcar, { passive: true, capture: true }))
    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('storage', alAlmacenar)
    return () => {
      clearInterval(id)
      EVENTOS.forEach(ev => window.removeEventListener(ev, marcar, { capture: true }))
      document.removeEventListener('visibilitychange', revisar)
      window.removeEventListener('storage', alAlmacenar)
    }
  }, [user?.id])

  if (!user || segundos === null) return null

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal" role="alertdialog" aria-modal="true"
           aria-labelledby="td-inact-titulo" aria-describedby="td-inact-texto"
           style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem' }}>⏳</div>
        <div id="td-inact-titulo" className="modal-title">¿Sigues ahí?</div>
        <p id="td-inact-texto" style={{ color: '#4b5563', fontSize: '0.95rem', margin: '8px 0 0' }}>
          Por seguridad, tu sesión se cerrará por inactividad en{' '}
          <strong style={{ color: '#dc2626' }}>{segundos} {segundos === 1 ? 'segundo' : 'segundos'}</strong>.
        </p>
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" autoFocus onClick={() => accionesRef.current.seguir?.()}>Seguir conectado</button>
          <button className="btn btn-ghost" onClick={() => accionesRef.current.cerrar?.()}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}