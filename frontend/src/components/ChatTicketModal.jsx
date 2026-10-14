import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../api/client'
import EvidenciaBurbuja from './EvidenciaBurbuja'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'
import useAutoRefresh from '../hooks/useAutoRefresh'
import { NOTIFICACIONES_MS } from '../config/tiempos'
import { comprimirEvidencia } from '../utils/imagen'

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
  const fotoRef = useRef(null)
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
        const listo = await comprimirEvidencia(archivo)   // las fotos de cámara se reducen antes de subir
        const form = new FormData()
        form.append('archivo', listo, listo.name)
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
  // Solo el Administrador puede editar sus mensajes; clientes y coordinadores no.
  const puedeEditarMensajes = user?.rol === 'admin'
  const puedeSubirEvidencia = user?.rol === 'cliente'
    ? ticketInfo.cliente === user.id
    : ['coordinador', 'admin'].includes(user?.rol)
  const fechaMensaje = fecha => new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const titulo = ticketInfo.etiqueta || ticketInfo.ticket_id || `Ticket ${ticket.id}`
  const horaMensaje = fecha => new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const autorDe = comentario => (
    comentario.autor === user?.id
      ? user
      : { id: comentario.autor, nombre_completo: comentario.autor_nombre, foto_version: comentario.autor_foto_version }
  )

  return (
    <div
      role="presentation"
      className="tdchat-overlay"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <style>{ESTILOS_CHAT}</style>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Chat del servicio ${titulo}`}
        className="tdchat"
      >
        <header className="tdchat-header">
          <button type="button" className="tdchat-icono" onClick={onClose} aria-label="Cerrar chat">‹</button>
          <span className="tdchat-logo" aria-hidden="true">🚛</span>
          <div className="tdchat-titulo">
            <strong>{titulo}</strong>
            <span>
              {ticketInfo.empresa || 'Chat del servicio'}
              {ticketInfo.unidad ? ` · ${ticketInfo.unidad}` : ''}
            </span>
          </div>
          <button type="button" className="tdchat-icono" onClick={onClose} aria-label="Cerrar chat">✕</button>
        </header>

        <div className="tdchat-cuerpo">
          {cargando && <div className="tdchat-aviso">Cargando mensajes...</div>}
          {!cargando && comentarios.length === 0 && (
            <div className="tdchat-aviso">Aún no hay mensajes. Escribe para iniciar la conversación.</div>
          )}
          {comentarios.map((comentario, i) => {
            const mio = comentario.autor === user?.id
            const evidencia = evidenciaDe(comentario)
            const editando = editandoId === comentario.id
            const dia = new Date(comentario.fecha).toDateString()
            const nuevoDia = i === 0 || new Date(comentarios[i - 1].fecha).toDateString() !== dia
            return (
              <div key={comentario.id}>
                {nuevoDia && (
                  <div className="tdchat-dia">
                    {new Date(comentario.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                )}
                <div className={`tdchat-fila ${mio ? 'mia' : ''}`}>
                  <article className={`tdchat-burbuja ${mio ? 'mia' : ''} ${editando || evidencia ? 'ancha' : ''}`}>
                    <Avatar usuario={autorDe(comentario)} size={36} />
                    <div className="tdchat-contenido">
                      <span className="tdchat-autor">{mio ? 'Tú' : comentario.autor_nombre || 'Usuario'}</span>
                      {evidencia ? (
                        <EvidenciaBurbuja ticketId={ticket.id} evidencia={evidencia} />
                      ) : editando ? (
                        <div className="tdchat-edicion">
                          <textarea
                            rows={3}
                            value={textoEdicion}
                            autoFocus
                            onFocus={event => event.target.setSelectionRange(event.target.value.length, event.target.value.length)}
                            onChange={event => setTextoEdicion(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); guardarEdicion(comentario.id) }
                              if (event.key === 'Escape') { event.stopPropagation(); setEditandoId(null) }
                            }}
                          />
                          <div>
                            <button type="button" className="tdchat-btn-sec" onClick={() => setEditandoId(null)}>Cancelar</button>
                            <button type="button" className="tdchat-btn-pri" onClick={() => guardarEdicion(comentario.id)}>Guardar</button>
                          </div>
                        </div>
                      ) : (
                        <p className="tdchat-texto">
                          {comentario.texto}
                          {comentario.editado && <span className="tdchat-editado"> (editado)</span>}
                          {mio && puedeEditarMensajes && (
                            <button
                              type="button"
                              className="tdchat-lapiz"
                              title="Editar mensaje"
                              aria-label="Editar mensaje"
                              onClick={() => { setEditandoId(comentario.id); setTextoEdicion(comentario.texto) }}
                            >✏️</button>
                          )}
                        </p>
                      )}
                    </div>
                  </article>
                  <time className="tdchat-hora" title={fechaMensaje(comentario.fecha)}>{horaMensaje(comentario.fecha)}</time>
                </div>
              </div>
            )
          })}
          <div ref={finMensajes} />
        </div>

        {error && <div role="alert" className="tdchat-error">{error}</div>}

        <form onSubmit={enviarMensaje} className="tdchat-form">
          <div className="tdchat-caja">
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
                <input
                  ref={fotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={subirEvidencias}
                />
              </>
            )}
            <textarea
              rows={1}
              placeholder="Escribe un mensaje..."
              value={mensaje}
              onChange={event => setMensaje(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  enviarMensaje(event)
                }
              }}
            />
            {puedeSubirEvidencia && (
              <>
                <button type="button" className="tdchat-adjunto" title="Adjuntar evidencia" aria-label="Adjuntar evidencia"
                  disabled={subiendo} onClick={() => archivoRef.current?.click()}>{subiendo ? '…' : '📎'}</button>
                <button type="button" className="tdchat-adjunto" title="Tomar foto" aria-label="Tomar foto"
                  disabled={subiendo} onClick={() => fotoRef.current?.click()}>{subiendo ? '…' : '📷'}</button>
              </>
            )}
          </div>
          <button className="tdchat-enviar" type="submit" disabled={enviando || !mensaje.trim()} aria-label="Enviar mensaje">
            {enviando ? '…' : '➤'}
          </button>
        </form>
      </section>
    </div>
  )
}

// Colores del logo: azul marino (#111827) + naranja (#e85d04)
const ESTILOS_CHAT = `
  .tdchat-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(15,23,42,0.6);
    display: flex; align-items: center; justify-content: center; padding: 16px; }
  .tdchat { width: min(100%, 460px); height: min(82vh, 680px); display: flex; flex-direction: column;
    overflow: hidden; border-radius: 22px; box-shadow: 0 28px 70px rgba(0,0,0,0.4);
    background:
      radial-gradient(circle at 15% 20%, rgba(232,93,4,0.28) 0, transparent 45%),
      radial-gradient(circle at 85% 75%, rgba(249,115,22,0.30) 0, transparent 50%),
      linear-gradient(170deg, #111827 0%, #1f2937 55%, #3b2a22 100%); }
  .tdchat-header { display: flex; align-items: center; gap: 10px; padding: 14px 14px;
    background: rgba(17,24,39,0.75); backdrop-filter: blur(8px); border-bottom: 2px solid #e85d04; color: white; }
  .tdchat-icono { background: rgba(255,255,255,0.08); border: 0; color: white; width: 34px; height: 34px;
    border-radius: 50%; cursor: pointer; font-size: 1.15rem; line-height: 1; flex-shrink: 0; }
  .tdchat-icono:hover { background: #e85d04; }
  .tdchat-logo { width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center;
    justify-content: center; background: linear-gradient(135deg, #e85d04, #f97316); font-size: 1.25rem;
    box-shadow: 0 0 0 3px rgba(255,255,255,0.15); flex-shrink: 0; }
  .tdchat-titulo { flex: 1; min-width: 0; }
  .tdchat-titulo strong { display: block; font-size: 1.1rem; letter-spacing: 0.3px; }
  .tdchat-titulo span { display: block; font-size: 0.78rem; color: #fdba74; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
  .tdchat-cuerpo { flex: 1; overflow-y: auto; padding: 16px 14px 8px; }
  .tdchat-aviso { text-align: center; color: rgba(255,255,255,0.7); padding: 24px; }
  .tdchat-dia { text-align: center; margin: 6px 0 14px; font-size: 0.7rem; color: rgba(255,255,255,0.75);
    text-transform: capitalize; }
  .tdchat-dia::before, .tdchat-dia::after { content: ''; display: inline-block; width: 40px; height: 1px;
    background: rgba(255,255,255,0.25); vertical-align: middle; margin: 0 8px; }
  .tdchat-fila { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .tdchat-fila.mia { flex-direction: row-reverse; }
  .tdchat-burbuja { display: flex; align-items: center; gap: 10px; max-width: 80%; padding: 8px 18px 8px 8px;
    background: white; color: #111827; border-radius: 30px; box-shadow: 0 6px 18px rgba(0,0,0,0.18);
    animation: tdchatEntra 0.25s ease-out; }
  .tdchat-burbuja.mia { flex-direction: row-reverse; padding: 8px 8px 8px 18px; color: white;
    background: linear-gradient(135deg, #e85d04, #f97316); }
  .tdchat-burbuja.ancha { border-radius: 20px; align-items: flex-start; min-width: 70%; }
  .tdchat-contenido { min-width: 0; }
  .tdchat-burbuja.mia .tdchat-contenido { text-align: right; }
  .tdchat-autor { display: block; font-size: 0.68rem; color: #9ca3af; margin-bottom: 1px; }
  .tdchat-burbuja.mia .tdchat-autor { color: rgba(255,255,255,0.8); }
  .tdchat-texto { margin: 0; font-size: 0.98rem; font-weight: 500; white-space: pre-wrap; overflow-wrap: anywhere; }
  .tdchat-editado { font-size: 0.68rem; opacity: 0.7; font-weight: 400; }
  .tdchat-lapiz { background: none; border: 0; cursor: pointer; margin-left: 6px; font-size: 0.8rem;
    opacity: 0.75; padding: 0; }
  .tdchat-lapiz:hover { opacity: 1; }
  .tdchat-hora { font-size: 0.68rem; color: rgba(255,255,255,0.7); white-space: nowrap; }
  .tdchat-edicion { display: flex; flex-direction: column; gap: 6px; min-width: 220px; }
  .tdchat-edicion textarea { width: 100%; box-sizing: border-box; resize: vertical; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.6); padding: 8px 10px; font: inherit; color: #111827; }
  .tdchat-edicion > div { display: flex; justify-content: flex-end; gap: 6px; }
  .tdchat-btn-sec, .tdchat-btn-pri { border: 0; border-radius: 999px; padding: 5px 12px; cursor: pointer;
    font-weight: 600; font-size: 0.78rem; }
  .tdchat-btn-sec { background: rgba(255,255,255,0.85); color: #374151; }
  .tdchat-btn-pri { background: #111827; color: white; }
  .tdchat-error { padding: 7px 14px; background: #fef2f2; color: #991b1b; font-size: 0.8rem; }
  .tdchat-form { display: flex; align-items: center; gap: 8px; padding: 12px; }
  .tdchat-caja { flex: 1; display: flex; align-items: center; gap: 4px; background: white;
    border-radius: 999px; padding: 6px 8px 6px 18px; box-shadow: 0 6px 18px rgba(0,0,0,0.2); }
  .tdchat-caja textarea { flex: 1; border: 0; outline: none; resize: none; font: inherit; font-size: 0.95rem;
    max-height: 90px; padding: 6px 0; background: transparent; color: #111827; }
  .tdchat-adjunto { background: none; border: 0; cursor: pointer; font-size: 1.1rem; width: 34px; height: 34px;
    border-radius: 50%; }
  .tdchat-adjunto:hover { background: #fff1e6; }
  .tdchat-enviar { width: 48px; height: 48px; border-radius: 50%; border: 0; cursor: pointer; flex-shrink: 0;
    background: linear-gradient(135deg, #e85d04, #f97316); color: white; font-size: 1.2rem;
    box-shadow: 0 6px 18px rgba(232,93,4,0.45); transition: transform 0.15s; }
  .tdchat-enviar:hover:not(:disabled) { transform: scale(1.07); }
  .tdchat-enviar:disabled { opacity: 0.5; cursor: default; }
  @keyframes tdchatEntra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (max-width: 520px) {
    .tdchat-overlay { padding: 0; }
    .tdchat { width: 100%; height: 100%; border-radius: 0; }
    .tdchat-burbuja { max-width: 86%; }
  }
  @media (prefers-reduced-motion: reduce) { .tdchat-burbuja { animation: none; } }
`
