import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import PasswordInput from '../components/PasswordInput'

export default function RecuperarContrasenaPage() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState('solicitar') // solicitar | confirmar | ok
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSolicitar = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/recuperar/', { email })
      setMensaje(data.mensaje)
      setPaso('confirmar')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al solicitar el código.')
    } finally { setLoading(false) }
  }

  const handleConfirmar = async (e) => {
    e.preventDefault(); setError('')
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/recuperar/confirmar/', { email, codigo, password })
      setMensaje(data.mensaje)
      setPaso('ok')
    } catch (err) {
      setError(err.response?.data?.error || 'Código inválido.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '2.5rem', maxWidth: 440, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        {paso === 'ok' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>¡Contraseña actualizada!</h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{mensaje}</p>
            <Link to="/login">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 50, padding: '12px' }}>
                Iniciar sesión
              </button>
            </Link>
          </div>
        ) : paso === 'solicitar' ? (
          <>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>¿Olvidaste tu contraseña?</h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Ingresa tu correo y te enviaremos un código para restablecerla.
            </p>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSolicitar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-input" type="email" placeholder="correo@empresa.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', borderRadius: 50, padding: '12px' }}>
                {loading ? 'Enviando...' : 'Enviar código'}
              </button>
              <div style={{ textAlign: 'center' }}>
                <Link to="/login" style={{ color: 'var(--azul)', fontSize: '0.875rem' }}>← Volver al inicio de sesión</Link>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Restablece tu contraseña</h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Escribe el código de 6 dígitos que enviamos a <strong>{email}</strong> y tu nueva contraseña.
            </p>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleConfirmar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Código de verificación</label>
                <input className="form-input" type="text" inputMode="numeric" maxLength={6}
                  placeholder="123456" value={codigo}
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ letterSpacing: 4, textAlign: 'center', fontSize: '1.25rem' }} required />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva contraseña</label>
                <PasswordInput placeholder="Mínimo 8 caracteres" value={password}
                  onChange={e => setPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar nueva contraseña</label>
                <PasswordInput placeholder="Repite tu contraseña" value={confirmar}
                  onChange={e => setConfirmar(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', borderRadius: 50, padding: '12px' }}>
                {loading ? 'Guardando...' : 'Restablecer contraseña'}
              </button>
              <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--azul)', cursor: 'pointer' }} onClick={() => setPaso('solicitar')}>← Cambiar correo</span>
                <span style={{ color: 'var(--azul)', cursor: 'pointer' }} onClick={handleSolicitar}>Reenviar código</span>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
