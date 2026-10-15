import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import PasswordInput from '../components/PasswordInput'
import Toast from '../components/Toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { prepararFotoPerfil } from '../utils/imagen'

const ROL = { admin: 'Administrador', coordinador: 'Coordinador', cliente: 'Cliente' }

// Recorta y comprime la foto de portada (proporción 4:1) y la devuelve como dataURL
const TIPOS_PORTADA = ['image/jpeg', 'image/png', 'image/webp']
function prepararPortada(archivo) {
  return new Promise((resolve, reject) => {
    if (!TIPOS_PORTADA.includes(archivo.type)) return reject(new Error('Usa una imagen JPG, PNG o WEBP.'))
    if (archivo.size > 8 * 1024 * 1024) return reject(new Error('La imagen es muy pesada (máximo 8 MB).'))
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const W = 1600, H = 400
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')
      // "cover": llena todo el banner sin deformar la imagen
      const escala = Math.max(W / img.width, H / img.height)
      const w = img.width * escala, h = img.height * escala
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')) }
    img.src = url
  })
}

export default function PerfilPage() {
  const { user, actualizarUsuario } = useAuth()
  const inputRef = useRef(null)
  const portadaRef = useRef(null)

  // ── Portada (foto de fondo del banner; se guarda en este navegador) ──
  const clavePortada = `perfil_portada_${user?.id ?? user?.username ?? 'usuario'}`
  const [portada, setPortada] = useState(null)
  const [procesandoPortada, setProcesandoPortada] = useState(false)
  const [errorPortada, setErrorPortada] = useState('')

  useEffect(() => {
    try { setPortada(localStorage.getItem(clavePortada) || null) } catch { setPortada(null) }
  }, [clavePortada])

  const elegirPortada = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setErrorPortada(''); setProcesandoPortada(true)
    try {
      const dataUrl = await prepararPortada(archivo)
      try {
        localStorage.setItem(clavePortada, dataUrl)
      } catch {
        throw new Error('No hay espacio para guardar la imagen en este navegador. Prueba con otra más ligera.')
      }
      setPortada(dataUrl)
      avisar('exito', 'Portada actualizada')
    } catch (err) {
      setErrorPortada(err.message)
    } finally { setProcesandoPortada(false) }
  }

  const quitarPortada = () => {
    try { localStorage.removeItem(clavePortada) } catch { /* sin acceso a storage */ }
    setPortada(null); setErrorPortada('')
    avisar('exito', 'Portada eliminada')
  }

  // ── Foto ──
  const [previa, setPrevia] = useState(null)
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
    e.target.value = ''
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

  const cambiarPassword = async (e) => {
    e.preventDefault()
    setErrorPw('')
    if (pw.password_nueva.length < 8) return setErrorPw('La nueva contraseña debe tener al menos 8 caracteres.')
    if (pw.password_nueva !== pw.confirmar_password) return setErrorPw('Las contraseñas nuevas no coinciden.')
    setGuardandoPw(true)
    try {
      const { data } = await api.post('/auth/cambiar-password/', pw)
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

  // Dato de la franja inferior de la tarjeta de perfil
  const dato = (etiqueta, valor) => valor ? (
    <div className="perfil-dato">
      <span className="perfil-dato-et">{etiqueta}</span>
      <span className="perfil-dato-val">{valor}</span>
    </div>
  ) : null

  return (
    <div className="dashboard-layout" style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden', paddingBottom: '70px' }}>
      <style>{`
        /* ═════════ Diseño del perfil (solo estructura; se conservan los colores del sistema) ═════════ */

        /* Banner superior */
        .perfil-banner-wrap { position: relative; }
        .perfil-banner {
          height: clamp(200px, 26vw, 290px);
          border-radius: 16px;
          background:
            radial-gradient(circle at 15% 120%, rgba(19, 1, 1, 0.22) 0 90px, transparent 91px),
            radial-gradient(circle at 85% -20%, rgba(194, 100, 24, 0.18) 0 110px, transparent 111px),
            linear-gradient(120deg, var(--naranja), #d8391d);
        }
        .perfil-banner.con-foto {
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        /* Botones para cambiar la portada (arriba a la derecha del banner) */
        .perfil-portada-btns {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 8px;
          z-index: 3;
        }
        .perfil-portada-btn {
          border: none;
          cursor: pointer;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 600;
          color: #01070f;
          background: rgba(255,255,255,.92);
          padding: 6px 12px;
          border-radius: 999px;
          box-shadow: 0 1px 4px rgba(0,0,0,.25);
        }
        .perfil-portada-btn:hover:not(:disabled) { background: #0c0b0b; }
        .perfil-portada-btn:disabled { opacity: .6; cursor: default; }

        /* Tarjeta central que se encima sobre el banner (sin overflow para no recortar el avatar) */
        .perfil-tarjeta {
          position: relative;
          z-index: 2;
          max-width: 680px;
          margin: -64px auto 0;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 2px 10px rgba(0,0,0,.10);
        }
        .perfil-tarjeta-top {
          position: relative;
          padding: 72px 24px 22px;
          text-align: center;
        }
        .perfil-rol { display: inline-block; margin-top: 8px; }
        .perfil-foto-nota { font-size: 0.75rem; color: #010916; margin-top: 10px; }
        .perfil-foto-acciones {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 14px;
        }
        .perfil-avatar {
          position: absolute;
          top: -52px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 50%;
          border: 5px solid #fff;
          background: #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,.18);
          line-height: 0;
        }
        .perfil-avatar img { border-radius: 50%; display: block; }
        /* Avatar clicable para cambiar la foto */
        .perfil-avatar-btn {
          position: relative;
          display: block;
          border: none;
          padding: 0;
          background: none;
          border-radius: 50%;
          cursor: pointer;
          line-height: 0;
          transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s;
        }
        .perfil-avatar-btn:hover:not(:disabled),
        .perfil-avatar-btn:focus-visible {
          transform: scale(1.18);
          box-shadow: 0 6px 18px rgba(0,0,0,.28);
        }
        .perfil-avatar-btn:active:not(:disabled) { transform: scale(1.1); }
        .perfil-avatar-btn:disabled { cursor: default; opacity: .7; }
        .perfil-avatar-edit {
          position: absolute;
          right: 0;
          bottom: 2px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 5px rgba(0,0,0,.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          line-height: 1;
          transition: transform .15s;
        }
        .perfil-avatar-btn:hover:not(:disabled) .perfil-avatar-edit,
        .perfil-avatar-btn:focus-visible .perfil-avatar-edit { transform: scale(1.12); }
        .perfil-nombre {
          font-size: 1.6rem;
          font-weight: 700;
          color: #111827;
          line-height: 1.2;
          margin: 0;
          word-break: break-word;
        }
        .perfil-linea {
          width: 44px;
          height: 4px;
          border-radius: 2px;
          background: var(--naranja);
          margin: 12px auto 0;
        }

        /* Franja de datos en la parte baja de la tarjeta */
        .perfil-datos {
          background: #f3f4f6;
          border-radius: 0 0 16px 16px;
          padding: 16px 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px 20px;
          text-align: left;
        }
        .perfil-dato { display: flex; flex-direction: column; min-width: 0; }
        .perfil-dato-et {
          font-size: 0.7rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: .5px;
        }
        .perfil-dato-val { font-size: 0.9rem; color: #111827; word-break: break-word; }

        /* Botones con efecto de "presionar": borde inferior que se hunde al hacer clic (no cambia colores) */
        .perfil-tarjeta .btn,
        .perfil-card .btn,
        .perfil-portada-btn {
          transition: transform .12s ease, box-shadow .12s ease;
          box-shadow: 0 4px 0 rgba(0,0,0,.28);
        }
        .perfil-tarjeta .btn:hover:not(:disabled),
        .perfil-card .btn:hover:not(:disabled),
        .perfil-portada-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 5px 0 rgba(0,0,0,.28), 0 8px 14px rgba(0,0,0,.16);
        }
        .perfil-tarjeta .btn:active:not(:disabled),
        .perfil-card .btn:active:not(:disabled),
        .perfil-portada-btn:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 rgba(0,0,0,.28);
        }
        .perfil-tarjeta .btn:disabled,
        .perfil-card .btn:disabled { box-shadow: none; }
        /* Botón de cambiar contraseña un poco más abajo */
        .perfil-btn-pw { margin-top: 26px; }
        .perfil-avatar-edit { animation: latidoCamara 2.4s ease-in-out infinite; }
        @keyframes latidoCamara {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }

        /* Tarjetas inferiores en dos columnas */
        .perfil-grid {
          max-width: 680px;
          margin: 20px auto 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
          gap: 16px;
          align-items: start;
        }
        .perfil-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,.06);
        }
        .perfil-card-titulo {
          font-size: 1.05rem;
          font-weight: 700;
          color: #000613;
          margin: 0;
        }
        .perfil-card-linea {
          width: 32px;
          height: 3px;
          border-radius: 2px;
          background: var(--naranja);
          margin: 6px 0 16px;
        }
        @media (prefers-reduced-motion: reduce) {
          .perfil-avatar-edit { animation: none; }
          .perfil-avatar-btn, .perfil-tarjeta .btn, .perfil-card .btn, .perfil-portada-btn { transition: none; }
        }
      `}</style>

      <Sidebar />
      <main className="main-content">
        {/* ── Banner (colores por defecto o la foto elegida por el usuario) ── */}
        <div className="perfil-banner-wrap">
          <div
            className={`perfil-banner${portada ? ' con-foto' : ''}`}
            style={portada ? { backgroundImage: `url(${portada})` } : undefined}
            aria-hidden="true"
          />
          <input ref={portadaRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirPortada}
            style={{ display: 'none' }} aria-label="Elegir foto de portada" />
          <div className="perfil-portada-btns">
            <button type="button" className="perfil-portada-btn" onClick={() => portadaRef.current?.click()} disabled={procesandoPortada}>
              {procesandoPortada ? 'Procesando...' : portada ? ' Cambiar portada' : ' Poner foto de portada'}
            </button>
            {portada && (
              <button type="button" className="perfil-portada-btn" onClick={quitarPortada}>Quitar</button>
            )}
          </div>
          {errorPortada && (
            <div role="alert" style={{ position: 'absolute', top: 52, right: 12, maxWidth: 300, zIndex: 3, background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}>
              {errorPortada}
            </div>
          )}
        </div>
        {/* ── Tarjeta de perfil ── */}
        <section className="perfil-tarjeta" aria-label="Mi perfil">
          <div className="perfil-tarjeta-top">
            <div className="perfil-avatar">
              <button
                type="button"
                className="perfil-avatar-btn"
                onClick={() => inputRef.current?.click()}
                disabled={procesando || guardandoFoto}
                aria-label="Cambiar foto de perfil"
                title="Cambiar foto de perfil"
              >
                {previa
                  ? <img src={previa.url} alt="Vista previa de tu foto" style={{ width: 104, height: 104, objectFit: 'cover' }} />
                  : <Avatar usuario={user} size={104} />}
                <span className="perfil-avatar-edit" aria-hidden="true">📷</span>
              </button>
            </div>

            <h1 className="perfil-nombre">{user?.nombre_completo || user?.username}</h1>
            <span className={`badge badge-${user?.rol} perfil-rol`} style={{ fontSize: '0.7rem' }}>{ROL[user?.rol]}</span>
            <div className="perfil-linea" />

            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirArchivo}
              style={{ display: 'none' }} aria-label="Elegir foto de perfil" />

            {previa ? (
              <div className="perfil-foto-acciones">
                <button className="btn btn-primary btn-sm" onClick={guardarFoto} disabled={guardandoFoto}>
                  {guardandoFoto ? 'Guardando...' : '💾 Guardar foto'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPrevia(null)} disabled={guardandoFoto}>Cancelar</button>
              </div>
            ) : null}
            <div className="perfil-dato-et" style={{ marginTop: 10, textTransform: 'none' }}>
  Toca tu foto para cambiarla. JPG, PNG o WEBP; se recorta en cuadrado automáticamente.
</div>
{errorFoto && (
  <div role="alert" className="perfil-dato-et" style={{ margin: '10px auto 0', maxWidth: 420, color: '#ca1616' }}>
    {errorFoto}
  </div>
)}
</div>

          <div className="perfil-datos">
            {dato('Usuario', user?.username)}
            {dato('Correo', user?.email)}
            {dato('Teléfono', user?.telefono)}
            {dato('Puesto', user?.puesto)}
            {dato('Empresa', user?.empresa)}
          </div>
        </section>

        {/* ── Tarjetas: foto y contraseña ── */}
        <div className="perfil-grid">
          {/* Contraseña (el cliente no la cambia desde aquí: si la olvida, la recupera por correo o se la restablece el taller) */}
          {user?.rol !== 'cliente' && (
          <form className="perfil-card" onSubmit={cambiarPassword}>
            <h2 className="perfil-card-titulo">🔒 Cambiar contraseña</h2>
            <div className="perfil-card-linea" />
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
            <button className="btn btn-primary perfil-btn-pw" type="submit" disabled={guardandoPw}>
              {guardandoPw ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 10 }}>
              Al cambiarla se cierra tu sesión en cualquier otro dispositivo.
            </div>
          </form>
          )}
        </div>
      </main>

      <Toast {...toast} onClose={() => setToast(t => ({ ...t, show: false }))} />
    </div>
  )
}
