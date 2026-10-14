import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/client'
import Estrellas from './Estrellas'
import { reproducirCelebracion } from '../context/NotificacionesContext'

const MAX_COMENTARIO = 500
const DURACION_FUEGOS = 3500 // ms que dura el espectáculo
const CIERRE_CON_FUEGOS = 4200 // ms antes de cerrar la ventana para que se alcancen a ver

const COLORES = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#fde047']

/** Fuegos artificiales a pantalla completa. No bloquea clics. Llama onFin al terminar. */
function FuegosArtificiales({ duracion = DURACION_FUEGOS, onFin }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const ajustar = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    ajustar()
    window.addEventListener('resize', ajustar)

    let particulas = []
    let raf
    const inicio = performance.now()
    let ultimoDisparo = 0

    const explotar = () => {
      const x = canvas.width * (0.15 + Math.random() * 0.7)
      const y = canvas.height * (0.15 + Math.random() * 0.4)
      const color = COLORES[Math.floor(Math.random() * COLORES.length)]
      for (let i = 0; i < 90; i++) {
        const ang = (Math.PI * 2 * i) / 90
        const vel = 1.5 + Math.random() * 4
        particulas.push({
          x, y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel,
          vida: 1,
          color,
        })
      }
    }

    const frame = (t) => {
      const transcurrido = t - inicio

      // Estela: desvanece el cuadro anterior sin tapar la página
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'lighter'

      if (transcurrido < duracion - 1000 && t - ultimoDisparo > 350) {
        explotar()
        ultimoDisparo = t
      }

      particulas = particulas.filter(p => p.vida > 0)
      for (const p of particulas) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.04 // gravedad
        p.vx *= 0.985
        p.vida -= 0.012
        ctx.globalAlpha = Math.max(p.vida, 0)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (transcurrido < duracion || particulas.length > 0) {
        raf = requestAnimationFrame(frame)
      } else {
        onFin?.()
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', ajustar)
    }
  }, [duracion, onFin])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}
    />
  )
}

/**
 * Ventana para que el cliente califique un servicio finalizado:
 *  - estrellas al técnico (solo si el servicio tuvo técnico) — obligatorio
 *  - estrellas al servicio realizado — obligatorio
 *  - comentario — opcional
 * Al enviar, da las gracias y lanza fuegos artificiales (sea buena o mala la calificación).
 *
 * `pendiente` = { id, ticket_id, tecnico_nombre, unidad, tipo_unidad }
 */
export default function ModalCalificacion({ pendiente, onEnviado }) {
  const tieneTecnico = !!pendiente.tecnico_nombre
  const [calTecnico, setCalTecnico] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [fuegos, setFuegos] = useState(true)
  const terminarFuegos = useCallback(() => setFuegos(false), [])

  const listo = tieneTecnico && calTecnico > 0

  // Tras agradecer (y ver los fuegos artificiales), se cierra sola
  useEffect(() => {
    if (!enviado) return undefined
    const espera = CIERRE_CON_FUEGOS
    const t = setTimeout(() => onEnviado(pendiente.id), espera)
    return () => clearTimeout(t)
  }, [enviado, onEnviado, pendiente.id])

  const enviar = async () => {
    if (!listo) return
    setEnviando(true); setError('')
    try {
      await api.post(`/tickets/${pendiente.id}/calificar/`, {
        calificacion_tecnico: calTecnico,
        comentario: comentario.trim(),
      })
      setEnviado(true)
      reproducirCelebracion()
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo enviar tu calificación. Intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      {enviado && fuegos && <FuegosArtificiales onFin={terminarFuegos} />}
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="td-cal-titulo"
           style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1e3a5f 100%)', color: 'white', padding: '1.25rem 1.5rem' }}>
          <div id="td-cal-titulo" style={{ fontWeight: 700, fontSize: '1.15rem' }}>
            {enviado ? '🎉 ¡Gracias por tu opinión!' : '⭐ ¿Cómo te fue con tu servicio?'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginTop: 2 }}>
            Servicio {pendiente.ticket_id}
            {pendiente.unidad ? ` • ${pendiente.tipo_unidad ? pendiente.tipo_unidad + ' ' : ''}${pendiente.unidad}` : ''}
          </div>
        </div>

        {enviado ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <p style={{ marginTop: 8, color: '#374151' }}>Tu calificación del técnico nos ayuda a mejorar.</p>
          </div>
        ) : (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {tieneTecnico && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  👷 Califica al técnico: <span style={{ color: '#1a56db' }}>{pendiente.tecnico_nombre}</span>
                </div>
                <Estrellas valor={calTecnico} onChange={setCalTecnico} etiqueta={`Calificación del técnico ${pendiente.tecnico_nombre}`} />
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="td-cal-comentario">
                Comentario <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                id="td-cal-comentario" className="form-input" rows={3} style={{ resize: 'none' }}
                maxLength={MAX_COMENTARIO} value={comentario}
                placeholder="Cuéntanos qué tal estuvo la atención, el tiempo de respuesta, la reparación…"
                onChange={e => setComentario(e.target.value)}
              />
              <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#9ca3af' }}>{comentario.length}/{MAX_COMENTARIO}</div>
            </div>
            {error && (
              <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>{error}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-primary" disabled={!listo || enviando} onClick={enviar}>
                {enviando ? 'Enviando...' : 'Enviar calificación'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
