import { useState, useEffect } from 'react'
import api from '../api/client'

export default function AsignarTecnicoModal({ solicitud, onClose, onAsignado }) {
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

  const ticketId = solicitud.ticket
  const ticketFolio = solicitud.ticket_codigo

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
        <h3 className="modal-title">Asignar técnico</h3>
        <p className="modal-subtitle">
          {ticketFolio ? `Ticket ${ticketFolio} — ` : ''}{solicitud.nombre_completo}
        </p>

        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#374151' }}>
          {solicitud.empresa && <div><strong>Empresa:</strong> {solicitud.empresa}</div>}
          {solicitud.lugar && <div><strong>Lugar:</strong> {solicitud.lugar}</div>}
          {solicitud.unidad && <div><strong>Unidad:</strong> {solicitud.unidad}</div>}
          <div><strong>Teléfono:</strong> {solicitud.telefono}</div>
          <div style={{ marginTop: 6 }}>{solicitud.problema}</div>
        </div>

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
          Al asignar un técnico, el ticket pasará automáticamente a estatus <strong>En camino</strong> y el
          nombre del técnico se mostrará al cliente.
        </p>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={asignar} disabled={guardando || !tecnicoId}>
            {guardando ? 'Asignando...' : 'Asignar técnico'}
          </button>
        </div>
      </div>
    </div>
  )
}
