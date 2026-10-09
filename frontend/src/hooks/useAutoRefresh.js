import { useEffect, useRef } from 'react'
import { REFRESCO_MS } from '../config/tiempos'

// Evento global para pedir un refresco inmediato de todo lo que usa este hook
// (por ejemplo, justo después de enviar una calificación).
export const EVENTO_REFRESCAR = 'td:refrescar'
export const refrescarAhora = () => window.dispatchEvent(new Event(EVENTO_REFRESCAR))

/**
 * Ejecuta `callback` cada 30 s (REFRESCO_MS) mientras el componente esté montado.
 *
 *  - activo:       false pausa la actualización.
 *  - inmediato:    además la ejecuta una vez al montar (útil si el componente no carga por su cuenta).
 *  - soloVisible:  true = no consulta mientras la pestaña está oculta y se pone al día al volver.
 *                  (Déjalo en false para las alertas: así suenan aunque estés en otra pestaña.)
 *
 * Nunca se empalman dos ejecuciones: si una consulta sigue en curso, se salta ese turno.
 */
export default function useAutoRefresh(callback, { activo = true, inmediato = false, soloVisible = false, intervalo = REFRESCO_MS } = {}) {
  const cbRef = useRef(callback)
  useEffect(() => { cbRef.current = callback })

  useEffect(() => {
    if (!activo) return undefined
    let enCurso = false
    let vivo = true

    const ejecutar = async () => {
      if (enCurso || !vivo) return
      enCurso = true
      try { await cbRef.current?.() } catch { /* un fallo de red no debe detener el ciclo */ }
      finally { enCurso = false }
    }

    const alTic = () => { if (!(soloVisible && document.hidden)) ejecutar() }
    const alVolver = () => { if (soloVisible && !document.hidden) ejecutar() }

    if (inmediato) ejecutar()
    const id = setInterval(alTic, intervalo)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener(EVENTO_REFRESCAR, ejecutar)
    return () => {
      vivo = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener(EVENTO_REFRESCAR, ejecutar)
    }
  }, [activo, inmediato, soloVisible, intervalo])
}