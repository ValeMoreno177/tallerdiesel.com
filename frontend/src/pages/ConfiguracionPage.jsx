import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/client'
import CamionTitulo from '../components/CamionTitulo'

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
      const { coordinadores, ...datos } = form
      const { data } = await api.put('/empresa-config/', datos)
      setForm(data)
      setMensaje('Información de la empresa actualizada correctamente.')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la información.')
    } finally { setGuardando(false) }
  }

  return (
    <div className="dashboard-layout" style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden', paddingBottom: '70px' }}>
      <style>{`
        /* Tarjeta centrada */
        .config-centro {
          max-width: 560px;
          margin: 0 auto;
        }
        .config-centro .page-header { text-align: center; }
        .config-tarjeta {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 2px 10px rgba(0,0,0,.10);
        }

        /* Botón con efecto de "presionar" */
        .config-tarjeta .btn {
          transition: transform .12s ease, box-shadow .12s ease;
          box-shadow: 0 4px 0 rgba(0,0,0,.28);
        }
        .config-tarjeta .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 5px 0 rgba(0,0,0,.28), 0 8px 14px rgba(0,0,0,.16);
        }
        .config-tarjeta .btn:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 rgba(0,0,0,.28);
        }
        .config-tarjeta .btn:disabled { box-shadow: none; }
        @media (prefers-reduced-motion: reduce) {
          .config-tarjeta .btn { transition: none; }
        }
      `}</style>

      <Sidebar />
      <main className="main-content">
        <div className="config-centro">
          <div className="page-header">
            <h1 className="page-title">⚙ Configuración de la empresa</h1>
            <p className="page-subtitle">Solo el Administrador puede editar esta información</p>
            <CamionTitulo />
          </div>

          {loading || !form ? (
            <div className="loader"><div className="spinner" /></div>
          ) : (
            <div className="card config-tarjeta">
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

                {Array.isArray(form.coordinadores) && (
                  <div className="form-group" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.9rem' }}>
                    <label className="form-label">¿A quién le llegan los servicios nuevos?</label>
                    <select className="form-input" name="coordinador_fijo"
                            value={form.coordinador_fijo ?? ''}
                            onChange={e => setForm({ ...form, coordinador_fijo: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Repartir entre todos los coordinadores (por turno)</option>
                      {form.coordinadores.map(c => (
                        <option key={c.id} value={c.id}>
                          Todos a {c.numero ? `Coordinador ${c.numero} — ` : ''}{c.nombre}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      Si eliges un coordinador, todos los servicios nuevos y los que estén en espera le llegan directo a él.
                      Los demás coordinadores solo verán los tickets que ya tenían.
                    </small>
                  </div>
                )}

                <button className="btn btn-primary" type="submit" disabled={guardando} style={{ alignSelf: 'flex-start' }}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
