import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { CARAS_CALIFICACION } from './Estrellas'

// Calificaciones y reseñas de un técnico, al estilo de Play Store:
//   - Resumen: promedio grande, estrellas, total de reseñas y barras de 5★ a 1★.
//   - Reseñas: avatar con iniciales, nombre, estrellas, fecha y comentario.
// En el mapa (compacto) se ven el resumen y las 2 reseñas más recientes; "Ver todas" abre
// una ventana con todas las reseñas y filtro por número de estrellas.
// Uso: <ResenasTecnico tecnico={t} />  (t.opiniones viene del endpoint /tecnicos/)

const NARANJA = '#e85d04'
const AMARILLO = '#f59e0b'
const COLORES_AVATAR = ['#e85d04', '#111827', '#2563eb', '#059669', '#7c3aed', '#db2777', '#0891b2']

const estrellasDe = op => Number(op.calificacion ?? op.calificacion_servicio) || 0

// Solo nombre e inicial del apellido: "Juan Pérez López" → "Juan P."
function nombreCorto(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return 'Cliente'
  return partes.length > 1 ? `${partes[0]} ${partes[1][0].toUpperCase()}.` : partes[0]
}

function iniciales(nombre) {
  const p = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'C'
}

function colorAvatar(nombre) {
  let h = 0
  for (const c of String(nombre || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORES_AVATAR[h % COLORES_AVATAR.length]
}

function fecha(valor) {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Estrellitas({ valor, tamano = 14 }) {
  return (
    <span role="img" aria-label={`${valor} de 5 estrellas`} style={{ display: 'inline-flex', gap: 1, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map(n => {
        const lleno = Math.max(0, Math.min(1, valor - (n - 1)))   // permite medias estrellas en el promedio
        return (
          <span key={n} aria-hidden="true" style={{ position: 'relative', fontSize: tamano, color: '#d1d5db' }}>
            ★
            <span style={{ position: 'absolute', left: 0, top: 0, width: `${lleno * 100}%`, overflow: 'hidden', color: AMARILLO }}>★</span>
          </span>
        )
      })}
    </span>
  )
}

function Resumen({ promedio, total, conteo, onFiltrar, filtro }) {
  const max = Math.max(1, ...Object.values(conteo))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ textAlign: 'center', minWidth: 76 }}>
        <div style={{ fontSize: '2.6rem', fontWeight: 700, lineHeight: 1, color: '#111827' }}>
          {total ? promedio.toFixed(1) : '—'}
        </div>
        <Estrellitas valor={promedio} tamano={13} />
        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 3 }}>
          {total} {total === 1 ? 'reseña' : 'reseñas'}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[5, 4, 3, 2, 1].map(n => {
          const activo = filtro === n
          const fila = (
            <>
              <span style={{ width: 10, fontSize: '0.72rem', color: '#4b5563', textAlign: 'right' }}>{n}</span>
              <span style={{ flex: 1, height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                <span style={{
                  display: 'block', height: '100%', borderRadius: 999,
                  width: `${(conteo[n] / max) * 100}%`, background: activo ? NARANJA : AMARILLO,
                  transition: 'width 0.4s ease',
                }} />
              </span>
            </>
          )
          return onFiltrar ? (
            <button key={n} type="button" onClick={() => onFiltrar(activo ? null : n)}
              title={`Ver reseñas de ${n} estrellas (${conteo[n]})`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
              {fila}
            </button>
          ) : (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{fila}</div>
          )
        })}
      </div>
    </div>
  )
}

// Respuesta del taller a una reseña. Admin y Coordinador pueden escribirla, cambiarla o borrarla.
function RespuestaTaller({ op, permitirResponder }) {
  const { user } = useAuth()
  const esStaff = permitirResponder && ['admin', 'coordinador'].includes(user?.rol)
  const [respuesta, setRespuesta] = useState(op.respuesta || '')
  const [fechaResp, setFechaResp] = useState(op.respuesta_fecha || null)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(op.respuesta || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      const { data } = await api.post('/tecnicos/responder_resena/', { opinion_id: op.id, respuesta: texto })
      setRespuesta(data.respuesta || ''); setFechaResp(data.respuesta_fecha || null); setEditando(false)
    } catch (e) { setError(e?.response?.data?.error || 'No se pudo guardar la respuesta.') }
    finally { setGuardando(false) }
  }

  if (editando) {
    return (
      <div style={{ marginTop: 8 }}>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} maxLength={1000}
          placeholder="Escribe una respuesta amable para el cliente…" aria-label="Respuesta a la reseña"
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d1d5db', padding: '8px 10px', font: 'inherit', fontSize: '0.8rem' }} />
        {error && <div style={{ color: '#b91c1c', fontSize: '0.72rem' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEditando(false); setTexto(respuesta) }}>Cancelar</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : texto.trim() ? 'Publicar respuesta' : 'Borrar respuesta'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {respuesta && (
        <div style={{ marginTop: 8, marginLeft: 12, padding: '8px 10px', background: '#fff7ed', borderLeft: `3px solid ${NARANJA}`, borderRadius: 8 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9a3412' }}>
            Respuesta de TallerDiesel <span style={{ fontWeight: 400, color: '#9ca3af' }}>· {fecha(fechaResp)}</span>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#374151', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{respuesta}</p>
        </div>
      )}
      {esStaff && (
        <button type="button" onClick={() => { setTexto(respuesta); setEditando(true) }}
          style={{ marginTop: 6, background: 'none', border: 0, padding: 0, color: NARANJA, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
          {respuesta ? '✏️ Editar respuesta' : '💬 Responder'}
        </button>
      )}
    </>
  )
}

function Resena({ op, permitirResponder = false }) {
  const [abierta, setAbierta] = useState(false)
  const texto = (op.comentario || '').trim()
  const largo = texto.length > 140
  return (
    <article style={{ padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700,
          fontSize: '0.72rem', background: colorAvatar(op.nombre_autor),
        }}>{iniciales(op.nombre_autor)}</span>
        <strong style={{ fontSize: '0.82rem', color: '#111827' }}>{nombreCorto(op.nombre_autor)}</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0 3px' }}>
        <Estrellitas valor={estrellasDe(op)} tamano={12} />
        {CARAS_CALIFICACION[Math.round(estrellasDe(op))] && (
          <span title={CARAS_CALIFICACION[Math.round(estrellasDe(op))].texto} style={{ fontSize: 14 }}>
            {CARAS_CALIFICACION[Math.round(estrellasDe(op))].emoji}
          </span>
        )}
        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{fecha(op.fecha)}</span>
      </div>
      {texto ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#374151', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {largo && !abierta ? `${texto.slice(0, 140)}…` : texto}
          {largo && (
            <button type="button" onClick={() => setAbierta(v => !v)}
              style={{ background: 'none', border: 0, color: NARANJA, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0 0 0 4px' }}>
              {abierta ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Sin comentario</p>
      )}
      <RespuestaTaller op={op} permitirResponder={permitirResponder} />
    </article>
  )
}

function VentanaResenas({ tecnico, ops, promedio, conteo, onClose }) {
  const [filtro, setFiltro] = useState(null)
  const [orden, setOrden] = useState('recientes')

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const lista = useMemo(() => {
    let l = filtro ? ops.filter(o => estrellasDe(o) === filtro) : [...ops]
    if (orden === 'altas') l.sort((a, b) => estrellasDe(b) - estrellasDe(a))
    if (orden === 'bajas') l.sort((a, b) => estrellasDe(a) - estrellasDe(b))
    return l
  }, [ops, filtro, orden])

  const chip = (activo) => ({
    border: `1px solid ${activo ? NARANJA : '#d1d5db'}`, background: activo ? '#fff1e6' : 'white',
    color: activo ? NARANJA : '#374151', borderRadius: 999, padding: '4px 11px', fontSize: '0.75rem',
    cursor: 'pointer', fontWeight: activo ? 600 : 400,
  })

  return createPortal(
    <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <section role="dialog" aria-modal="true" aria-label={`Calificaciones y reseñas de ${tecnico.nombre}`}
        style={{ width: 'min(100%, 480px)', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          background: 'white', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
          background: '#111827', color: 'white', borderBottom: `3px solid ${NARANJA}` }}>
          <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', background: NARANJA, fontSize: '1.1rem' }}>🔧</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block' }}>{tecnico.nombre}</strong>
            <span style={{ fontSize: '0.75rem', color: '#fdba74' }}>Calificaciones y reseñas</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            style={{ background: 'rgba(255,255,255,0.1)', border: 0, color: 'white', width: 32, height: 32,
              borderRadius: '50%', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </header>
        <div style={{ padding: 16, overflowY: 'auto' }}>
          <Resumen promedio={promedio} total={ops.length} conteo={conteo} onFiltrar={setFiltro} filtro={filtro} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 6px' }}>
            <button type="button" style={chip(!filtro)} onClick={() => setFiltro(null)}>Todas</button>
            {[5, 4, 3, 2, 1].map(n => (
              <button key={n} type="button" style={chip(filtro === n)} onClick={() => setFiltro(filtro === n ? null : n)}>
                {n} ★
              </button>
            ))}
            <select value={orden} onChange={e => setOrden(e.target.value)} aria-label="Ordenar reseñas"
              style={{ marginLeft: 'auto', border: '1px solid #d1d5db', borderRadius: 999, padding: '4px 10px', fontSize: '0.75rem' }}>
              <option value="recientes">Más recientes</option>
              <option value="altas">Mejor calificadas</option>
              <option value="bajas">Peor calificadas</option>
            </select>
          </div>
          {lista.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '18px 0' }}>
              No hay reseñas con {filtro} {filtro === 1 ? 'estrella' : 'estrellas'}.
            </p>
          )}
          {lista.map(op => <Resena key={op.id} op={op} permitirResponder />)}
        </div>
      </section>
    </div>,
    document.body,
  )
}

export default function ResenasTecnico({ tecnico, maxVisibles = 2, soloResumen = false }) {
  const [verTodas, setVerTodas] = useState(false)

  const { ops, promedio, conteo } = useMemo(() => {
    const lista = (tecnico?.opiniones || [])
      .filter(o => estrellasDe(o) >= 1)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    lista.forEach(o => { c[Math.min(5, Math.max(1, Math.round(estrellasDe(o))))] += 1 })
    const prom = lista.length ? lista.reduce((s, o) => s + estrellasDe(o), 0) / lista.length : 0
    return { ops: lista, promedio: prom, conteo: c }
  }, [tecnico])

  // Versión chiquita junto al nombre: "4.0 ★★★★☆ (6)". Al darle clic abre todas las reseñas.
  if (soloResumen) {
    return (
      <>
        <button type="button" onClick={() => ops.length && setVerTodas(true)} disabled={!ops.length}
          title={ops.length ? 'Ver calificaciones y reseñas' : 'Sin reseñas todavía'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, padding: '2px 8px',
            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999,
            cursor: ops.length ? 'pointer' : 'default', fontSize: '0.75rem', color: '#111827' }}>
          <strong>{ops.length ? promedio.toFixed(1) : '—'}</strong>
          <Estrellitas valor={promedio} tamano={12} />
          <span style={{ color: '#6b7280' }}>({ops.length})</span>
        </button>
        {verTodas && (
          <VentanaResenas tecnico={tecnico} ops={ops} promedio={promedio} conteo={conteo} onClose={() => setVerTodas(false)} />
        )}
      </>
    )
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        Calificaciones y reseñas
      </div>
      {ops.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>
          ⭐ Aún no tiene reseñas. ¡Sé el primero en calificarlo al terminar tu servicio!
        </p>
      ) : (
        <>
          <Resumen promedio={promedio} total={ops.length} conteo={conteo} />
          <div style={{ marginTop: 8 }}>
            {ops.slice(0, maxVisibles).map(op => <Resena key={op.id} op={op} />)}
          </div>
          <button type="button" onClick={() => setVerTodas(true)}
              style={{ marginTop: 4, background: 'none', border: 0, padding: 0, color: NARANJA,
                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
              Ver todas las reseñas ({ops.length}) →
            </button>
        </>
      )}
      {verTodas && (
        <VentanaResenas tecnico={tecnico} ops={ops} promedio={promedio} conteo={conteo} onClose={() => setVerTodas(false)} />
      )}
    </div>
  )
}
