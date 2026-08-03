import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

// ── Sonido de notificación generado con Web Audio API (sin archivos externos) ──
function reproducirSonido() {
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

export default function CampanaNotificaciones({ onAbrirTicket }) {
  const [notifs,        setNotifs]        = useState([])
  const [abierto,       setAbierto]       = useState(false)
  const [sonidoActivo,  setSonidoActivo]  = useState(true)
  const prevCountRef = useRef(0)
  const ref          = useRef(null)
  const navigate     = useNavigate()
  const { user }     = useAuth()

  const fetchNotifs = useCallback(() => {
    api.get('/notificaciones/').then(({ data }) => {
      setNotifs(prev => {
        const noLeidasNuevas = data.filter(n => !n.leida).length
        const noLeidasAntes  = prev.filter(n => !n.leida).length
        // Reproducir sonido si hay notificaciones nuevas no leídas
        if (noLeidasNuevas > noLeidasAntes && sonidoActivo) {
          reproducirSonido()
        }
        return data
      })
    }).catch(() => {})
  }, [sonidoActivo])

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 15000) // cada 15s
    return () => clearInterval(interval)
  }, [fetchNotifs])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const noLeidas = notifs.filter(n => !n.leida).length

  const marcarLeida = async (id) => {
    await api.post(`/notificaciones/${id}/leer/`)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  const marcarTodas = async () => {
    await api.post('/notificaciones/leer-todas/')
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
  }

  const formatFecha = (f) => {
    const d = new Date(f)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const handleRellenar = async (n) => {
    await marcarLeida(n.id)
    setAbierto(false)

    if (n.referencia_id) {
      try {
        const { data: ticket } = await api.get(`/tickets/${n.referencia_id}/`)
        // Si el padre puede abrir el modal (está en el Dashboard), úsalo
        if (onAbrirTicket) {
          onAbrirTicket(ticket)
          return
        }
      } catch {}
      // Si no hay handler, navegar a la bitácora con el ID del ticket en la URL
      // para que la bitácora abra el modal automáticamente
      const ticketParam = `?ticket=${n.referencia_id}`
      if (user?.rol === 'coordinador') navigate('/coordinador/bitacora' + ticketParam)
      else if (user?.rol === 'cliente') navigate('/cliente/bitacora' + ticketParam)
      else navigate('/admin/bitacora' + ticketParam)
      return
    }

    // Sin referencia_id — ir al dashboard
    if (user?.rol === 'coordinador') navigate('/coordinador/dashboard')
    else if (user?.rol === 'cliente') navigate('/cliente/bitacora')
    else navigate('/admin/bitacora')
  }

  const iconoPorTipo = (tipo) => {
    if (tipo === 'solicitud')        return '🔧'
    if (tipo === 'tecnico_asignado') return '👷'
    return '📋'
  }

  const handleCampanaClick = () => {
    // Primer click activa el contexto de audio (requerido por navegadores)
    try { new (window.AudioContext || window.webkitAudioContext)() } catch {}
    setAbierto(!abierto)
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      {/* Botón campana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={handleCampanaClick}
          style={{
            position: 'relative', background: 'rgba(255,255,255,0.08)',
            border: 'none', borderRadius: '50%', width: 40, height: 40,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.2rem',
            animation: noLeidas > 0 ? 'campanaTilt 1s ease infinite' : 'none',
          }}
        >
          🔔
          {noLeidas > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              background: '#dc2626', color: 'white', borderRadius: '50%',
              width: 18, height: 18, fontSize: '0.65rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {noLeidas > 9 ? '9+' : noLeidas}
            </span>
          )}
        </button>

        {/* Toggle sonido */}
        <button
          onClick={() => setSonidoActivo(s => !s)}
          title={sonidoActivo ? 'Silenciar notificaciones' : 'Activar sonido'}
          style={{
            background: 'rgba(255,255,255,0.06)', border: 'none',
            borderRadius: '50%', width: 30, height: 30, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', opacity: sonidoActivo ? 1 : 0.4,
          }}
        >
          {sonidoActivo ? '🔊' : '🔇'}
        </button>
      </div>

      {/* Panel de notificaciones */}
      {abierto && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', width: 390,
          background: 'white', borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          border: '1px solid #e5e7eb', zIndex: 500, overflow: 'hidden',
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Notificaciones {noLeidas > 0 && <span style={{ color: '#dc2626' }}>({noLeidas})</span>}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {noLeidas > 0 && (
                <button onClick={marcarTodas}
                  style={{ fontSize: '0.75rem', color: 'var(--azul)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Marcar todas leídas
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: '0.875rem' }}>
                🔔 Sin notificaciones
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id} style={{
                padding: '0.875rem 1.25rem',
                borderBottom: '1px solid #f9fafb',
                background: n.leida ? 'white' : '#eff6ff',
                transition: 'background 0.2s',
              }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{iconoPorTipo(n.tipo)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: n.leida ? 400 : 700, fontSize: '0.875rem', marginBottom: 2 }}>
                      {n.titulo}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.mensaje}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>
                      {formatFecha(n.fecha)}
                    </div>
                    {!n.leida && (
                      <button
                        onClick={() => handleRellenar(n)}
                        style={{
                          marginTop: 6, background: '#111', color: 'white',
                          border: 'none', borderRadius: 20, padding: '4px 14px',
                          fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                        }}>
                        📋 Rellenar
                      </button>
                    )}
                  </div>
                  {!n.leida && (
                    <span style={{ width: 8, height: 8, background: 'var(--azul)', borderRadius: '50%', flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS para animación de la campana */}
      <style>{`
        @keyframes campanaTilt {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(12deg); }
          20%  { transform: rotate(-10deg); }
          30%  { transform: rotate(8deg); }
          40%  { transform: rotate(-6deg); }
          50%  { transform: rotate(4deg); }
          60%  { transform: rotate(-2deg); }
          70%  { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
