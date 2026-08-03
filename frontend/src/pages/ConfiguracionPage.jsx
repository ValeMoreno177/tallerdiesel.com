import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/client'

export default function ConfiguracionPage() {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/empresa-config/')
      .then(({ data }) => setForm(data))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true); setMensaje(''); setError('')
    try {
      const { data } = await api.put('/empresa-config/', form)
      setForm(data)
      setMensaje('Información de la empresa actualizada correctamente.')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la información.')
    } finally { setGuardando(false) }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">⚙ Configuración de la empresa</h1>
          <p className="page-subtitle">Solo el Administrador puede editar esta información</p>
        </div>

        {loading || !form ? (
          <div className="loader"><div className="spinner" /></div>
        ) : (
          <div className="card" style={{ maxWidth: 560 }}>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {mensaje && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46', padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem' }}>{mensaje}</div>}
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem' }}>{error}</div>}

              <div className="form-group">
                <label className="form-label">Nombre de la empresa</label>
                <input className="form-input" name="nombre_empresa" value={form.nombre_empresa || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">RFC</label>
                <input className="form-input" name="rfc" value={form.rfc || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input className="form-input" name="direccion" value={form.direccion || ''} onChange={handleChange} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" name="telefono" value={form.telefono || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo de contacto</label>
                  <input className="form-input" name="email" type="email" value={form.email || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Sitio web</label>
                <input className="form-input" name="sitio_web" value={form.sitio_web || ''} onChange={handleChange} />
              </div>

              <button className="btn btn-primary" type="submit" disabled={guardando} style={{ alignSelf: 'flex-start' }}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
