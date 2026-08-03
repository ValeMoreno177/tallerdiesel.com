import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function ReenviarVerificacionPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [estado, setEstado] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const { data } = await api.post('/auth/reenviar-verificacion/', { email })
      setEstado({ ok: true, msg: data.mensaje })
      setTimeout(() => navigate('/verificar-email', { state: { email } }), 1200)
    } catch (err) {
      setEstado({ ok: false, msg: err.response?.data?.error || 'Error al reenviar.' })
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '2.5rem', maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Reenviar verificación</h2>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Ingresa tu correo y te enviaremos un nuevo código de verificación.
        </p>
        {estado && (
          <div style={{ background: estado.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${estado.ok ? '#bbf7d0' : '#fecaca'}`, color: estado.ok ? '#065f46' : '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
            {estado.msg}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input className="form-input" type="email" placeholder="correo@empresa.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', borderRadius: 50, padding: '12px' }}>
            {loading ? 'Enviando...' : 'Reenviar código'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <Link to="/login" style={{ color: 'var(--azul)', fontSize: '0.875rem' }}>← Volver al inicio de sesión</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
