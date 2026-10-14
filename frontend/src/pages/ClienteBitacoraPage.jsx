import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import api from '../api/client'
import CampanaNotificaciones from '../components/CampanaNotificaciones'
import ChatTicketModal, { BotonChat } from '../components/ChatTicketModal'
import ResumenCalificacion from '../components/ResumenCalificacion'
import { pedirCalificacion } from '../components/CalificacionGlobal'
import useAutoRefresh from '../hooks/useAutoRefresh'
import LineaTiempoEstatus from '../components/LineaTiempoEstatus'

const ETIQUETAS = { pendiente: 'Pendiente', atendido: 'En camino', proceso: 'Reparando', terminado: 'Finalizado' }

function TicketCard({ t, onUpdated, onOpenChat }) {
  const finalizado = t.estatus === 'terminado'
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ tipo_unidad: t.tipo_unidad || '', unidad: t.unidad || '', reparacion: t.reparacion || '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [respondiendo, setRespondiendo] = useState(false)

  const solicitudPendiente = !!t.finalizacion_solicitada && !finalizado

  const responderFinalizacion = async (acepta) => {
    setRespondiendo(true)
    try {
      await api.post(`/tickets/${t.id}/responder_finalizacion/`, { acepta })
      onUpdated()
    } catch (e) { setError(e.response?.data?.error || 'No se pudo registrar tu respuesta.') }
    finally { setRespondiendo(false) }
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

  return (
    <div className="card" id={`ticket-${t.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '1.2rem', letterSpacing: 1 }}>{t.ticket_id || 'Por asignar'}</span>
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

      {/* La línea de tiempo por estatus no aplica a servicios directos con técnico,
          ya que nadie actualiza esos pasos — solo se muestra si ya se sumó un coordinador. */}
      {(t.tipo_solicitud !== 'tecnico' || t.coordinador_nombre) && (
        <LineaTiempoEstatus estatus={t.estatus} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: '0.85rem', color: '#374151', marginTop: 4 }}>
        <span>👷 Técnico: <strong>{t.tecnico_nombre || 'Aún no asignado'}</strong></span>
        <span>🧑‍💼 Coordinador: <strong>{t.coordinador_nombre || 'Aún no asignado'}</strong></span>
        <span>📅 {t.fecha}</span>
      </div>

      {solicitudPendiente && (
        <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#92400e' }}>
          ⏳ Tu coordinador solicita finalizar este servicio. ¿Ya puede finalizarse?
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={respondiendo} onClick={() => responderFinalizacion(true)}>✅ Sí, finalizar</button>
            <button className="btn btn-ghost btn-sm" disabled={respondiendo} onClick={() => responderFinalizacion(false)}>↩️ No, aún no</button>
          </div>
        </div>
      )}

      {finalizado && t.puede_calificar && (
        <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#92400e' }}>
          ⭐ Tu servicio ya fue finalizado. ¿Nos ayudas calificando al técnico?
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => pedirCalificacion(t.id)}>⭐ Calificar técnico</button>
          </div>
        </div>
      )}
      {t.calificacion_detalle && (
        <div style={{ marginTop: 12 }}>
          <ResumenCalificacion detalle={t.calificacion_detalle} tecnicoNombre={t.tecnico_nombre} titulo="Tu calificación" />
        </div>
      )}

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

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
        <BotonChat ticket={t} onClick={() => onOpenChat(t)} />
      </div>
    </div>
  )
}

export default function ClienteBitacoraPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [toastError, setToastError] = useState('')
  const [ticketChat, setTicketChat] = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()

  const fetchTickets = () => {
    return api.get('/tickets/')
      .then(({ data }) => setTickets(data.results || data))
      .catch(() => setToastError('No se pudieron cargar tus tickets.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTickets() }, [])

  // Actualización automática cada 5 s (sin avisos de error: un corte breve de red no molesta).
  // Las tarjetas conservan lo que el cliente esté escribiendo o editando.
  useAutoRefresh(() => api.get('/tickets/').then(({ data }) => setTickets(data.results || data)), { soloVisible: true })

  // ?ticket=ID (viene de una notificación): baja hasta ese servicio
  useEffect(() => {
    const id = searchParams.get('ticket')
    if (!id || loading) return
    document.getElementById(`ticket-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setSearchParams({}, { replace: true })
  }, [searchParams, loading, setSearchParams])

  return (
    <div className="dashboard-layout" style={{ position: 'relative', paddingBottom: '70px' }}>
      <style>{`
        /* ═════════ Camión pequeño que cruza toda la pantalla ═════════ */
        .truck-lane {
          position: fixed; bottom: 0; left: 0; width: 100vw; height: 50px;
          overflow: hidden; pointer-events: none; z-index: 10;
        }
        .truck-mover {
          position: absolute; bottom: 4px; left: 0; width: 160px; height: 85px;
          animation: driveAcross 14s linear infinite;
        }
        @keyframes driveAcross {
          from { transform: translateX(-180px); }
          to   { transform: translateX(100vw); }
        }
        .truck-scaler {
          position: absolute; bottom: 0; left: 0; width: 160px; height: 85px;
          transform: scale(0.42); transform-origin: bottom left;
        }
        .truck-animado {
          position: absolute; bottom: 0; left: 0; width: 160px; height: 85px;
          animation: bounceTruck 0.6s ease-in-out infinite alternate;
        }
        @keyframes bounceTruck {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-3px); }
        }
        .truck-box { position: absolute; left: 0; top: 10px; width: 95px; height: 50px; background: #f05443; border: 2.5px solid #222; border-radius: 4px; }
        .truck-box-stripe { position: absolute; top: 16px; left: 0; width: 95px; height: 14px; background: #6b6b6b; border-top: 2px solid #222; border-bottom: 2px solid #222; }
        .truck-cab { position: absolute; left: 93px; top: 22px; width: 45px; height: 38px; background: #f3d4a0; border: 2.5px solid #222; border-top-left-radius: 14px; border-top-right-radius: 8px; border-bottom-right-radius: 4px; }
        .truck-window { position: absolute; top: 6px; left: 6px; width: 22px; height: 16px; background: #fff; border: 2px solid #222; border-top-left-radius: 10px; }
        .truck-base { position: absolute; bottom: 12px; left: 15px; width: 115px; height: 10px; background: #f05443; border: 2px solid #222; border-radius: 2px; }
        .wheel-custom { width: 24px; height: 24px; background: #222; border: 3px solid #fff; border-radius: 50%; position: absolute; bottom: 0; box-shadow: 0 0 0 2px #222; animation: spin 0.8s linear infinite; }
        .wheel-custom.left { left: 30px; }
        .wheel-custom.right { left: 102px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .truck-mover, .truck-animado, .wheel-custom { animation: none; }
          .truck-mover { transform: translateX(40px); }
        }
      `}</style>

      <Sidebar />
      <Toast show={!!toastError} tipo="error" titulo="Ups" mensaje={toastError} onClose={() => setToastError('')} />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">🧑‍💼 Bitácora</h1>
            <p className="page-subtitle">Historial de todos tus servicios solicitados</p>
          </div>
          <CampanaNotificaciones onAbrirChat={setTicketChat} />
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
              <TicketCard key={t.id} t={t} onUpdated={fetchTickets} onOpenChat={setTicketChat} />
            ))}
          </div>
        )}
      </main>
      <div className="truck-lane" aria-hidden="true">
        <div className="truck-mover">
          <div className="truck-scaler">
            <div className="truck-animado">
              <div className="truck-box"><div className="truck-box-stripe"></div></div>
              <div className="truck-cab"><div className="truck-window"></div></div>
              <div className="truck-base"></div>
              <div className="wheel-custom left"></div>
              <div className="wheel-custom right"></div>
            </div>
          </div>
        </div>
      </div>
      {ticketChat && (
        <ChatTicketModal
          ticket={ticketChat}
          onClose={() => setTicketChat(null)}
          onRead={fetchTickets}
        />
      )}
    </div>
  )
}
