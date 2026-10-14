// Pantallas de carga tipo "esqueleto": bloques grises con un brillo que pasa, en lugar del spinner.
// Se sienten más rápidas porque ya muestran la forma de lo que va a aparecer.
//   <EsqueletoTabla filas={6} />      → para la Bitácora
//   <EsqueletoTarjetas cantidad={4} /> → para los dashboards
//   <PantallaCargando />               → mientras se descarga una pantalla

const ESTILOS = `
  .esq { background: var(--esq-base, #e5e7eb); border-radius: 6px; position: relative; overflow: hidden; }
  .esq::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, var(--esq-brillo, rgba(255,255,255,0.65)), transparent);
    animation: esqBrillo 1.3s ease-in-out infinite;
  }
  @keyframes esqBrillo { to { transform: translateX(100%); } }
  @media (prefers-reduced-motion: reduce) { .esq::after { animation: none; } }
`

export function Bloque({ ancho = '100%', alto = 14, redondo = false, style }) {
  return <span className="esq" style={{ display: 'block', width: ancho, height: alto, borderRadius: redondo ? '50%' : 6, ...style }} />
}

export function EsqueletoTabla({ filas = 6, columnas = 7 }) {
  return (
    <div className="card" style={{ padding: 0 }} aria-busy="true" aria-label="Cargando información">
      <style>{ESTILOS}</style>
      <div style={{ background: '#111', height: 44, borderRadius: '8px 8px 0 0' }} />
      {Array.from({ length: filas }).map((_, f) => (
        <div key={f} style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
          {Array.from({ length: columnas }).map((_, c) => (
            <Bloque key={c} ancho={c === 0 ? 70 : c === 3 ? 80 : `${8 + ((f + c) % 4) * 3}%`} alto={c === 3 ? 20 : 12}
              style={c === 3 ? { borderRadius: 999 } : undefined} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function EsqueletoTarjetas({ cantidad = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}
      aria-busy="true" aria-label="Cargando información">
      <style>{ESTILOS}</style>
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Bloque ancho="45%" alto={11} />
          <Bloque ancho="70%" alto={26} />
          <Bloque ancho="35%" alto={10} />
        </div>
      ))}
    </div>
  )
}

export function PantallaCargando() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }} aria-busy="true" aria-label="Cargando">
      <style>{ESTILOS}</style>
      <div style={{ width: 'var(--sidebar-w, 220px)', background: '#111827', flexShrink: 0 }} className="esq-sidebar" />
      <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Bloque ancho={220} alto={28} />
        <Bloque ancho={160} alto={12} />
        <EsqueletoTarjetas cantidad={4} />
        <EsqueletoTabla filas={5} />
      </div>
      <style>{`@media (max-width: 768px) { .esq-sidebar { display: none; } }`}</style>
    </div>
  )
}
