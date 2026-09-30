import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMenuItems } from '../utils/menuItems'

// Qué explica cada pestaña del menú.
const TEXTOS = {
  '/cliente/dashboard': 'Aquí ves el resumen de tus servicios: cuántos están en curso, cuántos ya terminaron y si tienes pagos pendientes.',
  '/solicitar-servicio': 'Pide ayuda a un coordinador. Él te asigna un técnico y le da seguimiento a tu servicio de principio a fin.',
  '/solicitar-tecnico': 'Elige en el mapa a un técnico cercano y solicítalo directamente, sin pasar por un coordinador.',
  '/cliente/bitacora': 'El historial de todos tus servicios: estatus, comentarios y evidencias. Aquí también confirmas cuándo se finaliza un servicio.',
  '/admin/dashboard': 'Resumen ejecutivo del negocio: ingresos, ganancia, servicios en proceso y estado de las facturas.',
  '/coordinador/dashboard': 'Resumen de tus servicios: cuántos están en proceso, pendientes o finalizados.',
  '/admin/bitacora': 'El registro de todos los servicios (tickets). Agrega y edita servicios, asigna técnicos, revisa totales y facturas, y sube evidencias.',
  '/coordinador/bitacora': 'Tus servicios y los que aún no tienen coordinador. Da seguimiento, comenta con el cliente, asigna técnico y sube evidencias.',
  '/admin/usuarios': 'Administra las cuentas del sistema: clientes, coordinadores y sus permisos.',
  '/coordinador/usuarios': 'Administra las cuentas del sistema: clientes y coordinadores.',
  '/mapa-tecnicos': 'Mapa con los técnicos disponibles por zona, con su disponibilidad y calificaciones.',
  '/admin/configuracion': 'Los datos generales de la empresa: nombre, RFC, dirección y contacto.',
}

function construirPasos(user) {
  const pasos = [{
    titulo: `¡Bienvenido${user?.nombre ? ', ' + user.nombre : ''} a TallerDiesel! 👋`,
    texto: 'Te mostramos rápido para qué sirve cada sección. Puedes omitir el recorrido cuando quieras.',
  }]
  getMenuItems(user).forEach(it => {
    pasos.push({
      to: it.to,
      target: `[data-tour="${it.to}"]`,
      titulo: `${it.icon} ${it.label}`,
      texto: TEXTOS[it.to] || 'Una sección del sistema.',
    })
  })
  pasos.push({
    target: '[data-tour="tutorial"]',
    titulo: '¡Listo! 🎉',
    texto: 'Cuando quieras volver a ver este recorrido, usa el botón "Ver tutorial" del menú.',
  })
  return pasos
}

const ANCHO = 330

export default function TourGuia() {
  const { user, tourForzado, terminarTour } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState(null)

  const activo = !!user && (tourForzado || user.tour_completado === false)
  const pasos = activo ? construirPasos(user) : []
  const paso = pasos[idx]

  // Cada vez que se reactiva el tour (ej. "Ver tutorial") empieza desde el paso 1
  useEffect(() => { if (activo) setIdx(0) }, [activo])

  const medir = useCallback((p) => {
    if (!p || !p.target) { setRect(null); return false }
    const el = document.querySelector(p.target)
    if (!el) return false
    const r = el.getBoundingClientRect()
    // En celular el menú está oculto: sin elemento visible, el mensaje sale centrado
    const visible = r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= window.innerWidth
    setRect(visible ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
    return true
  }, [])

  useEffect(() => {
    if (!activo || !paso) return
    if (paso.to && location.pathname !== paso.to) { navigate(paso.to); return }
    let cancelado = false, intentos = 0
    const buscar = () => {
      if (cancelado) return
      if (!medir(paso) && paso.target && intentos++ < 20) setTimeout(buscar, 100)
    }
    buscar()
    const onResize = () => medir(paso)
    window.addEventListener('resize', onResize)
    return () => { cancelado = true; window.removeEventListener('resize', onResize) }
  }, [activo, idx, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!activo || !paso) return null

  const esUltimo = idx === pasos.length - 1
  const cerrar = () => { setIdx(0); terminarTour() }
  const junto = rect && rect.left + rect.width + 16 + ANCHO < window.innerWidth
  const estiloTooltip = junto
    ? { top: Math.max(12, Math.min(rect.top - 8, window.innerHeight - 250)), left: rect.left + rect.width + 16 }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <>
      {/* Capa que evita clics en la página mientras dura el recorrido */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2990, background: rect ? 'transparent' : 'rgba(0,0,0,0.6)' }} />
      {rect && (
        <div style={{
          position: 'fixed', zIndex: 2991, pointerEvents: 'none', borderRadius: 10,
          top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px var(--naranja, #f97316)',
          transition: 'all .25s ease',
        }} />
      )}
      <div role="dialog" aria-label="Recorrido guiado" style={{
        position: 'fixed', zIndex: 2992, width: ANCHO, maxWidth: 'calc(100vw - 24px)',
        background: 'white', borderRadius: 14, padding: '1.1rem 1.25rem',
        boxShadow: '0 20px 45px rgba(0,0,0,0.35)', ...estiloTooltip,
      }}>
        {junto && (
          <div style={{ position: 'absolute', left: -7, top: 22, width: 14, height: 14, background: 'white', transform: 'rotate(45deg)' }} />
        )}
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>
          PASO {idx + 1} DE {pasos.length}
        </div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6, color: '#111827' }}>{paso.titulo}</div>
        <div style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.55, marginBottom: 16 }}>{paso.texto}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {esUltimo ? <span /> : (
            <button className="btn btn-sm btn-ghost" onClick={cerrar}>Omitir</button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {idx > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setIdx(i => i - 1)}>Anterior</button>}
            <button className="btn btn-sm btn-primary" onClick={() => esUltimo ? cerrar() : setIdx(i => i + 1)}>
              {esUltimo ? '¡Entendido!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
