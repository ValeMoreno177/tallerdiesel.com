import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'
import useAutoRefresh, { refrescarAhora } from '../hooks/useAutoRefresh'
import { NOTIFICACIONES_MS } from '../config/tiempos'
import Toast from '../components/Toast'

// ── Sonido de notificación generado con Web Audio API (sin archivos externos) ──
let contextoAudio = null
let sonidoPendiente = false

function tocarSonido(ctx) {
  const tiempos = [0, 0.15, 0.3]
  const frecuencias = [880, 1100, 1320]
  tiempos.forEach((t, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frecuencias[i], ctx.currentTime + t)
    gain.gain.setValueAtTime(0.3, ctx.currentTime + t)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
    osc.start(ctx.currentTime + t)
    osc.stop(ctx.currentTime + t + 0.2)
  })
}

function reproducirPendiente(ctx) {
  if (sonidoPendiente && ctx.state === 'running') {
    sonidoPendiente = false
    tocarSonido(ctx)
  }
}

export function activarSonido() {
  try {
    const AudioContextAPI = window.AudioContext || window.webkitAudioContext
    if (!AudioContextAPI) throw new Error('Este navegador no admite Web Audio API.')
    if (!contextoAudio || contextoAudio.state === 'closed') contextoAudio = new AudioContextAPI()
    const reanudar = contextoAudio.state === 'suspended' ? contextoAudio.resume() : Promise.resolve()
    return reanudar.then(() => {
      reproducirPendiente(contextoAudio)
      return contextoAudio.state === 'running'
    }).catch(e => {
      console.warn('No se pudo activar el sonido:', e)
      return false
    })
  } catch (e) {
    console.warn('Audio no disponible:', e)
    return Promise.resolve(false)
  }
}

export function reproducirSonido() {
  if (!contextoAudio || contextoAudio.state === 'closed') {
    sonidoPendiente = true
    return
  }
  if (contextoAudio.state === 'suspended') {
    sonidoPendiente = true
    contextoAudio.resume()
      .then(() => reproducirPendiente(contextoAudio))
      .catch(e => console.warn('No se pudo reanudar el sonido de notificación:', e))
    return
  }
  if (contextoAudio.state !== 'running') {
    sonidoPendiente = true
    return
  }
  try {
    tocarSonido(contextoAudio)
  } catch (e) {
    console.warn('Audio no disponible:', e)
  }
}

const NotificacionesContext = createContext(null)

/**
 * Consulta las notificaciones del usuario cada segundo EN TODA LA APP (no solo en las
 * páginas que tienen la campana) y no depende del estatus de ningún ticket: los avisos
 * de mensajes siguen llegando aunque el servicio ya esté finalizado.
 * Cuando llega una notificación nueva suena y sale un aviso flotante.
 */
