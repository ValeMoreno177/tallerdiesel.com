import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PasswordInput from '../components/PasswordInput'

const FEATURES_LEFT = [
  { icon: '🛡️', title: 'Tu unidad no puede esperar — nosotros tampoco', desc: 'Cada hora parada es dinero perdido. Por eso respondemos antes de que el café se enfríe.' },
  { icon: '🕐', title: 'A las 3 AM también estamos aquí', desc: 'Fallas en carretera no avisan. Nuestros técnicos tampoco descansan. Auxilio real, a cualquier hora.' },
  { icon: '👥', title: 'Más de 500 flotas ya nos eligieron', desc: 'Desde un camión hasta flotas completas — las empresas que mueven México confían en TallerDiesel.' },
]
const FEATURES_RIGHT = [
  { icon: '🚛', title: 'Diésel es lo nuestro, no un servicio más', desc: 'No somos un taller de todo. Somos los mejores en lo que tu unidad realmente necesita.' },
  { icon: '💵', title: 'Repara ahora, paga cuando puedas', desc: 'Crédito flexible para tu empresa. Porque una falla no debería parar tu operación por falta de liquidez.' },
  { icon: '📋', title: 'Todo tu historial en un solo lugar', desc: 'Tickets, facturas y reportes siempre a la mano. Sin llamadas, sin papeles, sin perder tiempo.' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [noVerificado, setNoVerificado] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setNoVerificado(false); setLoading(true)
    try {
      const user = await login(form.username, form.password)
      if (user.rol === 'admin') navigate('/admin/dashboard')
      else if (user.rol === 'coordinador') navigate('/coordinador/bitacora')
      else navigate('/cliente/dashboard')
    } catch (err) {
      const data = err.response?.data
      if (data?.no_verificado) setNoVerificado(true)
      setError(data?.error || 'Credenciales incorrectas')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Fondo con imagen y overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'linear-gradient(135deg, rgba(13,13,13,0.85) 0%, rgba(26,86,219,0.3) 100%), url(https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600&q=80) center/cover no-repeat',
      }} />

      {/* Navbar */}
      <nav style={{ position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.6rem', letterSpacing: 2, color: 'white' }}>
          Taller<span style={{ color: 'var(--naranja)' }}>diesel</span>
          <span style={{ color: '#9ca3af', fontSize: '0.55rem', fontFamily: 'Barlow', letterSpacing: 3, marginLeft: 4 }}>.com</span>
        </div>
      </nav>

      <div className="login-grid" style={{ position: 'relative', zIndex: 1, flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '2rem', padding: '2.5rem 4rem', maxWidth: 1400, margin: '0 auto', width: '100%', alignItems: 'start' }}>
        {/* Features izquierda */}
        <div className="login-features" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {FEATURES_LEFT.map((f, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginTop: 2 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Login card */}
        <div className="login-card" style={{ width: 400, background: 'rgba(255,255,255,0.97)', borderRadius: 16, padding: '1.75rem', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
            {['login', 'registro'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                style={{ flex: 1, padding: '10px', border: 'none', background: 'none', cursor: 'pointer',
                  fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--azul)' : '#6b7280',
                  borderBottom: tab === t ? '2px solid var(--azul)' : '2px solid transparent', fontSize: '0.95rem' }}>
                {t === 'login' ? 'Inicio de Sesión' : 'Registro'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem' }}>
                  {error}
                  {noVerificado && (
                    <div style={{ marginTop: 6 }}>
                      <Link to="/reenviar-verificacion" style={{ color: 'var(--azul)', fontWeight: 600 }}>
                        ¿Reenviar correo de verificación?
                      </Link>
                    </div>
                  )}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Usuario o Correo electrónico *</label>
                <input className="form-input" placeholder="tucorreo@empresa.com"
                  value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña *</label>
                <PasswordInput placeholder="Tu contraseña"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div style={{ textAlign: 'right' }}>
                <Link to="/recuperar-contrasena" style={{ color: 'var(--azul)', fontSize: '0.85rem' }}>¿Olvidaste tu contraseña?</Link>
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', borderRadius: 50 }}>
                {loading ? 'Accediendo...' : 'Acceder'}
              </button>
              <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
                ¿Aún no tienes cuenta?{' '}
                <span style={{ color: 'var(--azul)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setTab('registro')}>Regístrate aquí</span>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Crea tu cuenta para acceder al portal</p>
              <Link to="/registro">
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 50 }}>
                  Crear cuenta →
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Features derecha */}
        <div className="login-features" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {FEATURES_RIGHT.map((f, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '1rem 1.25rem', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', marginTop: 2 }}>{f.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: 'white', marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
