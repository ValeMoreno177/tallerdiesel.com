import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/client'
import EvidenciaBurbuja from './EvidenciaBurbuja'
import { useAuth } from '../context/AuthContext'
import useAutoRefresh from '../hooks/useAutoRefresh'
import { NOTIFICACIONES_MS } from '../config/tiempos'

export function BotonChat({ ticket, onClick, compacto = false }) {
  const pendientes = Math.max(0, Number(ticket.mensajes_no_leidos) || 0)
  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      onClick={onClick}
      title={pendientes ? `${pendientes} mensajes sin leer` : 'Abrir chat del servicio'}
      aria-label={`Abrir chat del servicio${pendientes ? `, ${pendientes} mensajes sin leer` : ''}`}
      style={{ position: 'relative', whiteSpace: 'nowrap' }}
    >
      {compacto ? '💬' : '💬 Chat'}
      {pendientes > 0 && (
        <span style={{
          position: 'absolute', top: -8, right: -8, minWidth: 18, height: 18,
          padding: '0 4px', borderRadius: 10, background: '#dc2626', color: 'white',
          fontSize: '0.68rem', lineHeight: '18px', fontWeight: 700, textAlign: 'center',
          boxShadow: '0 0 0 2px white',
        }}>
          {pendientes > 99 ? '99+' : pendientes}
        </span>
      )}
    </button>
  )
}

