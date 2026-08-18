import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PasswordInput from '../components/PasswordInput'

export default function RegistroPage() {
  const { registro } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '', nombre: '', apellido_paterno: '', apellido_materno: '',
    empresa: '', telefono: '', email: '', puesto: '', password: '', confirmar_password: '',
    aceptar_aviso_privacidad: false
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarAviso, setMostrarAviso] = useState(false)

  const handleChange = e => {
    const { name, type, value, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    if (form.password !== form.confirmar_password) { setError('Las contraseñas no coinciden'); setLoading(false); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); setLoading(false); return }
    if (!form.aceptar_aviso_privacidad) { setError('Debes leer y aceptar el Aviso de Privacidad para registrarte'); setLoading(false); return }
    try {
      const res = await registro(form)
      if (res?.email) navigate('/verificar-email', { state: { email: res.email, codigo: res.codigo } })
      else navigate('/cliente/dashboard')
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') setError(Object.values(data).flat().join(' '))
      else setError('Error al registrar. Intenta de nuevo.')
    } finally { setLoading(false) }
  }

  const pwOk = form.password.length >= 8
  const pwNoNumeric = form.password.length === 0 || !/^\d+$/.test(form.password)
  const pwNoSimilar = form.password.length === 0 || !form.password.includes(form.username)

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Fondo */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'linear-gradient(135deg, rgba(13,13,13,0.88) 0%, rgba(26,86,219,0.25) 100%), url(https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80) center/cover no-repeat',
      }} />

      {/* Navbar */}
      <nav style={{ position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.9rem 2rem' }}>
        <Link to="/login" style={{ fontFamily: 'Bebas Neue', fontSize: '1.6rem', letterSpacing: 2, textDecoration: 'none', color: 'white' }}>
          Taller<span style={{ color: 'var(--naranja)' }}>diesel</span>
        </Link>
      </nav>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 520, background: 'rgba(255,255,255,0.97)', borderRadius: 16, padding: '1.75rem', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

          <>
              <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '1.25rem', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Crear cuenta</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 2 }}>Completa tus datos para registrarte</p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem' }}>{error}</div>}

                <div className="form-group">
                  <label className="form-label">Nombre de Usuario</label>
                  <input className="form-input" name="username" placeholder="ej. juanperez92" value={form.username} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre(s)</label>
                  <input className="form-input" name="nombre" placeholder="Tu nombre completo" value={form.nombre} onChange={handleChange} />
                </div>
                {/*
                  FIX: se usa la clase "grid-2" (ya definida en el CSS global)
                  en vez de un grid en línea fijo a 2 columnas. "grid-2" se
                  apila a 1 sola columna en pantallas <= 768px (@media query
                  ya existente), evitando que la etiqueta larga "Apellido
                  Materno" se rompa en 2 líneas y se encime con el input.
                */}
                <div className="grid-2" style={{ gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Apellido Paterno</label>
                    <input className="form-input" name="apellido_paterno" placeholder="Paterno" value={form.apellido_paterno} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Apellido Materno</label>
                    <input className="form-input" name="apellido_materno" placeholder="Materno" value={form.apellido_materno} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre de la Empresa</label>
                  <input className="form-input" name="empresa" placeholder="Nombre de la Empresa" value={form.empresa} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" name="telefono" placeholder="55 1234 5678" value={form.telefono} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo electrónico *</label>
                  <input className="form-input" name="email" type="email" placeholder="correo@empresa.com" value={form.email} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Puesto en la empresa</label>
                  <input className="form-input" name="puesto" placeholder="ej. Gerente de flota" value={form.puesto} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña *</label>
                  <PasswordInput name="password" value={form.password} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña *</label>
                  <PasswordInput name="confirmar_password" value={form.confirmar_password} onChange={handleChange} required />
                </div>

                {form.password && (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>Requisitos de seguridad:</div>
                    {[[pwOk, 'Al menos 8 caracteres'], [pwNoNumeric, 'No puede ser solo números'], [pwNoSimilar, 'No similar a tu usuario']].map(([ok, msg], i) => (
                      <div key={i} style={{ fontSize: '0.78rem', color: ok ? '#059669' : '#dc2626', marginBottom: 2 }}>
                        {ok ? '✓' : '✕'} {msg}
                      </div>
                    ))}
                  </div>
                )}

                {/*
                  FIX: se mantiene la MISMA estructura original (input dentro
                  del <label>) para no romper el CSS global que le da estilo
                  visual al checkbox. El bug de móvil se soluciona SOLO con
                  e.stopPropagation() en el botón "Aviso de Privacidad", que
                  evita que su clic/touch le "suba" al label y togglee el
                  checkbox sin que el usuario lo note.
                */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input type="checkbox" name="aceptar_aviso_privacidad" checked={form.aceptar_aviso_privacidad}
                      onChange={handleChange} style={{ marginTop: 3 }} required />
                    <span>
                      He leído y acepto el{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMostrarAviso(v => !v) }}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--azul)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}>
                        Aviso de Privacidad
                      </button>
                      .
                    </span>
                  </label>
                  {mostrarAviso && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: '0.76rem', color: '#4b5563', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto' }}>
                      <strong>Aviso de Privacidad — Tallerdiesel</strong>
                      <p style={{ margin: '6px 0' }}>
                        Tallerdiesel, con domicilio en territorio mexicano, es responsable del tratamiento de tus
                        datos personales (nombre, empresa, teléfono y correo electrónico) que nos proporcionas
                        al registrarte. Estos datos se utilizan únicamente para identificarte dentro del sistema,
                        gestionar tus solicitudes de servicio y tickets, asignarte un coordinador o técnico, y
                        contactarte sobre el estatus de tu servicio.
                      </p>
                      <p style={{ margin: '6px 0' }}>
                        No compartimos tu información con terceros ajenos a la prestación del servicio. Puedes
                        ejercer tus derechos de acceso, rectificación, cancelación u oposición (derechos ARCO)
                        escribiendo al correo de contacto de la empresa. Al marcar esta casilla confirmas que
                        leíste y aceptas este aviso.
                      </p>
                    </div>
                  )}
                </div>

                <button className="btn btn-primary" type="submit" disabled={loading || !form.aceptar_aviso_privacidad}
                  style={{ width: '100%', justifyContent: 'center', borderRadius: 50, padding: '12px', marginTop: 4 }}>
                  {loading ? 'Registrando...' : 'Registrar'}
                </button>
                <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                  ¿Ya tienes cuenta?{' '}
                  <Link to="/login" style={{ color: 'var(--azul)', fontWeight: 600 }}>Inicia sesión aquí</Link>
                </div>
              </form>
            </>
        </div>
      </div>
    </div>
  )
}
