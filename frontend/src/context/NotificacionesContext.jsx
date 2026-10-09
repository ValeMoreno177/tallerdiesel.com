import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'
import useAutoRefresh from '../hooks/useAutoRefresh'
import Toast from '../components/Toast'

// ── Sonido de notificación generado con Web Audio API (sin archivos externos) ──
export function reproducirSonido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const tiempos = [0, 0.15, 0.3]
    const frecuencias = [880, 1100, 1320]
    tiempos.forEach((t, i) => {
      const osc  = ctx.createOscillator()
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
  } catch (e) {
    console.warn('Audio no disponible:', e)
  }
}

const NotificacionesContext = createContext(null)

/**
 * Consulta las notificaciones del usuario cada 30 s EN TODA LA APP (no solo en las
 * páginas que tienen la campana) y no depende del estatus de ningún ticket: los avisos
 * de mensajes siguen llegando aunque el servicio ya esté finalizado.
 * Cuando llega una notificación nueva suena y sale un aviso flotante.
 */
export function NotificacionesProvider({ children }) {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState([])
  const [sonidoActivo, setSonidoActivo] = useState(true)
  const [aviso, setAviso] = useState(null)
  const vistas = useRef(null)          // ids ya conocidos; null = aún no se hace la primera carga
  const sonidoRef = useRef(true)
  useEffect(() => { sonidoRef.current = sonidoActivo }, [sonidoActivo])

  // Al cambiar de usuario (login / logout) se empieza de cero
  useEffect(() => {
    vistas.current = null
    setNotifs([])
    setAviso(null)
  }, [user?.id])

  const cargar = useCallback(async () => {
    const { data } = await api.get('/notificaciones/')
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
    vistas.current = new Set(data.map(n => n.id))
    setNotifs(data)
  }, [])

  useAutoRefresh(cargar, { activo: !!user, inmediato: true })

  const marcarLeida = useCallback(async (id) => {
    await api.post(`/notificaciones/${id}/leer/`)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }, [])

  const marcarTodas = useCallback(async () => {
    await api.post('/notificaciones/leer-todas/')
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
  }, [])

  const valor = {
    notifs, noLeidas: notifs.filter(n => !n.leida).length,
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