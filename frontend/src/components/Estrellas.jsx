import { useState } from 'react'

// Cara y texto según las estrellas: las calificaciones bajas llevan caras TRISTES.
export const CARAS_CALIFICACION = {
  1: { emoji: '😭', texto: 'Muy malo', color: '#dc2626' },
  2: { emoji: '😞', texto: 'Malo', color: '#ea580c' },
  3: { emoji: '😐', texto: 'Regular', color: '#ca8a04' },
  4: { emoji: '😊', texto: 'Bueno', color: '#16a34a' },
  5: { emoji: '🤩', texto: '¡Excelente!', color: '#059669' },
}
export const esCalificacionMala = n => Number(n) > 0 && Number(n) <= 2

/** Cara grande que cambia (con un pequeño salto) según la calificación elegida. */
export function CaraCalificacion({ valor, tamano = 44 }) {
  const cara = CARAS_CALIFICACION[Math.round(Number(valor))]
  if (!cara) return null
  return (
    <span key={valor} role="img" aria-label={cara.texto}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, animation: 'caraSalta 0.35s ease-out' }}>
      <style>{`@keyframes caraSalta { 0% { transform: scale(0.4); opacity: 0 } 70% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { [aria-label="${cara.texto}"] { animation: none !important; } }`}</style>
      <span style={{ fontSize: tamano, lineHeight: 1 }}>{cara.emoji}</span>
      <span style={{ fontWeight: 700, color: cara.color, fontSize: Math.max(13, tamano * 0.36) }}>{cara.texto}</span>
    </span>
  )
}

// Calificación con estrellas (1 a 5).
// Editable:   <Estrellas valor={n} onChange={setN} etiqueta="Calificación del técnico" />
// Solo vista: <Estrellas valor={4} soloLectura tamano={20} etiqueta="Calificación del servicio" />
export default function Estrellas({ valor = 0, onChange, soloLectura = false, tamano = 32, etiqueta = 'Calificación' }) {
  const [hover, setHover] = useState(0)
  const actual = hover || Number(valor) || 0

  if (soloLectura) {
    return (
      <span role="img" aria-label={`${etiqueta}: ${Number(valor) || 0} de 5`} style={{ display: 'inline-flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} aria-hidden="true" style={{ fontSize: tamano, lineHeight: 1, color: n <= actual ? '#f59e0b' : '#d1d5db' }}>★</span>
        ))}
      </span>
    )
  }

  return (
    <div role="radiogroup" aria-label={etiqueta} style={{ display: 'inline-flex', gap: 4 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={Number(valor) === n}
          aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          onClick={() => onChange && onChange(n)} onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)} onBlur={() => setHover(0)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: tamano, lineHeight: 1, color: n <= actual ? '#f59e0b' : '#d1d5db' }}>
          ★
        </button>
      ))}
    </div>
  )
}
