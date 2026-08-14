import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import AsignarTecnicoModal from './AsignarTecnicoModal'

export default function ModalDetalleTicket({ ticket, onClose, onUpdated, soloLectura = false }) {
  const { user } = useAuth()
  const [comentario,   setComentario]   = useState('')
  const [enviando,     setEnviando]     = useState(false)
  const [localTicket,  setLocalTicket]  = useState(ticket)
  const [permisoCargando, setPermisoCargando] = useState(false)
  const [asignandoTecnico, setAsignandoTecnico] = useState(false)

  const fmt = n => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  const esTerminado = localTicket.estatus === 'terminado'
  const tienePermisoEdicion = localTicket.puede_editar_coordinador

  // Coordinador puede comentar si admin le dio permiso en este ticket cerrado
  // Admin siempre puede, cliente puede mientras el ticket no esté finalizado
  const puedeComentar = !soloLectura && (
    user?.rol === 'admin' ||
    (user?.rol === 'coordinador' && (!esTerminado || tienePermisoEdicion)) ||
    (user?.rol === 'cliente' && !esTerminado)
  )
  const bloqueado = !puedeComentar

  // Admin y Coordinador pueden asignar/cambiar el técnico de un ticket que no esté finalizado.
  // El Cliente también puede, pero solo en su propio ticket de tipo "directo con técnico".
  const puedeAsignarTecnico = !soloLectura && (
    user?.rol === 'admin' ||
    (user?.rol === 'coordinador' && (!esTerminado || tienePermisoEdicion)) ||
    (user?.rol === 'cliente' && localTicket.tipo_solicitud === 'tecnico' && !esTerminado)
  )

  // El Coordinador puede "tomar" un servicio que iba directo con técnico (por ejemplo,
  // cuando el cliente lo pide en un comentario), y así pasa a mostrar seguimiento por estatus.
  const [tomandoServicio, setTomandoServicio] = useState(false)
  const puedeTomarComoCoordinador = !soloLectura && user?.rol === 'coordinador' && !esTerminado
    && localTicket.tipo_solicitud === 'tecnico' && !localTicket.coordinador_nombre

  const tomarComoCoordinador = async () => {
    setTomandoServicio(true)
    try {
      const { data } = await api.post(`/tickets/${localTicket.id}/tomar_como_coordinador/`, {})
      setLocalTicket(data)
      onUpdated && onUpdated()
    } catch (e) {
      alert('No se pudo tomar el servicio. ' + (e?.response?.data?.error || ''))
    } finally { setTomandoServicio(false) }
  }

  const ROL_COLOR = { cliente: '#0DE255', coordinador: '#2563eb', admin: '#111827', tecnico: '#f59e0b' }
  const ROL_LABEL = { cliente: 'Cliente', coordinador: 'Coordinador', admin: 'Admin', tecnico: 'Técnico' }

  const enviarComentario = async () => {
    if (!comentario.trim()) return
    setEnviando(true)
    try {
      const { data } = await api.post(`/tickets/${localTicket.id}/agregar_comentario/`, { texto: comentario })
      setLocalTicket(t => ({ ...t, comentarios: [...(t.comentarios || []), data] }))
      setComentario('')
      if (onUpdated) onUpdated()
    } catch { } finally { setEnviando(false) }
  }

  const togglePermisoCoordinador = async () => {
    if (user?.rol !== 'admin') return
    setPermisoCargando(true)
    try {
      const { data } = await api.post(`/tickets/${localTicket.id}/permitir_edicion_coordinador/`, {
        activar: !tienePermisoEdicion
      })
      setLocalTicket(t => ({ ...t, puede_editar_coordinador: data.puede_editar_coordinador }))
      if (onUpdated) onUpdated()
    } catch { } finally { setPermisoCargando(false) }
  }

  const formatFecha = (f) => {
    if (!f) return '—'
    const d = new Date(f)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1e3a5f 100%)', padding: '1.25rem 1.5rem', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: '1.5rem', letterSpacing: 2 }}>{localTicket.ticket_id}</span>
                <span className={`badge badge-${localTicket.estatus}`}>{localTicket.estatus_display || localTicket.estatus}</span>
                {esTerminado && <span style={{ background: '#dc2626', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>🔒 CERRADO</span>}
                {esTerminado && tienePermisoEdicion && (
                  <span style={{ background: '#059669', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>✏️ EDITABLE</span>
                )}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>{localTicket.empresa} • {localTicket.unidad}</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>

          {/* Admin: toggle permiso para coordinador en ticket cerrado */}
          {user?.rol === 'admin' && esTerminado && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={togglePermisoCoordinador}
                disabled={permisoCargando}
                style={{
                  background: tienePermisoEdicion ? '#dc2626' : '#059669',
                  color: 'white', border: 'none', borderRadius: 20,
                  padding: '5px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer'
                }}>
                {permisoCargando ? '...' : tienePermisoEdicion ? '🔒 Revocar permiso al Coordinador' : '✏️ Permitir edición al Coordinador'}
              </button>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                {tienePermisoEdicion ? 'El Coordinador puede editar este ticket' : 'Solo lectura para el Coordinador'}
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Info general */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.85rem', color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Información general</h4>
              {[
                ['Folio', localTicket.ticket_id],
                ['Empresa', localTicket.empresa],
                ['Unidad', localTicket.unidad],
                ['Operador', localTicket.operador || '—'],
                ['Lugar', localTicket.lugar || '—'],
                ['Fecha', localTicket.fecha],
                ['Coordinador', localTicket.coordinador_nombre || '—'],
                ['Técnico asignado', localTicket.tecnico_nombre || 'Aún no asignado'],
                ['Proveedor', localTicket.proveedor_nombre || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>{k}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
              {puedeAsignarTecnico && (
                <button className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => setAsignandoTecnico(true)}>
                  🔧 {localTicket.tecnico_nombre ? 'Cambiar técnico' : 'Asignar técnico'}
                </button>
              )}
              {puedeTomarComoCoordinador && (
                <button className="btn btn-sm btn-ghost" style={{ marginTop: 8, marginLeft: 8 }}
                  onClick={tomarComoCoordinador} disabled={tomandoServicio}>
                  🧑‍💼 {tomandoServicio ? 'Tomando...' : 'Tomar como coordinador'}
                </button>
              )}
            </div>

            {/* Financiero */}
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.85rem', color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Información financiera</h4>
              {[
                ['Costo Total', fmt(localTicket.costo_total), false],
                ['Ganancia Total', fmt(localTicket.ganancia_total), false, '#059669'],
                ['Total', fmt(localTicket.total), true],
                ['IVA 16%', fmt(localTicket.iva), false, '#d97706'],
                ['Total Final', fmt(localTicket.total_final), true, '#1e40af'],
                ['Factura', localTicket.no_factura || '—', false],
                ['Fecha factura', localTicket.fecha_factura || '—', false],
              ].map(([k, v, bold, color]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>{k}</span>
                  <span style={{ fontWeight: bold ? 700 : 400, color: color || '#111' }}>{v}</span>
                </div>
              ))}
              {localTicket.est_factura && (
                <div style={{ marginTop: 8 }}>
                  <span className={`badge badge-${localTicket.est_factura}`}>{localTicket.est_factura}</span>
                </div>
              )}
            </div>
          </div>

          {/* Descripción */}
          {localTicket.reparacion && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Descripción / Reparación</h4>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '0.875rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#374151' }}>
                {localTicket.reparacion}
              </div>
            </div>
          )}

          {/* Historial / Comentarios */}
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.85rem', color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>
              Historial y comentarios
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', maxHeight: 200, overflowY: 'auto' }}>
              {(!localTicket.comentarios || localTicket.comentarios.length === 0) && (
                <div style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>Sin comentarios aún</div>
              )}
              {localTicket.comentarios?.map(c => (
                <div key={c.id} style={{ background: c.es_cambio_estatus ? '#fffbeb' : '#f9fafb', borderRadius: 8, padding: '0.625rem 0.875rem', border: `1px solid ${c.es_cambio_estatus ? '#fef3c7' : '#f3f4f6'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: c.es_cambio_estatus ? '#92400e' : '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!c.es_cambio_estatus && c.autor_rol && (
                        <span title={ROL_LABEL[c.autor_rol] || c.autor_rol}
                          style={{ width: 8, height: 8, borderRadius: '50%', background: ROL_COLOR[c.autor_rol] || '#9ca3af', flexShrink: 0, display: 'inline-block' }} />
                      )}
                      {c.es_cambio_estatus ? '🔄' : '💬'} {c.autor_nombre}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{formatFecha(c.fecha)}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>{c.texto}</div>
                </div>
              ))}
            </div>

            {!bloqueado && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input className="form-input" placeholder="Escribe un comentario..."
                  value={comentario} onChange={e => setComentario(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && enviarComentario()}
                  style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={enviarComentario} disabled={enviando || !comentario.trim()}>
                  {enviando ? '...' : 'Enviar'}
                </button>
              </div>
            )}
            {esTerminado && !tienePermisoEdicion && user?.rol !== 'admin' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#991b1b' }}>
                {user?.rol === 'cliente'
                  ? '🔒 Este servicio está finalizado. Ya no se pueden agregar comentarios.'
                  : '🔒 Este ticket está finalizado. El Administrador puede habilitarte la edición si lo necesitas.'}
              </div>
            )}
            {esTerminado && tienePermisoEdicion && user?.rol === 'coordinador' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#065f46', marginTop: 6 }}>
                ✏️ El Administrador te ha dado permiso de editar este ticket cerrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {asignandoTecnico && (
        <AsignarTecnicoModal
          ticketId={localTicket.id}
          ticketFolio={localTicket.ticket_id}
          ticketInfo={{
            empresa: localTicket.empresa,
            lugar: localTicket.lugar,
            unidad: localTicket.unidad,
            tecnico_nombre: localTicket.tecnico_nombre,
          }}
          onClose={() => setAsignandoTecnico(false)}
          onAsignado={async () => {
            setAsignandoTecnico(false)
            try {
              const { data } = await api.get(`/tickets/${localTicket.id}/`)
              setLocalTicket(data)
            } catch (e) { /* si falla el refetch, igual se refresca la lista de fondo */ }
            onUpdated && onUpdated()
          }}
        />
      )}
    </div>
  )
}
