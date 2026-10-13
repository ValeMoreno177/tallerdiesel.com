import { useEffect, useState } from 'react'
import api from '../api/client'

// La foto no es pública: se pide con el token y se guarda en memoria (una sola petición por foto,
// aunque aparezca en varios lugares). La clave incluye la versión, así que al cambiar la foto se recarga sola.
const fotos = new Map()   // "id:versión" -> Promise<string> (URL del blob)

function obtenerFoto(id, version) {
  const clave = `${id}:${version}`
  if (!fotos.has(clave)) {
    const p = api.get(`/usuarios/${id}/foto/`, { params: { v: version }, responseType: 'blob' })
      .then(res => URL.createObjectURL(res.data))
      .catch(err => { fotos.delete(clave); throw err })   // si falla, se puede reintentar luego
    fotos.set(clave, p)
  }
  return fotos.get(clave)
}

/**
 * Foto de perfil redonda. Si la persona no tiene foto (o no carga) muestra su inicial.
 * usuario = { id, foto_version, nombre?, username? }
 */
export default function Avatar({ usuario, size = 34, style, fondo = 'var(--naranja)' }) {
  const id = usuario?.id
  const version = usuario?.foto_version
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!id || !version) { setUrl(null); return undefined }
    let vivo = true
    obtenerFoto(id, version).then(u => vivo && setUrl(u)).catch(() => vivo && setUrl(null))
    return () => { vivo = false }
  }, [id, version])

  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style }
  if (url) {
    return <img src={url} alt={`Foto de ${usuario?.nombre || usuario?.username || 'usuario'}`}
      style={{ ...base, objectFit: 'cover', display: 'block', background: '#e5e7eb' }} />
  }
  const inicial = (usuario?.nombre || usuario?.username || '?').trim()[0]?.toUpperCase() || '?'
  return (
    <div aria-hidden="true" style={{
      ...base, background: fondo, color: 'white', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: Math.max(11, Math.round(size * 0.4)),
    }}>{inicial}</div>
  )
}