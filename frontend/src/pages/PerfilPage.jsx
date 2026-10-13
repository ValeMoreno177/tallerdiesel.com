import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import PasswordInput from '../components/PasswordInput'
import Toast from '../components/Toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { prepararFotoPerfil } from '../utils/imagen'

const ROL = { admin: 'Administrador', coordinador: 'Coordinador', cliente: 'Cliente' }

export default function PerfilPage() {
  const { user, actualizarUsuario } = useAuth()
  const inputRef = useRef(null)

  // ── Foto ──
  const [previa, setPrevia] = useState(null)        // { blob, url } lista para guardar
  const [procesando, setProcesando] = useState(false)
  const [guardandoFoto, setGuardandoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')

  // ── Contraseña ──
  const vacio = { password_actual: '', password_nueva: '', confirmar_password: '' }
  const [pw, setPw] = useState(vacio)
  const [guardandoPw, setGuardandoPw] = useState(false)
  const [errorPw, setErrorPw] = useState('')

  const [toast, setToast] = useState({ show: false, tipo: 'exito', titulo: '', mensaje: '' })
  const avisar = (tipo, titulo, mensaje = '') => setToast({ show: true, tipo, titulo, mensaje })

  useEffect(() => () => { if (previa?.url) URL.revokeObjectURL(previa.url) }, [previa])

  const elegirArchivo = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''                                // permite volver a elegir el mismo archivo
    if (!archivo) return
    setErrorFoto(''); setProcesando(true)
    try {
      const blob = await prepararFotoPerfil(archivo)
      setPrevia({ blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      setPrevia(null); setErrorFoto(err.message)
    } finally { setProcesando(false) }
  }

  const guardarFoto = async () => {
    if (!previa) return
    setGuardandoFoto(true); setErrorFoto('')
    try {
      const fd = new FormData()
      fd.append('foto', previa.blob, 'foto.jpg')
      const { data } = await api.post('/auth/foto/', fd)
      actualizarUsuario(data)
      setPrevia(null)
      avisar('exito', '¡Foto actualizada!')
    } catch (err) {
      setErrorFoto(err.response?.data?.error || 'No se pudo guardar la foto. Intenta de nuevo.')
    } finally { setGuardandoFoto(false) }
  }

  const quitarFoto = async () => {
    if (!window.confirm('¿Quitar tu foto de perfil?')) return
    setGuardandoFoto(true); setErrorFoto('')
    try {
      const { data } = await api.delete('/auth/foto/')
      actualizarUsuario(data)
      avisar('exito', 'Foto eliminada')
    } catch {
      setErrorFoto('No se pudo quitar la foto. Intenta de nuevo.')
    } finally { setGuardandoFoto(false) }
  }

  const cambiarPassword = async (e) => {
    e.preventDefault()
    setErrorPw('')
    if (pw.password_nueva.length < 8) return setErrorPw('La nueva contraseña debe tener al menos 8 caracteres.')
    if (pw.password_nueva !== pw.confirmar_password) return setErrorPw('Las contraseñas nuevas no coinciden.')
    setGuardandoPw(true)
    try {
      const { data } = await api.post('/auth/cambiar-password/', pw)
      // Las demás sesiones se cierran; esta sigue activa con tokens nuevos
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      setPw(vacio)
      avisar('exito', 'Contraseña actualizada', 'Se cerró tu sesión en otros dispositivos.')
    } catch (err) {
      setErrorPw(err.response?.status === 429
        ? 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
        : err.response?.data?.error || 'No se pudo cambiar la contraseña.')
    } finally { setGuardandoPw(false) }
  }

  const campo = (k) => ({ value: pw[k], onChange: e => setPw({ ...pw, [k]: e.target.value }), required: true })
  const dato = (etiqueta, valor) => valor ? (
    <div>
      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{etiqueta}</div>
      <div style={{ fontSize: '0.9rem', color: '#111827', wordBreak: 'break-word' }}>{valor}</div>
    </div>
  ) : null

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">👤 Mi perfil</h1>
          <p className="page-subtitle">Tu foto y tu contraseña</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          {/* ── Foto y datos ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {previa
                ? <img src={previa.url} alt="Vista previa de tu foto" style={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--naranja)' }} />
                : <Avatar usuario={user} size={112} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user?.nombre_completo || user?.username}</div>
                <span className={`badge badge-${user?.rol}`} style={{ fontSize: '0.7rem' }}>{ROL[user?.rol]}</span>
              </div>
            </div>

            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirArchivo}
              style={{ display: 'none' }} aria-label="Elegir foto de perfil" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {previa ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={guardarFoto} disabled={guardandoFoto}>
                    {guardandoFoto ? 'Guardando...' : '💾 Guardar foto'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPrevia(null)} disabled={guardandoFoto}>Cancelar</button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => inputRef.current?.click()} disabled={procesando || guardandoFoto}>
                    {procesando ? 'Procesando...' : user?.foto_version ? '📷 Cambiar foto' : '📷 Subir foto'}
                  </button>
                  {user?.foto_version && (
                    <button className="btn btn-ghost btn-sm" onClick={quitarFoto} disabled={guardandoFoto}>Quitar foto</button>
                  )}
                </>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 8 }}>
              JPG, PNG o WEBP. Se recorta en cuadrado automáticamente.
            </div>
            {errorFoto && <div role="alert" style={{ marginTop: 10, background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>{errorFoto}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px 16px', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
              {dato('Usuario', user?.username)}
              {dato('Correo', user?.email)}
              {dato('Teléfono', user?.telefono)}
              {dato('Puesto', user?.puesto)}
              {dato('Empresa', user?.empresa)}
            </div>
          </div>

          {/* ── Contraseña ── */}
          <form className="card" onSubmit={cambiarPassword}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>🔒 Cambiar contraseña</div>
            <div className="form-group">
              <label className="form-label">Contraseña actual</label>
              <PasswordInput autoComplete="current-password" {...campo('password_actual')} />
            </div>
            <div className="form-group">
              <label className="form-label">Nueva contraseña</label>
              <PasswordInput autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...campo('password_nueva')} />
            </div>
            <div className="form-group">
              <label className="form-label">Repite la nueva contraseña</label>
              <PasswordInput autoComplete="new-password" {...campo('confirmar_password')} />
            </div>
            {errorPw && <div role="alert" style={{ marginBottom: 12, background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>{errorPw}</div>}
            <button className="btn btn-primary" type="submit" disabled={guardandoPw}>
              {guardandoPw ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 10 }}>
              Al cambiarla se cierra tu sesión en cualquier otro dispositivo.
            </div>
          </form>
        </div>
      </main>
      <Toast {...toast} onClose={() => setToast(t => ({ ...t, show: false }))} />
    </div>
  )
}