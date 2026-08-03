import { useEffect, useState } from 'react'

/**
 * Toast flotante y atractivo. Uso:
 *   <Toast show={mostrar} tipo="exito" titulo="¡Listo!" mensaje="Tu solicitud fue enviada." onClose={...} />
 * tipo: 'exito' | 'error' | 'info'
 */
export default function Toast({ show, tipo = 'exito', titulo, mensaje, onClose, duracion = 4500 }) {
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    if (!show) { setSaliendo(false); return }
    setSaliendo(false)
    const t1 = setTimeout(() => setSaliendo(true), duracion - 350)
    const t2 = setTimeout(() => onClose?.(), duracion)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [show, duracion])

  if (!show) return null

  const estilos = {
    exito: { bg: 'linear-gradient(135deg, #059669, #10b981)', icon: '✅', border: '#34d399' },
    error: { bg: 'linear-gradient(135deg, #dc2626, #ef4444)', icon: '⚠️', border: '#f87171' },
    info:  { bg: 'linear-gradient(135deg, #1d4ed8, #2563eb)', icon: 'ℹ️', border: '#60a5fa' },
  }[tipo] || estilos?.exito

  return (
    <div
      style={{
        position: 'fixed', top: 24, right: 24, zIndex: 9999,
        minWidth: 320, maxWidth: 400,
        background: estilos.bg,
        borderRadius: 14, padding: '16px 20px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
        border: `1px solid ${estilos.border}`,
        display: 'flex', alignItems: 'flex-start', gap: 12,
        color: 'white',
        animation: saliendo
          ? 'td-toast-out 0.35s ease forwards'
          : 'td-toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}
    >
      <style>{`
        @keyframes td-toast-in {
          from { transform: translateX(120%) scale(0.9); opacity: 0; }
          to   { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes td-toast-out {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to   { transform: translateX(120%) scale(0.9); opacity: 0; }
        }
      `}</style>
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{estilos.icon}</span>
      <div style={{ flex: 1 }}>
        {titulo && <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>{titulo}</div>}
        {mensaje && <div style={{ fontSize: '0.85rem', opacity: 0.95, lineHeight: 1.4 }}>{mensaje}</div>}
      </div>
      <button
        onClick={() => { setSaliendo(true); setTimeout(() => onClose?.(), 300) }}
        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: 'white', cursor: 'pointer', flexShrink: 0, fontSize: '0.75rem', lineHeight: 1 }}
      >
        ✕
      </button>
    </div>
  )
}
