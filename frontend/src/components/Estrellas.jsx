import { useState } from 'react'

export const ETIQUETAS_ESTRELLAS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']

/**
 * Estrellas de 1 a 5.
 *  - Con `onChange` son seleccionables (mouse, toque o teclado).
 *  - Sin `onChange` (o con soloLectura) solo se muestran.
 */
export default function Estrellas({ valor = 0, onChange, soloLectura = false, tamano = 36, etiqueta, mostrarTexto = true }) {
  const [hover, setHover] = useState(0)
  const editable = !!onChange && !soloLectura
  const visible = hover || valor

  return (
    <div>
      <div
        role={editable ? 'radiogroup' : 'img'}
        aria-label={etiqueta || 'Calificación'}
        aria-valuetext={!editable ? `${valor} de 5 estrellas` : undefined}
        style={{ display: 'inline-flex', gap: 4 }}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map(n => {
          const llena = n <= visible
          const estilo = {
            fontSize: tamano, lineHeight: 1, padding: 0, background: 'none', border: 'none',
            color: llena ? '#f59e0b' : '#d1d5db',
            cursor: editable ? 'pointer' : 'default',
            transition: 'transform 0.12s, color 0.12s',
            transform: editable && hover === n ? 'scale(1.18)' : 'scale(1)',
          }
          return editable ? (
            <button
              key={n} type="button" role="radio" aria-checked={valor === n}
              aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${ETIQUETAS_ESTRELLAS[n]}`}
              style={estilo}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(n)}
            >★</button>
          ) : (
            <span key={n} aria-hidden="true" style={estilo}>★</span>
          )
        })}
      </div>
      {mostrarTexto && editable && (
        <div style={{ minHeight: 20, marginTop: 4, fontSize: '0.8rem', fontWeight: 600, color: visible ? '#b45309' : '#9ca3af' }}>
          {visible ? ETIQUETAS_ESTRELLAS[visible] : 'Toca una estrella'}
        </div>
      )}
    </div>
  )
}