export default function ChatTicketModal({ ticket, onClose, onRead }) {
  const { user } = useAuth()
  const [comentarios, setComentarios] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [ticketInfo, setTicketInfo] = useState(ticket)
  const [evidenciasTicket, setEvidenciasTicket] = useState(ticket.evidencias || [])
  const finMensajes = useRef(null)
  const archivoRef = useRef(null)
  const idsComentarios = useRef(null)
  const onReadRef = useRef(onRead)

  useEffect(() => { onReadRef.current = onRead }, [onRead])

  const marcarLeidos = useCallback(async () => {
    const { data } = await api.post(`/tickets/${ticket.id}/marcar-mensajes-leidos/`)
    if (data.marcados > 0) onReadRef.current?.()
  }, [ticket.id])

  const cargarMensajes = useCallback(async () => {
    try {
      const { data } = await api.get(`/tickets/${ticket.id}/mensajes/`)
      const visibles = data.comentarios.filter(c => !c.es_cambio_estatus)
      setTicketInfo(prev => ({ ...prev, etiqueta: data.etiqueta }))
      const idsNuevos = new Set(visibles.map(c => c.id))
      const hayMensajeEntrante = idsComentarios.current && visibles.some(
        c => c.autor !== user?.id && !idsComentarios.current.has(c.id),
      )
      const hayEvidenciaNueva = visibles.some(
        c => c.evidencia && !evidenciasTicket.some(e => e.id === c.evidencia),
      )
      idsComentarios.current = idsNuevos
      setComentarios(visibles)
      setError('')
      setCargando(false)
      if (hayEvidenciaNueva) {
        try {
          const { data: ticketActualizado } = await api.get(`/tickets/${ticket.id}/`)
          setEvidenciasTicket(ticketActualizado.evidencias || [])
        } catch {
          setError('No se pudieron cargar las evidencias del servicio.')
        }
      }
      if (hayMensajeEntrante) {
        try {
          await marcarLeidos()
        } catch {
          setError('No se pudieron marcar los mensajes como leídos.')
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'No se pudieron cargar los mensajes.')
      setCargando(false)
    }
  }, [evidenciasTicket, marcarLeidos, ticket.id, user?.id])

  useEffect(() => {
    setTicketInfo(ticket)
    setEvidenciasTicket(ticket.evidencias || [])
    if (!ticket.evidencias) {
      api.get(`/tickets/${ticket.id}/`)
        .then(({ data }) => setEvidenciasTicket(data.evidencias || []))
        .catch(err => setError(err?.response?.data?.detail || 'No se pudieron cargar los datos del servicio.'))
    }
  }, [ticket])

  useEffect(() => {
    marcarLeidos().catch(() => setError('No se pudieron marcar los mensajes como leídos.'))
  }, [marcarLeidos])

  useAutoRefresh(cargarMensajes, { activo: true, inmediato: true, intervalo: NOTIFICACIONES_MS })

  useEffect(() => {
    finMensajes.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [comentarios.length])

  useEffect(() => {
    const cerrarConEscape = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', cerrarConEscape)
    return () => document.removeEventListener('keydown', cerrarConEscape)
  }, [onClose])

  const enviarMensaje = async event => {
    event.preventDefault()
    if (!mensaje.trim() || enviando) return
    setEnviando(true)
    setError('')
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/agregar_comentario/`, { texto: mensaje.trim() })
      setComentarios(prev => [...prev, data])
      idsComentarios.current?.add(data.id)
      setMensaje('')
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  const guardarEdicion = async id => {
    if (!textoEdicion.trim()) return
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/editar_comentario/`, {
        comentario_id: id,
        texto: textoEdicion.trim(),
      })
      setComentarios(prev => prev.map(c => c.id === data.id ? data : c))
      setEditandoId(null)
      setError('')
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo editar el mensaje.')
    }
  }

  const subirEvidencias = async event => {
    const archivos = Array.from(event.target.files || [])
    event.target.value = ''
    if (!archivos.length) return
    setSubiendo(true)
    setError('')
    try {
      for (const archivo of archivos) {
        const form = new FormData()
        form.append('archivo', archivo)
        const { data } = await api.post(`/tickets/${ticket.id}/subir_evidencia/`, form)
        setEvidenciasTicket(data.evidencias || [])
      }
      await cargarMensajes()
      await marcarLeidos()
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo subir la evidencia.')
    } finally {
      setSubiendo(false)
    }
  }

  const evidenciaDe = comentario => {
    if (comentario.evidencia) return evidenciasTicket.find(e => e.id === comentario.evidencia) || null
    const nombre = String(comentario.texto).match(/^📎 Evidencia del servicio subida: (.+)$/)?.[1]
    return nombre ? [...evidenciasTicket].reverse().find(e => e.nombre_original === nombre) || null : null
  }
  const puedeSubirEvidencia = user?.rol === 'coordinador' || user?.rol === 'admin'
  const fechaMensaje = fecha => new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Chat del servicio ${ticketInfo.etiqueta || ticketInfo.ticket_id || ticket.id}`}
        style={{
          width: 'min(100%, 500px)', height: 'min(72vh, 600px)', background: 'white',
          borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '14px 18px', borderBottom: '1px solid #e5e7eb',
        }}>
          <div>
            <strong style={{ display: 'block', fontSize: '1rem' }}>💬 Chat del servicio</strong>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              {ticketInfo.etiqueta || ticketInfo.ticket_id || `Ticket ${ticket.id}`}
              {ticketInfo.unidad ? ` · Unidad ${ticketInfo.unidad}` : ''}
            </span>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar chat">✕</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#f8fafc' }}>
          {cargando && <div style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>Cargando mensajes...</div>}
          {!cargando && comentarios.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
              Aún no hay mensajes. Escribe para iniciar la conversación.
            </div>
          )}
          {comentarios.map(comentario => {
            const mio = comentario.autor === user?.id
            const evidencia = evidenciaDe(comentario)
            return (
              <div key={comentario.id} style={{
                display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start', marginBottom: 10,
              }}>
                <article style={{
                  maxWidth: '85%', minWidth: 120, padding: '9px 12px',
                  borderRadius: mio ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  background: mio ? '#dbeafe' : 'white', border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', gap: 18, marginBottom: 4,
                    color: '#475569', fontSize: '0.72rem',
                  }}>
                    <strong>{mio ? 'Tú' : comentario.autor_nombre || 'Usuario'}</strong>
                    <time>{fechaMensaje(comentario.fecha)}</time>
                  </div>
                  {evidencia ? (
                    <EvidenciaBurbuja ticketId={ticket.id} evidencia={evidencia} />
                  ) : editandoId === comentario.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="form-input"
                        value={textoEdicion}
                        autoFocus
                        onChange={event => setTextoEdicion(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') guardarEdicion(comentario.id)
                          if (event.key === 'Escape') setEditandoId(null)
                        }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => guardarEdicion(comentario.id)}>Guardar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#1f2937', fontSize: '0.9rem' }}>
                      {comentario.texto}
                      {comentario.editado && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}> (editado)</span>}
                      {mio && (
                        <button
                          type="button"
                          title="Editar mensaje"
                          onClick={() => { setEditandoId(comentario.id); setTextoEdicion(comentario.texto) }}
                          style={{ background: 'none', border: 0, cursor: 'pointer', marginLeft: 6 }}
                        >✏️</button>
                      )}
                    </div>
                  )}
                </article>
              </div>
            )
          })}
          <div ref={finMensajes} />
        </div>

        {error && (
          <div role="alert" style={{ padding: '7px 14px', background: '#fef2f2', color: '#991b1b', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={enviarMensaje} style={{
          display: 'flex', alignItems: 'flex-end', gap: 8, padding: 12, borderTop: '1px solid #e5e7eb',
        }}>
          {puedeSubirEvidencia && (
            <>
              <input
                ref={archivoRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }}
                onChange={subirEvidencias}
              />
              <button
                type="button"
                className="btn btn-ghost"
                title="Adjuntar evidencia"
                disabled={subiendo}
                onClick={() => archivoRef.current?.click()}
              >{subiendo ? '...' : '📎'}</button>
            </>
          )}
          <textarea
            className="form-input"
            rows={2}
            placeholder="Escribe un mensaje..."
            value={mensaje}
            onChange={event => setMensaje(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                enviarMensaje(event)
              }
            }}
            style={{ flex: 1, resize: 'none' }}
          />
          <button className="btn btn-primary" type="submit" disabled={enviando || !mensaje.trim()}>
            {enviando ? '...' : 'Enviar'}
          </button>
        </form>
      </section>
    </div>
  )
}
