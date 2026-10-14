import { useEffect, useRef, useState } from 'react'

export const PASOS = ['pendiente', 'atendido', 'proceso', 'terminado']
export const ETIQUETAS = { pendiente: 'Pendiente', atendido: 'En camino', proceso: 'Reparando', terminado: 'Finalizado' }

const MS_VIAJE = 1800 // lo que tarda el camión en llegar al siguiente paso

const ESTILOS = `
  .td-camion svg { display: block; overflow: visible; }
  .td-rueda { transform-box: fill-box; transform-origin: center; }
  .td-camion.andando .td-rueda { animation: td-giro 0.45s linear infinite; }
  .td-camion.andando svg { animation: td-rebote 0.28s ease-in-out infinite alternate; }
  @keyframes td-giro { to { transform: rotate(360deg); } }
  @keyframes td-rebote { from { transform: translateY(0); } to { transform: translateY(-1.5px); } }
`

function Camion({ ancho, andando, direccion }) {
  return (
    <div className={`td-camion${andando ? ' andando' : ''}`}
         style={{ width: ancho, transform: `scaleX(${direccion})`, transition: 'transform 0.3s' }}>
      <svg viewBox="0 0 44 26" width={ancho} aria-hidden="true">
        <rect x="1" y="2" width="26" height="15" rx="2" fill="#f05443" stroke="#222" strokeWidth="1.6" />
        <rect x="1" y="6" width="26" height="4" fill="#6b6b6b" stroke="#222" strokeWidth="1" />
        <path d="M27 6 H37 L43 12 V17 H27 Z" fill="#f3d4a0" stroke="#222" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M30 8 H36 L39 12 H30 Z" fill="#fff" stroke="#222" strokeWidth="1" />
        <g className="td-rueda"><circle cx="9" cy="20" r="4.2" fill="#222" /><path d="M9 16.4 V23.6 M5.4 20 H12.6" stroke="#fff" strokeWidth="1" /></g>
        <g className="td-rueda"><circle cx="34" cy="20" r="4.2" fill="#222" /><path d="M34 16.4 V23.6 M30.4 20 H37.6" stroke="#fff" strokeWidth="1" /></g>
      </svg>
    </div>
  )
}

/**
 * Línea de tiempo del servicio por estatus, con un camioncito que "camina" hasta el nuevo paso
 * cada vez que el estatus cambia (también cuando se actualiza solo por el refresco automático).
 * `compacto` = versión pequeña para tablas.
 */
export default function LineaTiempoEstatus({ estatus, compacto = false }) {
  const n = PASOS.length
  const indice = Math.max(0, PASOS.indexOf(estatus))
  const previo = useRef(indice)
  const [andando, setAndando] = useState(false)
  const [direccion, setDireccion] = useState(1)

  useEffect(() => {
    if (previo.current === indice) return undefined
    setDireccion(indice > previo.current ? 1 : -1)
    previo.current = indice
    setAndando(true)
    const t = setTimeout(() => setAndando(false), MS_VIAJE + 150)
    return () => clearTimeout(t)
  }, [indice])

  if (compacto) {
    const izquierda = `${((indice + 0.5) / n) * 100}%`
    return (
      <div style={{ position: 'relative', marginTop: 16 }}>
        <style>{ESTILOS}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {PASOS.map((p, i) => (
            <div key={p} title={ETIQUETAS[p]}
                 style={{ flex: 1, height: 4, borderRadius: 2, background: i <= indice ? '#1a56db' : '#e5e7eb' }} />
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 3, left: izquierda, marginLeft: -11, pointerEvents: 'none',
                      transition: `left ${MS_VIAJE}ms ease-in-out` }}>
          <Camion ancho={22} andando={andando} direccion={direccion} />
        </div>
      </div>
    )
  }

  const porcentaje = (indice / (n - 1)) * 100
  return (
    <div style={{ position: 'relative', margin: '2.6rem 40px 2.8rem', height: 26 }}>
      <style>{ESTILOS}</style>
      <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 3, background: '#e5e7eb', borderRadius: 2 }} />
      <div style={{ position: 'absolute', top: 11, left: 0, width: `${porcentaje}%`, height: 3, background: '#1a56db',
                    borderRadius: 2, transition: `width ${MS_VIAJE}ms ease-in-out` }} />
      {PASOS.map((paso, i) => (
        <div key={paso} style={{ position: 'absolute', left: `${(i / (n - 1)) * 100}%`, top: 0, transform: 'translateX(-50%)',
                                 display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700, transition: `background ${MS_VIAJE}ms, color ${MS_VIAJE}ms`,
            background: i <= indice ? '#1a56db' : '#e5e7eb', color: i <= indice ? 'white' : '#9ca3af',
          }}>
            {i < indice ? '✓' : i + 1}
          </div>
          <span style={{ position: 'absolute', top: 30, whiteSpace: 'nowrap', fontSize: '0.68rem',
                         color: i <= indice ? '#111827' : '#9ca3af' }}>
            {ETIQUETAS[paso]}
          </span>
        </div>
      ))}
      <div style={{ position: 'absolute', left: `${porcentaje}%`, top: -28, marginLeft: -19, pointerEvents: 'none',
                    transition: `left ${MS_VIAJE}ms ease-in-out` }}>
        <Camion ancho={38} andando={andando} direccion={direccion} />
      </div>
    </div>
  )
}
