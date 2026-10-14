import { useState, useEffect, useRef, useCallback } from 'react'
import Estrellas from './Estrellas'

const COLORES = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#fde047']

/** Fuegos artificiales a pantalla completa. No bloquea clics. Llama onFin al terminar. */
function FuegosArtificiales({ duracion = 4000, onFin }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    // Respeta a quienes tienen desactivadas las animaciones
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onFin?.()
      return
    }

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
      for (let i = 0; i < 70; i++) {
        const ang = (Math.PI * 2 * i) / 70
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

      if (transcurrido < duracion - 1000 && t - ultimoDisparo > 450) {
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
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2)
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
 * Calificación ya enviada por el cliente (solo lectura): estrellas al técnico y al servicio + comentario.
 * Con `celebrar` muestra el agradecimiento y lanza fuegos artificiales
 * (úsalo justo después de que el cliente envía su calificación).
 */
export default function ResumenCalificacion({
  detalle,
  tecnicoNombre,
  titulo = 'Calificación del cliente',
  celebrar = false,
}) {
  const [fuegos, setFuegos] = useState(celebrar)
  const terminarFuegos = useCallback(() => setFuegos(false), [])

  if (!detalle) return null
  return (
    <>
      {celebrar && fuegos && <FuegosArtificiales onFin={terminarFuegos} />}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#78350f' }}>
        {celebrar && (
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>
            🎉 ¡Gracias por tu calificación!
          </div>
        )}
        <div style={{ fontWeight: 700, marginBottom: 6 }}>⭐ {titulo}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
          {detalle.calificacion_tecnico != null && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Técnico{tecnicoNombre ? `: ${tecnicoNombre}` : ''}</div>
              <Estrellas valor={detalle.calificacion_tecnico} soloLectura tamano={20} etiqueta="Calificación del técnico" />
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Servicio</div>
            <Estrellas valor={detalle.calificacion_servicio} soloLectura tamano={20} etiqueta="Calificación del servicio" />
          </div>
        </div>
        {detalle.comentario && (
          <div style={{ marginTop: 6, fontStyle: 'italic', color: '#57534e' }}>“{detalle.comentario}”</div>
        )}
      </div>
    </>
  )
}
