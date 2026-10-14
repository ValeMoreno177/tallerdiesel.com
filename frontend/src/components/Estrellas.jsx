import { useState } from 'react'

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
