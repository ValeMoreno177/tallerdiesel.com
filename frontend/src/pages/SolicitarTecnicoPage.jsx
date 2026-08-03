import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import api from '../api/client'
import { API_BASE_URL } from '../api/baseURL'
import { crearIconoTecnico, CATEGORIA_LEYENDA, CATEGORIA_ICONO, CATEGORIA_COLOR } from '../utils/tecnicoIcons'

const publicApi = axios.create({ baseURL: API_BASE_URL })

const CATEGORIAS = [
  { value: '', label: 'Categoría' },
  { value: 'motor_diesel',      label: 'Motor diesel' },
  { value: 'electrico',         label: 'Eléctrico' },
  { value: 'frenos_suspension', label: 'Frenos y suspensión' },
  { value: 'transmision',       label: 'Transmisión' },
  { value: 'hidraulico',        label: 'Sistema hidráulico' },
  { value: 'aire',              label: 'Sistema de aire' },
  { value: 'mecanica',          label: 'Mecánica general' },
  { value: 'soldadura',         label: 'Soldadura' },
]

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.3)', color: 'white',
  padding: '13px 16px', borderRadius: 10, fontSize: '0.95rem',
  outline: 'none', boxSizing: 'border-box',
}
const readonlyStyle = { ...inputStyle, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed' }

export default function SolicitarTecnicoPage() {
  const { user } = useAuth()

  const [form, setForm] = useState({
    nombre_completo: user?.nombre || '',
    telefono:        user?.telefono || '',
    empresa:         user?.empresa  || '',
    lugar: '', tipo_unidad: '', unidad: '', problema: '',
  })
  const [enviando,  setEnviando]  = useState(false)
  const [error,     setError]     = useState('')
  const [enviado,   setEnviado]   = useState(false)

  // Mapa
  const [tecnicos,       setTecnicos]       = useState([])
  const [loadingTec,     setLoadingTec]     = useState(true)
  const [mapaListo,      setMapaListo]      = useState(false)
  const [busqueda,       setBusqueda]       = useState({ ciudad: '', categoria: '' })
  const [tecnicoElegido, setTecnicoElegido] = useState(() => {
    try { return JSON.parse(localStorage.getItem('td_tecnico_elegido') || 'null') } catch { return null }
  })
  const [confirmando, setConfirmando] = useState(null)

  useEffect(() => {
    try {
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
    } catch (e) { console.warn('Leaflet:', e) }
    setMapaListo(true)
  }, [])

  const fetchTecnicos = (params = {}) => {
    setLoadingTec(true)
    const q = new URLSearchParams()
    if (params.ciudad)    q.set('ciudad',    params.ciudad)
    if (params.categoria) q.set('categoria', params.categoria)
    publicApi.get(`/tecnicos/?${q}`)
      .then(({ data }) => setTecnicos(data.results || data))
      .catch(e => console.error('Error técnicos:', e))
      .finally(() => setLoadingTec(false))
  }

  useEffect(() => { fetchTecnicos() }, [])

  const elegirTecnico = (t) => {
    localStorage.setItem('td_tecnico_elegido', JSON.stringify(t))
    localStorage.setItem('td_form_tecnico_enviado', 'true')
    setTecnicoElegido(t)
    setConfirmando(t)
    setTimeout(() => setConfirmando(null), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEnviando(true); setError('')
    try {
      const tElegido = (() => { try { return JSON.parse(localStorage.getItem('td_tecnico_elegido') || 'null') } catch { return null } })()
      await api.post('/solicitud/', { ...form, tipo_solicitud: 'tecnico', tecnico_id: tElegido?.id || null })
      localStorage.setItem('td_form_tecnico_enviado', 'true')
      setEnviado(true)
    } catch (err) {
      const datos = err?.response?.data
      const msg = datos && typeof datos === 'object'
        ? Object.values(datos).flat().join(' ')
        : ''
      setError(msg || 'Ocurrió un error. Intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content-fluid" style={{
        flex: 1,
        background: 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url(https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1600&q=80) center/cover no-repeat',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: enviado ? 'flex-start' : 'center',
        minHeight: '100vh', padding: '2rem 3rem', gap: enviado ? '3rem' : 0,
      }}>

        {/* ── FORMULARIO ── */}
        <div style={{ width: '100%', maxWidth: 680 }}>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: 'white', letterSpacing: 2, lineHeight: 1.1, marginBottom: '0.75rem', textAlign: 'center' }}>
            ENCUENTRA Y CONTACTA A UN TÉCNICO CERCANO
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '5px 16px' }}>
              <span style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>Llena el formulario y elige tu técnico en el mapa</span>
            </div>
          </div>

          {enviado && (
            <div style={{ background: 'rgba(5,150,105,0.85)', color: 'white', padding: '12px 16px', borderRadius: 10, marginBottom: '1rem', fontWeight: 600, textAlign: 'center' }}>
              ✅ ¡Solicitud enviada! Ahora elige tu técnico en el mapa de abajo.
            </div>
          )}
          {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 16px', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Nombre Completo *', key: 'nombre_completo', ph: 'Juan Pérez' },
              { label: 'Lugar o ubicación *', key: 'lugar', ph: 'Carretera / ciudad, estado' },
              { label: 'Tipo de unidad *', key: 'tipo_unidad', ph: 'ej. Tractocamión, Caja seca, Torton...' },
              { label: 'Datos / número de unidad *', key: 'unidad', ph: 'ej. Kenworth T680 — Unidad 204' },
            ].map(({ label, key, ph }) => (
              <div key={key}>
                <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>{label}</label>
                <input placeholder={ph} required value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Número telefónico *
              </label>
              <input value={form.telefono} required placeholder="10 dígitos"
                onChange={e => setForm({ ...form, telefono: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Empresa {user?.empresa && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>(no editable)</span>}
              </label>
              <input value={form.empresa} readOnly style={readonlyStyle} />
            </div>
            <div>
              <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>¿Qué problema presenta tu unidad? *</label>
              <textarea placeholder="Describe el problema..." required rows={4} value={form.problema}
                onChange={e => setForm({ ...form, problema: e.target.value })} style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <button type="submit" disabled={enviando || enviado} style={{
              background: enviado ? 'rgba(5,150,105,0.7)' : 'black',
              color: 'white', border: `2px solid ${enviado ? '#059669' : 'var(--naranja)'}`,
              borderRadius: 50, padding: '14px', fontSize: '1rem', fontWeight: 600,
              cursor: enviado ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
            }}>
              {enviando ? '⏳ Enviando...' : enviado ? '✅ Solicitud enviada' : '🔧 Solicitar servicio'}
            </button>
          </form>
        </div>

        {/* ── MAPA — solo aparece después de enviar el formulario ── */}
        {enviado && (
        <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', color: 'white', letterSpacing: 2, margin: 0 }}>
              TÉCNICOS DISPONIBLES CERCA DE TI
            </h2>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6 }}>
              <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>🟢 Disponible</span>
              <span style={{ fontSize: '0.8rem', color: '#f87171' }}>🔴 Ocupado</span>
            </div>
          </div>

          {tecnicoElegido && (
            <div style={{ width: '100%', background: 'rgba(5,150,105,0.9)', borderRadius: 10, padding: '10px 16px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'white', fontSize: '0.9rem' }}>
                ✅ Técnico seleccionado: <strong>{tecnicoElegido.nombre}</strong>
                <span style={{ marginLeft: 8, fontSize: '0.78rem', opacity: 0.8 }}>
                  {tecnicoElegido.disponible ? '🟢 Disponible' : '🔴 Ocupado al momento de seleccionar'}
                </span>
              </span>
              <button onClick={() => { localStorage.removeItem('td_tecnico_elegido'); setTecnicoElegido(null) }}
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer' }}>
                Cambiar
              </button>
            </div>
          )}

          {confirmando && (
            <div style={{ width: '100%', background: '#fef3c7', borderRadius: 10, padding: '10px 16px', marginBottom: '0.75rem', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }}>
              🎉 ¡{confirmando.nombre} guardado en tu inicio!
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', width: '100%' }}>
            <input placeholder="Ciudad o Estado..."
              value={busqueda.ciudad} onChange={e => setBusqueda({ ...busqueda, ciudad: e.target.value })}
              style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.95rem', outline: 'none' }} />
            <select value={busqueda.categoria} onChange={e => setBusqueda({ ...busqueda, categoria: e.target.value })}
              style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.95rem', background: 'white', cursor: 'pointer' }}>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button onClick={() => fetchTecnicos(busqueda)}
              style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}>
              Buscar
            </button>
          </div>

          {/* Leyenda de la librería de íconos por categoría */}
          <div style={{
            width: '100%', display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
            marginBottom: '1rem', background: 'rgba(0,0,0,0.45)', borderRadius: 10, padding: '0.6rem 0.85rem',
          }}>
            {CATEGORIA_LEYENDA.map(c => (
              <span key={c.value} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '3px 10px 3px 6px',
                fontSize: '0.72rem', color: 'white',
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: CATEGORIA_COLOR[c.value],
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0,
                }}>{CATEGORIA_ICONO[c.value]}</span>
                {c.label}
              </span>
            ))}
          </div>

          <div style={{ width: '100%', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            {mapaListo ? (
              <MapContainer center={[23.6345, -102.5528]} zoom={5} style={{ height: 500, width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {!loadingTec && tecnicos.map((t, i) => (
                  <Marker key={t.id} position={[t.latitud, t.longitud]} icon={crearIconoTecnico(t.categoria, t.disponible)}>
                    <Popup>
                      <div style={{ minWidth: 200 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ fontSize: '1rem' }}>{t.nombre}</strong>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: t.disponible ? '#d1fae5' : '#fee2e2',
                            color: t.disponible ? '#065f46' : '#991b1b'
                          }}>
                            {t.disponible ? '🟢 Disponible' : '🔴 Ocupado'}
                          </span>
                        </div>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t.categoria_display}</span>
                        <div style={{ marginTop: 6, fontSize: '0.85rem' }}>
                          📍 {t.ciudad}, {t.estado}<br />
                          🏠 {t.direccion}<br />
                          📞 {t.telefono}
                        </div>
                        {!t.disponible && (
                          <div style={{ marginTop: 8, background: '#fef2f2', borderRadius: 6, padding: '6px 8px', fontSize: '0.75rem', color: '#991b1b' }}>
                            Este técnico está ocupado, pero puedes contactarlo.
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          <a href={`https://maps.google.com/?q=${t.latitud},${t.longitud}`} target="_blank" rel="noreferrer">
                            <button style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: '0.78rem', cursor: 'pointer' }}>🧭 Cómo llegar</button>
                          </a>
                          <a href={`https://wa.me/${t.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                            onClick={() => elegirTecnico(t)}>
                            <button style={{
                              background: tecnicoElegido?.id === t.id ? '#1e40af' : t.disponible ? '#059669' : '#6b7280',
                              color: 'white', border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: '0.78rem', cursor: 'pointer'
                            }}>
                              {tecnicoElegido?.id === t.id ? '✅ Seleccionado' : '💬 WhatsApp'}
                            </button>
                          </a>
                        </div>
                        {tecnicoElegido?.id !== t.id && (
                          <p style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 6, marginBottom: 0 }}>
                            Al dar clic en WhatsApp este técnico se guardará en tu inicio
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 420, background: 'rgba(0,0,0,0.3)', color: 'white' }}>
                Cargando mapa...
              </div>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  )
}
