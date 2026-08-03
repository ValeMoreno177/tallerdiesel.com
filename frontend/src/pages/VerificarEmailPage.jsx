import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import api from '../api/client'

export default function VerificarEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const emailInicial =
    location.state?.email ||
    new URLSearchParams(location.search).get('email') ||
    ''

  const [email, setEmail] = useState(emailInicial)
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState('form') // form | ok | error
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setMensaje('')
    try {
      const { data } = await api.post('/auth/verificar/', { email, codigo })
      setEstado('ok')
      setMensaje(data.mensaje)
    } catch (err) {
      setEstado('error')
      setMensaje(err.response?.data?.error || 'Código inválido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '2.5rem', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {estado === 'ok' ? (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>¡Correo verificado!</h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{mensaje}</p>
            <Link to="/login">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 50, padding: '12px' }}>
                Iniciar sesión
              </button>
            </Link>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Verifica tu correo</h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Te enviamos un código de 6 dígitos{email ? <> a <strong>{email}</strong></> : ''}. Escríbelo aquí para activar tu cuenta.
            </p>

            {estado === 'error' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                {mensaje}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-input" type="email" placeholder="correo@empresa.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Código de verificación</label>
                <input className="form-input" type="text" inputMode="numeric" maxLength={6}
                  placeholder="123456" value={codigo}
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ letterSpacing: 4, textAlign: 'center', fontSize: '1.25rem' }} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', borderRadius: 50, padding: '12px' }}>
                {loading ? 'Verificando...' : 'Verificar'}
              </button>
            </form>

            <div style={{ marginTop: '1.25rem' }}>
              <Link to="/reenviar-verificacion" state={{ email }} style={{ color: 'var(--azul)', fontSize: '0.875rem' }}>
                ¿No te llegó el código? Reenviar
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
