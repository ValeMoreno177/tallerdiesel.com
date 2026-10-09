import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import useAutoRefresh, { refrescarAhora } from '../hooks/useAutoRefresh'
import ModalCalificacion from './ModalCalificacion'
import Toast from './Toast'

// Para abrir la ventana de calificación desde cualquier parte (campana, bitácora, detalle del ticket):
//   window.dispatchEvent(new CustomEvent(EVENTO_CALIFICAR, { detail: { ticketId } }))
export const EVENTO_CALIFICAR = 'td:calificar'
export const pedirCalificacion = (ticketId) =>
  window.dispatchEvent(new CustomEvent(EVENTO_CALIFICAR, { detail: { ticketId } }))

/**
 * Solo para clientes. Cuando un servicio pasa a "Finalizado" (lo confirme el cliente o lo cierre
 * el coordinador/admin), a los ≤30 s aparece la ventana para calificar al técnico y al servicio.
 *  - "Más tarde" la oculta hasta recargar la página o volver a iniciar sesión;
 *    mientras tanto sigue pendiente en la campana 🔔 y en la bitácora.
 *  - Una vez enviada la calificación no vuelve a pedirse.
 */
export default function CalificacionGlobal() {
  const { user } = useAuth()
  const esCliente = user?.rol === 'cliente'
  const [pendientes, setPendientes] = useState([])
  const [abierto, setAbierto] = useState(null)
  const [aviso, setAviso] = useState('')
  const aplazados = useRef(new Set())

  // Al cambiar de usuario se limpia todo
  useEffect(() => {
    aplazados.current = new Set()
    setPendientes([]); setAbierto(null)
  }, [user?.id])

  const consultar = useCallback(async () => {
    const { data } = await api.get('/tickets/pendientes_calificar/')
    setPendientes(data)
  }, [])

  useAutoRefresh(consultar, { activo: esCliente, inmediato: true })

  // Abre solo la siguiente pendiente que el cliente no haya pospuesto
  useEffect(() => {
    if (!esCliente || abierto) return
    const siguiente = pendientes.find(p => !aplazados.current.has(p.id))
    if (siguiente) setAbierto(siguiente)
  }, [pendientes, abierto, esCliente])

  // Apertura manual (campana / bitácora / detalle del ticket)
  useEffect(() => {
    if (!esCliente) return undefined
    const alPedir = async (e) => {
      const id = e.detail?.ticketId
      if (!id) return
      try {
        const { data: t } = await api.get(`/tickets/${id}/`)
        if (t.puede_calificar) {
          setAbierto({ id: t.id, ticket_id: t.ticket_id, tecnico_nombre: t.tecnico_nombre, unidad: t.unidad, tipo_unidad: t.tipo_unidad })
        } else if (t.calificado) {
          setAviso('Este servicio ya fue calificado. ¡Gracias!')
        }
      } catch { /* sin conexión: el siguiente intento lo resuelve */ }
    }
    window.addEventListener(EVENTO_CALIFICAR, alPedir)
    return () => window.removeEventListener(EVENTO_CALIFICAR, alPedir)
  }, [esCliente])

  const aplazar = useCallback(() => {
    // "Más tarde" pospone TODAS las pendientes de esta sesión (no se encadenan ventanas)
    pendientes.forEach(p => aplazados.current.add(p.id))
    if (abierto) aplazados.current.add(abierto.id)
    setAbierto(null)
  }, [pendientes, abierto])

  const enviado = useCallback((id) => {
    // Se quita de inmediato de la lista local para que la ventana no se vuelva a abrir
    // mientras llega la respuesta del servidor.
    setPendientes(prev => prev.filter(p => p.id !== id))
    setAbierto(null)
    setAviso('¡Gracias por tu calificación!')
    consultar().catch(() => {})
    refrescarAhora()   // campana, bitácora y detalle se actualizan al instante
  }, [consultar])

  if (!esCliente) return null
  return (
    <>
      {abierto && <ModalCalificacion key={abierto.id} pendiente={abierto} onAplazar={aplazar} onEnviado={enviado} />}
      <Toast show={!!aviso} tipo="exito" titulo={aviso} onClose={() => setAviso('')} />
    </>
  )
}