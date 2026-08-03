import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import api from '../api/client'

const PASOS = ['pendiente', 'atendido', 'proceso', 'terminado']
const ETIQUETAS = { pendiente: 'Pendiente', atendido: 'En camino', proceso: 'Reparando', terminado: 'Finalizado' }

function PasosTicket({ estatus }) {
  const indiceActual = PASOS.indexOf(estatus)
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '0.75rem 0' }}>
      {PASOS.map((paso, i) => (
        <div key={paso} style={{ display: 'flex', alignItems: 'center', flex: i < PASOS.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 700,
              background: i <= indiceActual ? '#1a56db' : '#e5e7eb',
              color: i <= indiceActual ? 'white' : '#9ca3af',
            }}>
              {i < indiceActual ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.68rem', marginTop: 4, color: i <= indiceActual ? '#111827' : '#9ca3af', textAlign: 'center' }}>
              {ETIQUETAS[paso]}
            </span>
          </div>
          {i < PASOS.length - 1 && (
            <div style={{ flex: 1, height: 3, background: i < indiceActual ? '#1a56db' : '#e5e7eb', marginBottom: 16 }} />
          )}
        </div>
      ))}
    </div>
  )
}

function TicketCard({ t, onUpdated }) {
  const finalizado = t.estatus === 'terminado'
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ tipo_unidad: t.tipo_unidad || '', unidad: t.unidad || '', reparacion: t.reparacion || '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [comentario, setComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)

  const formatFecha = f => {
    if (!f) return '—'
    const d = new Date(f)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      await api.patch(`/tickets/${t.id}/`, form)
      setEditando(false)
      onUpdated()
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo guardar el cambio.')
    } finally { setGuardando(false) }
  }

  const enviarComentario = async () => {
    if (!comentario.trim()) return
    setEnviandoComentario(true)
    try {
      await api.post(`/tickets/${t.id}/agregar_comentario/`, { texto: comentario.trim() })
      setComentario('')
      onUpdated()
    } catch { /* silencioso */ }
    finally { setEnviandoComentario(false) }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '1.2rem', letterSpacing: 1 }}>{t.ticket_id}</span>
          <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: 10 }}>
            {t.tipo_unidad ? `${t.tipo_unidad} — ` : ''}{t.unidad} • {t.lugar || 'Sin ubicación'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge badge-${t.estatus}`}>{t.estatus_display || ETIQUETAS[t.estatus] || t.estatus}</span>
          {!finalizado && (
            <button className="btn btn-sm btn-ghost" onClick={() => setEditando(v => !v)} title="Editar unidad / descripción">
              {editando ? '✕ Cancelar' : '✏️ Editar'}
            </button>
          )}
        </div>
      </div>

      <PasosTicket estatus={t.estatus} />

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: '0.85rem', color: '#374151', marginTop: 4 }}>
        <span>👷 Técnico: <strong>{t.tecnico_nombre || 'Aún no asignado'}</strong></span>
        <span>🧑‍💼 Coordinador: <strong>{t.coordinador_nombre || 'Aún no asignado'}</strong></span>
        <span>📅 {t.fecha}</span>
      </div>

      {editando && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e5e7eb', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '6px 10px', borderRadius: 6, fontSize: '0.8rem' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Tipo de unidad</label>
            <input className="form-input" value={form.tipo_unidad} onChange={e => setForm({ ...form, tipo_unidad: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Unidad</label>
            <input className="form-input" value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción del problema</label>
            <textarea className="form-input" rows={3} style={{ resize: 'none' }}
              value={form.reparacion} onChange={e => setForm({ ...form, reparacion: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-sm" disabled={guardando} onClick={guardar} style={{ alignSelf: 'flex-start' }}>
            {guardando ? 'Guardando...' : '💾 Guardar cambios'}
          </button>
        </div>
      )}

      {t.reparacion && !editando && (
        <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#4b5563' }}>
          <strong style={{ color: '#374151' }}>Descripción:</strong> {t.reparacion}
        </div>
      )}

      {t.comentarios?.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {t.comentarios.map(c => (
            <div key={c.id} style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              <strong style={{ color: '#374151' }}>{formatFecha(c.fecha)}</strong> — {c.texto}
            </div>
          ))}
        </div>
      )}

      {!finalizado ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Escribe un comentario para tu coordinador..."
            value={comentario} onChange={e => setComentario(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enviarComentario()} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" disabled={enviandoComentario || !comentario.trim()} onClick={enviarComentario}>
            {enviandoComentario ? '...' : '📨 Enviar'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
          🔒 Servicio finalizado — ya no se pueden agregar comentarios ni editar este ticket.
        </div>
      )}
    </div>
  )
}

export default function ClienteBitacoraPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [toastError, setToastError] = useState('')

  const fetchTickets = () => {
    api.get('/tickets/')
      .then(({ data }) => setTickets(data.results || data))
      .catch(() => setToastError('No se pudieron cargar tus tickets.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTickets() }, [])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <Toast show={!!toastError} tipo="error" titulo="Ups" mensaje={toastError} onClose={() => setToastError('')} />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">🧑‍💼 Bitácora</h1>
          <p className="page-subtitle">Historial de todos tus servicios solicitados</p>
        </div>

        {loading ? (
          <div className="loader"><div className="spinner" /></div>
        ) : tickets.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            Aún no has realizado ninguna solicitud de servicio.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {tickets.map(t => (
              <TicketCard key={t.id} t={t} onUpdated={fetchTickets} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