export function NotificacionesProvider({ children }) {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState([])
  const [archivadas, setArchivadas] = useState([])
  const [sonidoActivo, setSonidoActivo] = useState(true)
  const [aviso, setAviso] = useState(null)
  const vistas = useRef(null)          // ids ya conocidos; null = aún no se hace la primera carga
  const sonidoRef = useRef(true)
  const usuarioPrevio = useRef(null)   // para distinguir un cierre de sesión de la carga inicial
  useEffect(() => { sonidoRef.current = sonidoActivo }, [sonidoActivo])

  useEffect(() => {
    if (!user || !sonidoActivo) return undefined
    const eventos = ['pointerdown', 'keydown', 'touchstart']
    const desbloquear = () => {
      activarSonido().then(activo => {
        if (activo) eventos.forEach(evento => document.removeEventListener(evento, desbloquear))
      })
    }
    eventos.forEach(evento => document.addEventListener(evento, desbloquear))
    return () => eventos.forEach(evento => document.removeEventListener(evento, desbloquear))
  }, [user?.id, sonidoActivo])

  // Al cambiar de usuario (login / logout) se empieza de cero
  useEffect(() => {
    vistas.current = null
    setNotifs([])
    setArchivadas([])
    setAviso(null)
    // Solo al CERRAR sesión de verdad (había usuario y ya no): la próxima vez se vuelve a avisar lo pendiente.
    // (Al recargar la página el usuario también arranca vacío un instante: eso no cuenta como cierre.)
    if (usuarioPrevio.current && !user) {
      try { Object.keys(sessionStorage).filter(k => k.startsWith('td_avisado_')).forEach(k => sessionStorage.removeItem(k)) } catch { /* sin storage */ }
    }
    usuarioPrevio.current = user?.id ?? null
  }, [user?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = useCallback(async () => {
    const { data } = await api.get('/notificaciones/')
    if (!vistas.current) {
      // Primera carga tras iniciar sesión: las notificaciones viven en el servidor, así que las que llegaron
      // mientras la sesión estaba cerrada siguen ahí. Se avisa UNA vez por inicio de sesión.
      const sinLeer = data.filter(n => !n.leida && n.tipo !== 'calificar_servicio')
      const clave = `td_avisado_${user?.id}`
      if (sinLeer.length > 0 && !sessionStorage.getItem(clave)) {
        sessionStorage.setItem(clave, '1')
        if (sonidoRef.current) reproducirSonido()
        setAviso({
          id: `inicio-${sinLeer[0].id}`,
          titulo: sinLeer.length === 1 ? sinLeer[0].titulo : `Tienes ${sinLeer.length} notificaciones sin leer`,
          mensaje: sinLeer.length === 1 ? sinLeer[0].mensaje : sinLeer[0].titulo,
        })
      }
    }
    if (vistas.current) {
      const nuevas = data.filter(n => !n.leida && !vistas.current.has(n.id))
      if (nuevas.length > 0) {
        if (sonidoRef.current) reproducirSonido()
        // La invitación a calificar ya sale como ventana propia: no se duplica con el aviso flotante.
        const paraAviso = nuevas.filter(n => n.tipo !== 'calificar_servicio')
        if (paraAviso.length === 1) {
          setAviso({ id: paraAviso[0].id, titulo: paraAviso[0].titulo, mensaje: paraAviso[0].mensaje })
        } else if (paraAviso.length > 1) {
          setAviso({ id: paraAviso[0].id, titulo: `Tienes ${paraAviso.length} notificaciones nuevas`, mensaje: paraAviso[0].titulo })
        }
      }
    }
    const hayNuevas = !!vistas.current && data.some(n => !n.leida && !vistas.current.has(n.id))
    vistas.current = new Set(data.map(n => n.id))
    setNotifs(data)
    // Si llegó algo nuevo, dashboards y bitácoras se actualizan en ese mismo momento
    // (así el aviso y los números en pantalla nunca quedan desfasados).
    if (hayNuevas) refrescarAhora()
  }, [user?.id])

  const cargarArchivadas = useCallback(async () => {
    const { data } = await api.get('/notificaciones/', { params: { archivadas: 'true' } })
    setArchivadas(data)
  }, [])

  const restaurarNotificacion = useCallback(async (id) => {
    await api.post(`/notificaciones/${id}/restaurar/`)
    setArchivadas(prev => prev.filter(n => n.id !== id))
    await cargar()
  }, [cargar])

  // Cada segundo (NOTIFICACIONES_MS), aunque la pestaña esté en segundo plano
  useAutoRefresh(cargar, { activo: !!user, inmediato: true, intervalo: NOTIFICACIONES_MS })

  const marcarLeida = useCallback(async (id) => {
    await api.post(`/notificaciones/${id}/leer/`)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }, [])

  const marcarTodas = useCallback(async () => {
    await api.post('/notificaciones/leer-todas/')
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
  }, [])

  const valor = {
    notifs, archivadas, cargarArchivadas, restaurarNotificacion,
    noLeidas: notifs.filter(n => !n.leida).length,
    marcarLeida, marcarTodas, recargar: cargar,
    sonidoActivo, setSonidoActivo,
  }

  return (
    <NotificacionesContext.Provider value={valor}>
      {children}
      <Toast
        key={aviso?.id}
        show={!!aviso}
        tipo="info"
        titulo={aviso ? `🔔 ${aviso.titulo}` : ''}
        mensaje={aviso?.mensaje}
        onClose={() => setAviso(null)}
        duracion={6000}
      />
    </NotificacionesContext.Provider>
  )
}

export const useNotificaciones = () => useContext(NotificacionesContext)
