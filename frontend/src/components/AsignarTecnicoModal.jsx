import { useState, useEffect } from 'react'
import api from '../api/client'

export default function AsignarTecnicoModal({ solicitud, ticketId: ticketIdProp, ticketFolio: ticketFolioProp, ticketInfo, onClose, onAsignado }) {
  const [tecnicos, setTecnicos] = useState([])
  const [tecnicoId, setTecnicoId] = useState('')
  const [loadingTecnicos, setLoadingTecnicos] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/tecnicos/')
      .then(({ data }) => setTecnicos(data.results || data))
      .finally(() => setLoadingTecnicos(false))
  }, [])

  // Se puede abrir con una "solicitud" (flujo original) o directo con un ticket
  const ticketId = ticketIdProp || solicitud?.ticket
  const ticketFolio = ticketFolioProp || solicitud?.ticket_codigo
  const info = ticketInfo || solicitud

  const asignar = async () => {
    if (!tecnicoId) { setError('Selecciona un técnico.'); return }
    if (!ticketId) { setError('Esta solicitud no tiene un ticket asociado.'); return }
    setGuardando(true); setError('')
    try {
      await api.post(`/tickets/${ticketId}/asignar_tecnico/`, { tecnico_id: tecnicoId })
      onAsignado()
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo asignar el técnico.')
    } finally { setGuardando(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{info?.tecnico_nombre ? 'Cambiar técnico' : 'Asignar técnico'}</h3>
        <p className="modal-subtitle">
          {ticketFolio ? `Ticket ${ticketFolio} — ` : ''}{info?.nombre_completo || info?.empresa || ''}
        </p>

        {info && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#374151' }}>
            {info.empresa && <div><strong>Empresa:</strong> {info.empresa}</div>}
            {info.lugar && <div><strong>Lugar:</strong> {info.lugar}</div>}
            {info.unidad && <div><strong>Unidad:</strong> {info.unidad}</div>}
            {info.telefono && <div><strong>Teléfono:</strong> {info.telefono}</div>}
            {info.tecnico_nombre && <div style={{ marginTop: 4 }}><strong>Técnico actual:</strong> {info.tecnico_nombre}</div>}
            {(info.problema || info.reparacion) && <div style={{ marginTop: 6 }}>{info.problema || info.reparacion}</div>}
          </div>
        )}

        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 14px', borderRadius: 8, marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</div>}

        <div className="form-group">
          <label className="form-label">Técnico</label>
          {loadingTecnicos ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Cargando técnicos...</div>
          ) : (
            <select className="form-select" value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}>
              <option value="">Selecciona un técnico...</option>
              {tecnicos.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nombre} — {t.categoria_display || t.categoria} ({t.ciudad})
                </option>
              ))}
            </select>
          )}
        </div>

        <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>
          {info?.tecnico_nombre
            ? 'El nuevo técnico sustituirá al actual y se le mostrará al cliente.'
            : 'Al asignar un técnico, el ticket pasará automáticamente a estatus En camino y el nombre del técnico se mostrará al cliente.'}
        </p>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={asignar} disabled={guardando || !tecnicoId}>
            {guardando ? 'Guardando...' : info?.tecnico_nombre ? 'Cambiar técnico' : 'Asignar técnico'}
          </button>
        </div>
      </div>
    </div>
  )
}
