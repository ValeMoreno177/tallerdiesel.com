import Estrellas from './Estrellas'

/** Calificación del técnico ya enviada por el cliente (solo lectura). */
export default function ResumenCalificacion({ detalle, tecnicoNombre, titulo = 'Calificación del cliente' }) {
  if (!detalle) return null
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#78350f' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>⭐ {titulo}</div>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Técnico{tecnicoNombre ? `: ${tecnicoNombre}` : ''}</div>
        <Estrellas valor={detalle.calificacion_tecnico} soloLectura tamano={20} etiqueta="Calificación del técnico" />
      </div>
      {detalle.comentario && (
        <div style={{ marginTop: 6, fontStyle: 'italic', color: '#57534e' }}>“{detalle.comentario}”</div>
      )}
    </div>
  )
}