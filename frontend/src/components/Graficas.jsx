// Gráficas ligeras hechas con SVG (sin librerías extra), con los colores de la marca.
//   <GraficaMeses datos={[{ mes: '2026-10', total: 1200, ganancia: 300 }, ...]} />
//   <GraficaDona partes={[{ etiqueta: 'Finalizados', valor: 12, color: '#059669' }, ...]} />
//   <GraficaTecnicos datos={[{ tecnico: 'Juan', tickets: 4, calificacion_promedio: 4.5 }, ...]} />
import { useState } from 'react'

const NARANJA = '#e85d04'
const MARINO = '#111827'
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const dinero = n => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
const dineroCorto = n => {
  const v = Number(n || 0)
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`
  return `$${v.toFixed(0)}`
}
const nombreMes = clave => {
  const [a, m] = String(clave).split('-')
  return m ? `${MESES[Number(m) - 1] || m} ${String(a).slice(2)}` : String(clave)
}

const ESTILOS = `
  .graf-barra { transform-box: fill-box; transform-origin: bottom; animation: grafCrece 0.7s cubic-bezier(.2,.9,.3,1.1) both; }
  .graf-hbarra { transform-box: fill-box; transform-origin: left; animation: grafCreceH 0.7s cubic-bezier(.2,.9,.3,1.1) both; }
  .graf-arco { animation: grafArco 0.9s ease-out both; }
  @keyframes grafCrece { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes grafCreceH { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes grafArco { from { stroke-dasharray: 0 999; } }
  .graf-leyenda { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.75rem; color: #6b7280; margin-top: 8px; }
  .graf-leyenda i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .graf-vacio { color: #9ca3af; font-size: 0.85rem; text-align: center; padding: 2rem 0; }
  html[data-tema="oscuro"] .graf-eje { fill: #94a3b8; }
  html[data-tema="oscuro"] .graf-linea { stroke: #1f2937; }
  @media (prefers-reduced-motion: reduce) { .graf-barra, .graf-hbarra, .graf-arco { animation: none; } }
`

export function GraficaMeses({ datos = [], titulo = 'Facturación por mes' }) {
  const [sel, setSel] = useState(null)
  const filas = [...datos]
    .map(f => ({ ...f, clave: f.clave || f.mes }))
    .sort((a, b) => String(a.clave).localeCompare(String(b.clave))).slice(-6)
  const max = Math.max(1, ...filas.map(f => Number(f.total) || 0))
  const W = 520, H = 220, IZQ = 44, ABAJO = 26, ARRIBA = 14
  const alto = H - ABAJO - ARRIBA
  const ancho = (W - IZQ) / Math.max(1, filas.length)
  const lineas = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="card">
      <style>{ESTILOS}</style>
      <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>{titulo}</h3>
      {filas.length === 0 ? <div className="graf-vacio">Aún no hay meses con servicios.</div> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
            aria-label={`${titulo}: ` + filas.map(f => `${nombreMes(f.clave)} ${dinero(f.total)}`).join(', ')}>
            {lineas.map(p => {
              const y = ARRIBA + alto * (1 - p)
              return (
                <g key={p}>
                  <line className="graf-linea" x1={IZQ} x2={W} y1={y} y2={y} stroke="#eef0f3" />
                  <text className="graf-eje" x={IZQ - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{dineroCorto(max * p)}</text>
                </g>
              )
            })}
            {filas.map((f, i) => {
              const x = IZQ + i * ancho
              const bw = Math.min(26, ancho * 0.3)
              const hT = alto * ((Number(f.total) || 0) / max)
              const hG = alto * ((Number(f.ganancia) || 0) / max)
              const activo = sel === i
              return (
                <g key={f.clave} onMouseEnter={() => setSel(i)} onMouseLeave={() => setSel(null)} style={{ cursor: 'default' }}>
                  <rect x={x} y={ARRIBA} width={ancho} height={alto} fill={activo ? 'rgba(232,93,4,0.06)' : 'transparent'} />
                  <rect className="graf-barra" style={{ animationDelay: `${i * 0.07}s` }}
                    x={x + ancho / 2 - bw - 2} y={ARRIBA + alto - hT} width={bw} height={hT} rx="4" fill={MARINO} />
                  <rect className="graf-barra" style={{ animationDelay: `${i * 0.07 + 0.1}s` }}
                    x={x + ancho / 2 + 2} y={ARRIBA + alto - hG} width={bw} height={hG} rx="4" fill={NARANJA} />
                  <text className="graf-eje" x={x + ancho / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b7280">{nombreMes(f.clave)}</text>
                  {activo && (
                    <g>
                      <rect x={Math.min(x + ancho / 2 - 62, W - 128)} y={ARRIBA + alto - hT - 46} width="124" height="40" rx="6" fill={MARINO} opacity="0.95" />
                      <text x={Math.min(x + ancho / 2, W - 66)} y={ARRIBA + alto - hT - 30} textAnchor="middle" fontSize="10.5" fill="#fff">Total {dinero(f.total)}</text>
                      <text x={Math.min(x + ancho / 2, W - 66)} y={ARRIBA + alto - hT - 15} textAnchor="middle" fontSize="10.5" fill="#fdba74">Ganancia {dinero(f.ganancia)}</text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
          <div className="graf-leyenda">
            <span><i style={{ background: MARINO }} />Total facturado</span>
            <span><i style={{ background: NARANJA }} />Ganancia</span>
          </div>
        </>
      )}
    </div>
  )
}

export function GraficaDona({ partes = [], titulo = 'Servicios por estatus' }) {
  const total = partes.reduce((s, p) => s + (Number(p.valor) || 0), 0)
  const R = 54, C = 2 * Math.PI * R
  let acumulado = 0
  return (
    <div className="card">
      <style>{ESTILOS}</style>
      <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>{titulo}</h3>
      {total === 0 ? <div className="graf-vacio">Sin servicios todavía.</div> : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <svg viewBox="0 0 140 140" width="140" height="140" role="img"
            aria-label={`${titulo}: ` + partes.map(p => `${p.etiqueta} ${p.valor}`).join(', ')}>
            <circle cx="70" cy="70" r={R} fill="none" stroke="#eef0f3" strokeWidth="18" className="graf-linea" />
            {partes.filter(p => p.valor > 0).map((p, i) => {
              const largo = (p.valor / total) * C
              const arco = (
                <circle key={p.etiqueta} className="graf-arco" style={{ animationDelay: `${i * 0.12}s` }}
                  cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="18"
                  strokeDasharray={`${Math.max(0, largo - 2)} ${C}`} strokeDashoffset={-acumulado}
                  transform="rotate(-90 70 70)" strokeLinecap="butt" />
              )
              acumulado += largo
              return arco
            })}
            <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill="currentColor">{total}</text>
            <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#9ca3af">servicios</text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140 }}>
            {partes.map(p => (
              <div key={p.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block' }} />
                <span style={{ flex: 1 }}>{p.etiqueta}</span>
                <strong>{p.valor}</strong>
                <span style={{ color: '#9ca3af', width: 40, textAlign: 'right' }}>{Math.round((p.valor / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function GraficaTecnicos({ datos = [], titulo = 'Técnicos con más servicios' }) {
  const filas = [...datos].filter(f => (f.tickets || 0) > 0).sort((a, b) => (b.tickets || 0) - (a.tickets || 0)).slice(0, 6)
  const max = Math.max(1, ...filas.map(f => f.tickets || 0))
  return (
    <div className="card">
      <style>{ESTILOS}</style>
      <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>{titulo}</h3>
      {filas.length === 0 ? <div className="graf-vacio">Aún no hay técnicos con servicios.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filas.map((f, i) => (
            <div key={f.tecnico}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{f.tecnico}</span>
                <span style={{ color: '#6b7280' }}>
                  {f.tickets} {f.tickets === 1 ? 'servicio' : 'servicios'}
                  {f.calificacion_promedio ? <span style={{ color: '#f59e0b', marginLeft: 8 }}>★ {Number(f.calificacion_promedio).toFixed(1)}</span> : null}
                </span>
              </div>
              <svg viewBox="0 0 100 8" width="100%" height="10" preserveAspectRatio="none" aria-hidden="true">
                <rect x="0" y="0" width="100" height="8" rx="4" fill="#eef0f3" className="graf-linea" />
                <rect className="graf-hbarra" style={{ animationDelay: `${i * 0.08}s` }}
                  x="0" y="0" width={(f.tickets / max) * 100} height="8" rx="4" fill={i === 0 ? NARANJA : MARINO} />
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Agrupa una lista de tickets por mes (para el dashboard del coordinador). */
export function ticketsPorMes(tickets = []) {
  const meses = {}
  tickets.forEach(t => {
    const clave = String(t.fecha || '').slice(0, 7)
    if (!clave) return
    meses[clave] = meses[clave] || { mes: clave, total: 0, ganancia: 0 }
    meses[clave].total += Number(t.total) || 0
    meses[clave].ganancia += Number(t.ganancia) || 0
  })
  return Object.values(meses)
}
