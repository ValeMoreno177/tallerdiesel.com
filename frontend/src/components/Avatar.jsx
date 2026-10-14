import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import { CATEGORIA_LEYENDA, CATEGORIA_ICONO, CATEGORIA_COLOR } from '../utils/tecnicoIcons'

export default function AsignarTecnicoModal({ solicitud, ticketId: ticketIdProp, ticketFolio: ticketFolioProp, ticketInfo, onClose, onAsignado }) {
  const [tecnicos, setTecnicos] = useState([])
  const [tecnicoId, setTecnicoId] = useState('')
  const [loadingTecnicos, setLoadingTecnicos] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  useEffect(() => {
    api.get('/tecnicos/')
      .then(({ data }) => setTecnicos(data.results || data))
      .finally(() => setLoadingTecnicos(false))
  }, [])

  // Se puede abrir con una "solicitud" (flujo original) o directo con un ticket
  const ticketId = ticketIdProp || solicitud?.ticket
  const ticketFolio = ticketFolioProp || solicitud?.ticket_codigo
  const info = ticketInfo || solicitud

  const tecnicosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return tecnicos.filter(t => {
      const pasaCategoria = !categoriaFiltro || t.categoria === categoriaFiltro
      const pasaBusqueda = !q || t.nombre?.toLowerCase().includes(q) || t.ciudad?.toLowerCase().includes(q) || t.estado?.toLowerCase().includes(q)
      return pasaCategoria && pasaBusqueda
    })
  }, [tecnicos, busqueda, categoriaFiltro])

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
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
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
          <label className="form-label">Buscar técnico</label>
          <input
            type="text" className="form-input" placeholder="Nombre, ciudad o estado..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          {/* Filtro por categoría, igual que en el mapa */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <button type="button" onClick={() => setCategoriaFiltro('')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20,
                fontSize: '0.75rem', cursor: 'pointer', border: '1px solid ' + (categoriaFiltro === '' ? '#111827' : '#e5e7eb'),
                background: categoriaFiltro === '' ? '#111827' : 'white', color: categoriaFiltro === '' ? 'white' : '#374151',
              }}>
              Todas
            </button>
            {CATEGORIA_LEYENDA.map(c => (
              <button key={c.value} type="button" onClick={() => setCategoriaFiltro(categoriaFiltro === c.value ? '' : c.value)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20,
                  fontSize: '0.75rem', cursor: 'pointer',
                  border: '1px solid ' + (categoriaFiltro === c.value ? CATEGORIA_COLOR[c.value] : '#e5e7eb'),
                  background: categoriaFiltro === c.value ? CATEGORIA_COLOR[c.value] : 'white',
                  color: categoriaFiltro === c.value ? 'white' : '#374151',
                }}>
                <span>{CATEGORIA_ICONO[c.value]}</span> {c.label}
              </button>
            ))}
          </div>

          {loadingTecnicos ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Cargando técnicos...</div>
          ) : tecnicosFiltrados.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', padding: '1rem 0', textAlign: 'center' }}>
              No hay técnicos que coincidan con la búsqueda.
            </div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
              {tecnicosFiltrados.map(t => {
                const seleccionado = String(tecnicoId) === String(t.id)
                return (
                  <div key={t.id} onClick={() => setTecnicoId(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
                      background: seleccionado ? '#eff6ff' : 'white',
                      borderBottom: '1px solid #f3f4f6',
                    }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      background: t.disponible ? (CATEGORIA_COLOR[t.categoria] || '#6b7280') : '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                    }}>{CATEGORIA_ICONO[t.categoria] || '🔨'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{t.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {t.categoria_display || t.categoria} · {t.ciudad}{t.estado ? `, ${t.estado}` : ''}
                        {' · '}{t.disponible ? <span style={{ color: '#059669' }}>Disponible</span> : <span style={{ color: '#dc2626' }}>Ocupado</span>}
                      </div>
                    </div>
                    {seleccionado && <span style={{ color: '#2563eb', fontSize: '1rem' }}>✓</span>}
                  </div>
                )
              })}
            </div>
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
