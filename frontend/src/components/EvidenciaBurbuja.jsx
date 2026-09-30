import { useEffect, useState } from 'react'
import api from '../api/client'

// Muestra una evidencia dentro del historial, como una foto de WhatsApp.
// Las fotos se piden con el token (el archivo no es público) y se ven en grande al hacer clic.
export default function EvidenciaBurbuja({ ticketId, evidencia }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)
  const [grande, setGrande] = useState(false)
  const esPdf = /\.pdf$/i.test(evidencia.nombre_original || '')

  useEffect(() => {
    let vivo = true, objUrl = null
    api.get(`/tickets/${ticketId}/evidencia/${evidencia.id}/`, { responseType: 'blob' })
      .then(res => { if (vivo) { objUrl = URL.createObjectURL(res.data); setUrl(objUrl) } })
      .catch(() => vivo && setError(true))
    return () => { vivo = false; if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [ticketId, evidencia.id])

  if (error) return <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>📎 {evidencia.nombre_original} (no se pudo cargar)</div>
  if (!url) return <div style={{ width: 200, height: 120, borderRadius: 10, background: '#e5e7eb' }} />

  if (esPdf) {
    return (
      <a href={url} target="_blank" rel="noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', textDecoration: 'none', color: '#374151', fontSize: '0.85rem' }}>
        📄 {evidencia.nombre_original}
      </a>
    )
  }

  return (
    <>
      <img src={url} alt={evidencia.nombre_original} onClick={() => setGrande(true)}
        style={{ display: 'block', maxWidth: 260, maxHeight: 260, borderRadius: 10, cursor: 'zoom-in', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
      {grande && (
        <div onClick={() => setGrande(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 16 }}>
          <img src={url} alt={evidencia.nombre_original} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </>
  )
}
