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
          .config-tarjeta .btn { transition: none; }
          .truck-mover, .truck-animado, .wheel-custom { animation: none; }
          .truck-mover { transform: translateX(40px); }
        }
      `}</style>

      <Sidebar />
      <main className="main-content">
        <div className="config-centro">
          <div className="page-header">
            <h1 className="page-title">⚙ Configuración de la empresa</h1>
            <p className="page-subtitle">Solo el Administrador puede editar esta información</p>
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

                <button className="btn btn-primary" type="submit" disabled={guardando} style={{ alignSelf: 'flex-start' }}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* ── Camión pequeño de reparto ── */}
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
    </div>
  )
}
