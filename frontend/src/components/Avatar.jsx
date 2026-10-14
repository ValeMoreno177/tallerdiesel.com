import { useEffect, useState } from 'react'
import api from '../api/client'

// Avatar de usuario: muestra su foto de perfil (si tiene) o sus iniciales.
// La foto no es pública, por eso se pide con el token y se muestra como blob.
// Uso: <Avatar usuario={user} size={34} />
export default function Avatar({ usuario, size = 40 }) {
  const [url, setUrl] = useState(null)
  const id = usuario?.id
  const version = usuario?.foto_version

  useEffect(() => {
    if (!id || !version) { setUrl(null); return }
    let vivo = true, objUrl = null
    api.get(`/usuarios/${id}/foto/?v=${version}`, { responseType: 'blob' })
      .then(res => { if (vivo) { objUrl = URL.createObjectURL(res.data); setUrl(objUrl) } })
      .catch(() => vivo && setUrl(null))
    return () => { vivo = false; if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [id, version])

  const nombre = usuario?.nombre_completo || usuario?.nombre || usuario?.username || ''
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const iniciales = ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?'

  if (url) {
    return (
      <img src={url} alt={`Foto de ${nombre}`}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }} />
    )
  }

  return (
    <span aria-label={nombre ? `Avatar de ${nombre}` : 'Avatar'}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#e85d04', color: 'white', fontWeight: 700,
        fontSize: Math.max(10, Math.round(size * 0.4)), lineHeight: 1, userSelect: 'none',
      }}>
      {iniciales}
    </span>
  )
}
