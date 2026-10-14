import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import api from '../api/client'
import { crearIconoTecnico, CATEGORIA_LEYENDA, CATEGORIA_ICONO, CATEGORIA_COLOR } from '../utils/tecnicoIcons'

const CENTRO_MEXICO = [23.6345, -102.5528]

// Marcador rojo del lugar del servicio (no depende de imágenes externas)
const iconoServicio = L.divIcon({
  className: '',
  html: '<div style="font-size:30px;line-height:30px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))">📍</div>',
  iconSize: [30, 30], iconAnchor: [15, 30],
})

// Clic en el mapa = mover la ubicación del servicio
function ClicEnMapa({ onClic }) {
  useMapEvents({ click: (e) => onClic([e.latlng.lat, e.latlng.lng]) })
  return null
}

// Acerca el mapa cuando cambia la ubicación o el técnico elegido
function Enfocar({ punto, zoom }) {
  const map = useMap()
  useEffect(() => { if (punto) map.flyTo(punto, zoom ?? map.getZoom(), { duration: 0.6 }) }, [punto?.[0], punto?.[1]])  // eslint-disable-line
  return null
}

const estrellas = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))

/**
 * Reasignar (o asignar) el técnico de un ticket eligiéndolo en un mapa interactivo.
 *  - Marca dónde está el servicio (clic en el mapa, buscar el lugar, o la ubicación ya guardada).
 *  - Ordena a los técnicos por distancia y muestra su calificación y si están disponibles.
 * Se usa igual que el modal anterior: ticketId/ticketFolio/ticketInfo (o solicitud), onClose, onAsignado.
 */
