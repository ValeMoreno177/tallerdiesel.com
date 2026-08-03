import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import api from '../api/client'

export default function SolicitarCoordinadorPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nombre_completo: user?.nombre || '',
    telefono:        user?.telefono || '',
    empresa:         user?.empresa  || '',
    lugar:  '',
    tipo_unidad: '',
    unidad: '',
    problema: ''
  })
  const [enviando, setEnviando] = useState(false)
  const [error,    setError]    = useState('')
  const [toast,    setToast]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEnviando(true); setError('')
    try {
      await api.post('/solicitud/', form)
      setToast(true)
      setTimeout(() => navigate('/coordinador/bitacora'), 2200)
    } catch (err) {
      const datos = err?.response?.data
      const msg = datos && typeof datos === 'object'
        ? Object.values(datos).flat().join(' ')
        : ''
      setError(msg || 'Ocurrió un error. Intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.3)', color: 'white',
    padding: '13px 16px', borderRadius: 10, fontSize: '0.95rem',
    outline: 'none', boxSizing: 'border-box',
  }
  const readonlyStyle = { ...inputStyle, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'not-allowed' }

  const campos = [
    { label: 'Nombre Completo *', key: 'nombre_completo', ph: 'Juan Pérez', req: true },
    { label: 'Lugar o ubicación *', key: 'lugar', ph: 'Carretera / ciudad, estado', req: true },
    { label: 'Tipo de unidad *', key: 'tipo_unidad', ph: 'ej. Tractocamión, Caja seca, Torton...', req: true },
    { label: 'Datos / número de unidad *', key: 'unidad', ph: 'ej. Kenworth T680 — Unidad 204', req: true },
  ]

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <Toast
        show={toast}
        tipo="exito"
        titulo="¡Solicitud enviada!"
        mensaje="Un coordinador se pondrá en contacto contigo en menos de 5 minutos."
        onClose={() => setToast(false)}
      />
      <main className="main-content-fluid" style={{
        flex: 1,
        background: 'linear-gradient(rgba(0,0,0,0.60), rgba(0,0,0,0.60)), url(https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600&q=80) center/cover no-repeat',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '2rem 3rem',
      }}>
        <div style={{ width: '100%', maxWidth: 680 }}>
          <h1 style={{
            fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2rem, 3.5vw, 3rem)',
            color: 'white', letterSpacing: 2, lineHeight: 1.1, marginBottom: '0.75rem', textAlign: 'center',
          }}>
            SOLICITAR SERVICIO — COORDINADOR
          </h1>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '5px 16px' }}>
              <span style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>El ticket se crea automáticamente y llega al Admin</span>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 16px', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {campos.map(({ label, key, ph, req }) => (
              <div key={key}>
                <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>{label}</label>
                <input placeholder={ph} required={req} value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} />
              </div>
            ))}

            {/* Teléfono — precargado del registro, pero editable por si está vacío */}
            <div>
              <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Número telefónico *
              </label>
              <input value={form.telefono} required placeholder="10 dígitos"
                onChange={e => setForm({ ...form, telefono: e.target.value })} style={inputStyle} />
            </div>

            {/* Empresa readonly */}
            <div>
              <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Empresa <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>(no editable)</span>
              </label>
              <input value={form.empresa} readOnly style={readonlyStyle} />
            </div>

            <div>
              <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: 6 }}>¿Qué problema presenta la unidad? *</label>
              <textarea placeholder="Describe el problema..." required rows={4} value={form.problema}
                onChange={e => setForm({ ...form, problema: e.target.value })}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>

            <button type="submit" disabled={enviando} style={{
              background: 'black', color: 'white', border: '2px solid var(--naranja)', borderRadius: 50,
              padding: '14px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
            }}>
              🔧 {enviando ? 'Enviando...' : 'Solicitar servicio'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
