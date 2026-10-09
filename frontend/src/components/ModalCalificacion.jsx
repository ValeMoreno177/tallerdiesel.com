import { useState, useEffect } from 'react'
import api from '../api/client'
import Estrellas from './Estrellas'

const MAX_COMENTARIO = 500

/**
 * Ventana para que el cliente califique un servicio finalizado:
 *  - estrellas al técnico (solo si el servicio tuvo técnico) — obligatorio
 *  - estrellas al servicio realizado — obligatorio
 *  - comentario — opcional
 *
 * `pendiente` = { id, ticket_id, tecnico_nombre, unidad, tipo_unidad }
 */
export default function ModalCalificacion({ pendiente, onAplazar, onEnviado }) {
  const tieneTecnico = !!pendiente.tecnico_nombre
  const [calTecnico, setCalTecnico] = useState(0)
  const [calServicio, setCalServicio] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  const listo = calServicio > 0 && (!tieneTecnico || calTecnico > 0)

  // Esc = "Más tarde"
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !enviando && !enviado) onAplazar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enviando, enviado, onAplazar])

  // Tras agradecer, se cierra sola
  useEffect(() => {
    if (!enviado) return undefined
    const t = setTimeout(() => onEnviado(pendiente.id), 1800)
    return () => clearTimeout(t)
  }, [enviado, onEnviado, pendiente.id])

  const enviar = async () => {
    if (!listo) return
    setEnviando(true); setError('')
    try {
      await api.post(`/tickets/${pendiente.id}/calificar/`, {
        calificacion_servicio: calServicio,
        ...(tieneTecnico ? { calificacion_tecnico: calTecnico } : {}),
        comentario: comentario.trim(),
      })
      setEnviado(true)
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo enviar tu calificación. Intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="td-cal-titulo"
           style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #111827 0%, #1e3a5f 100%)', color: 'white', padding: '1.25rem 1.5rem' }}>
          <div id="td-cal-titulo" style={{ fontWeight: 700, fontSize: '1.15rem' }}>
            {enviado ? '¡Gracias por tu opinión!' : '⭐ ¿Cómo te fue con tu servicio?'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginTop: 2 }}>
            Servicio {pendiente.ticket_id}
            {pendiente.unidad ? ` • ${pendiente.tipo_unidad ? pendiente.tipo_unidad + ' ' : ''}${pendiente.unidad}` : ''}
          </div>
        </div>

        {enviado ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <p style={{ marginTop: 8, color: '#374151' }}>Tu calificación nos ayuda a mejorar el servicio.</p>
          </div>
        ) : (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {tieneTecnico && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  👷 Califica al técnico: <span style={{ color: '#1a56db' }}>{pendiente.tecnico_nombre}</span>
                </div>
                <Estrellas valor={calTecnico} onChange={setCalTecnico} etiqueta={`Calificación del técnico ${pendiente.tecnico_nombre}`} />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>🔧 Califica el servicio realizado</div>
              <Estrellas valor={calServicio} onChange={setCalServicio} etiqueta="Calificación del servicio" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="td-cal-comentario">
                Comentario <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                id="td-cal-comentario" className="form-input" rows={3} style={{ resize: 'none' }}
                maxLength={MAX_COMENTARIO} value={comentario}
                placeholder="Cuéntanos qué tal estuvo la atención, el tiempo de respuesta, la reparación…"
                onChange={e => setComentario(e.target.value)}
              />
              <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#9ca3af' }}>{comentario.length}/{MAX_COMENTARIO}</div>
            </div>
            {error && (
              <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>{error}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-ghost" disabled={enviando} onClick={onAplazar}>Más tarde</button>
              <button type="button" className="btn btn-primary" disabled={!listo || enviando} onClick={enviar}>
                {enviando ? 'Enviando...' : 'Enviar calificación'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}