export default function MapaReasignarTecnicoModal({ solicitud, ticketId: ticketIdProp, ticketFolio: ticketFolioProp, ticketInfo, onClose, onAsignado }) {
  const ticketId = ticketIdProp || solicitud?.ticket
  const ticketFolio = ticketFolioProp || solicitud?.ticket_codigo
  const info = ticketInfo || solicitud

  const [tecnicos, setTecnicos] = useState([])
  const [ubicacion, setUbicacion] = useState(null)        // [lat, lng] del servicio
  const [cargando, setCargando] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Carga los técnicos (con distancia si ya hay ubicación). Se repite al mover el punto en el mapa.
  useEffect(() => {
    if (!ticketId) { setCargando(false); setError('Esta solicitud no tiene un ticket asociado.'); return undefined }
    let vivo = true
    const params = ubicacion ? { lat: ubicacion[0], lng: ubicacion[1] } : {}
    api.get(`/tickets/${ticketId}/tecnicos_cercanos/`, { params })
      .then(({ data }) => {
        if (!vivo) return
        setTecnicos(data.tecnicos)
        if (!ubicacion && data.ubicacion) setUbicacion([data.ubicacion.latitud, data.ubicacion.longitud])
      })
      .catch(() => vivo && setError('No se pudieron cargar los técnicos.'))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [ticketId, ubicacion?.[0], ubicacion?.[1]])  // eslint-disable-line

  const visibles = useMemo(() => tecnicos.filter(t =>
    (!soloDisponibles || t.disponible) && (!categoria || t.categoria === categoria)), [tecnicos, soloDisponibles, categoria])
  const elegido = tecnicos.find(t => t.id === seleccionado)
  const centro = ubicacion || (elegido ? [elegido.latitud, elegido.longitud] : CENTRO_MEXICO)

  // Busca en el mapa el lugar escrito en el ticket (OpenStreetMap / Nominatim)
  const buscarLugar = async () => {
    const q = (info?.lugar || '').trim()
    if (!q) { setError('El ticket no tiene un lugar escrito. Haz clic en el mapa para marcarlo.'); return }
    setBuscando(true); setError('')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=${encodeURIComponent(q)}`)
      const lista = await res.json()
      if (!lista.length) { setError(`No encontré «${q}» en el mapa. Haz clic para marcarlo.`); return }
      setUbicacion([parseFloat(lista[0].lat), parseFloat(lista[0].lon)])
    } catch {
      setError('No se pudo buscar el lugar. Haz clic en el mapa para marcarlo.')
    } finally { setBuscando(false) }
  }

  const asignar = async () => {
    if (!elegido) { setError('Selecciona un técnico en el mapa o en la lista.'); return }
    setGuardando(true); setError('')
    try {
      await api.post(`/tickets/${ticketId}/asignar_tecnico/`, {
        tecnico_id: elegido.id,
        ...(ubicacion ? { latitud: ubicacion[0], longitud: ubicacion[1] } : {}),
      })
      onAsignado()
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo asignar el técnico.')
    } finally { setGuardando(false) }
  }

  const hayActual = tecnicos.some(t => t.es_actual)
  const titulo = hayActual ? 'Reasignar técnico' : 'Asignar técnico'

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}
           style={{ maxWidth: 960, width: '96vw' }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">🗺️ {titulo}</h3>
        <p className="modal-subtitle">
          {ticketFolio ? `Ticket ${ticketFolio} — ` : ''}{info?.nombre_completo || info?.empresa || ''}
          {info?.lugar ? ` · ${info.lugar}` : ''}
        </p>

        {error && <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 14px', borderRadius: 8, marginBottom: 10, fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={buscarLugar} disabled={buscando}>
            {buscando ? 'Buscando...' : '🔎 Ubicar «lugar» del ticket'}
          </button>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            {ubicacion ? '📍 Servicio marcado. Haz clic en el mapa para moverlo.' : 'Haz clic en el mapa para marcar dónde está el servicio y ver los técnicos más cercanos.'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', marginRight: 8 }}>
            <input type="checkbox" checked={soloDisponibles} onChange={e => setSoloDisponibles(e.target.checked)} /> Solo disponibles
          </label>
          <select className="form-input" style={{ width: 'auto', padding: '2px 8px', fontSize: '0.78rem' }}
                  value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {CATEGORIA_LEYENDA.map(c => <option key={c.value} value={c.value}>{CATEGORIA_ICONO[c.value]} {c.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {/* ── Mapa ── */}
          <div style={{ height: 380, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <MapContainer center={centro} zoom={ubicacion ? 9 : 5} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ClicEnMapa onClic={setUbicacion} />
              <Enfocar punto={ubicacion} zoom={9} />
              {ubicacion && <Marker position={ubicacion} icon={iconoServicio} zIndexOffset={1000}><Popup>📍 Ubicación del servicio</Popup></Marker>}
              {visibles.map(t => (
                <Marker key={t.id} position={[t.latitud, t.longitud]} icon={crearIconoTecnico(t.categoria, t.disponible)}
                        eventHandlers={{ click: () => setSeleccionado(t.id) }}>
                  <Popup>
                    <strong>{t.nombre}</strong><br />
                    {t.categoria_display} · {t.ciudad}<br />
                    <span style={{ color: '#f59e0b' }}>{estrellas(t.calificacion)}</span> {t.calificacion.toFixed(1)}<br />
                    {t.disponible ? '🟢 Disponible' : '🔴 Ocupado'}
                    {t.distancia_km != null && <><br />A {t.distancia_km} km del servicio</>}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* ── Lista ordenada por distancia ── */}
          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
            {cargando ? (
              <div style={{ padding: '1rem', fontSize: '0.85rem', color: '#9ca3af' }}>Cargando técnicos...</div>
            ) : visibles.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: '0.85rem', color: '#9ca3af', textAlign: 'center' }}>No hay técnicos con esos filtros.</div>
            ) : visibles.map(t => {
              const activo = t.id === seleccionado
              return (
                <button type="button" key={t.id} onClick={() => setSeleccionado(t.id)} aria-pressed={activo}
                  style={{ display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
                           background: activo ? '#eff6ff' : 'white', border: 'none', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                                 background: t.disponible ? (CATEGORIA_COLOR[t.categoria] || '#6b7280') : '#9ca3af' }}>{CATEGORIA_ICONO[t.categoria] || '🔨'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>
                      {t.nombre}{t.es_actual && <span style={{ marginLeft: 6, fontSize: '0.68rem', background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: 10 }}>Actual</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280' }}>
                      {t.categoria_display} · {t.ciudad}{' · '}
                      {t.disponible ? <span style={{ color: '#059669' }}>Disponible</span> : <span style={{ color: '#dc2626' }}>Ocupado</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem' }}>
                      <span style={{ color: '#f59e0b' }} aria-label={`Calificación ${t.calificacion.toFixed(1)} de 5`}>{estrellas(t.calificacion)}</span>
                      <span style={{ color: '#6b7280' }}> {t.calificacion.toFixed(1)}</span>
                      {t.distancia_km != null && <span style={{ color: '#2563eb', fontWeight: 600 }}> · {t.distancia_km} km</span>}
                    </span>
                  </span>
                  {activo && <span style={{ color: '#2563eb', fontSize: '1rem' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {elegido && !elegido.disponible && (
          <p style={{ fontSize: '0.78rem', color: '#b45309', marginTop: 8 }}>⚠️ {elegido.nombre} figura como ocupado. Puedes asignarlo de todos modos.</p>
        )}
        <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 6 }}>
          {hayActual
            ? 'El nuevo técnico sustituirá al actual, quedará en el historial y se le avisará al cliente.'
            : 'Al asignar un técnico, el ticket pasará a estatus En camino y se le mostrará al cliente.'}
        </p>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={asignar} disabled={guardando || !elegido}>
            {guardando ? 'Guardando...' : elegido ? `${hayActual ? 'Reasignar a' : 'Asignar a'} ${elegido.nombre}` : titulo}
          </button>
        </div>
      </div>
    </div>
  )
}
