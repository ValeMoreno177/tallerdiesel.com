// Camioncito con los colores del logo que recorre una pequeña carretera debajo del título de la
// página (ya no cruza toda la pantalla por abajo). Es decorativo: no recibe clics ni lo leen
// los lectores de pantalla, y se queda quieto si el usuario pidió reducir animaciones.
export default function CamionTitulo({ ancho = 340, oscuro = false }) {
  return (
    <div className={`camion-titulo ${oscuro ? 'oscuro' : ''}`} style={{ width: ancho, maxWidth: '100%', '--camion-ancho': `${ancho}px` }} aria-hidden="true">
      <style>{ESTILOS}</style>
      <div className="camion-titulo-carril">
        <div className="camion-titulo-mover">
          <span className="camion-titulo-humo h1" />
          <span className="camion-titulo-humo h2" />
          <span className="camion-titulo-humo h3" />
          <svg className="camion-titulo-svg" viewBox="0 0 120 52" width="62" height="27">
            {/* Caja */}
            <rect x="2" y="6" width="66" height="32" rx="4" fill="#111827" />
            <rect x="2" y="17" width="66" height="7" fill="#e85d04" />
            <text x="35" y="14.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff"
              fontFamily="Barlow, sans-serif" letterSpacing="0.6">TALLER</text>
            <text x="35" y="34" textAnchor="middle" fontSize="7" fontWeight="800" fill="#e85d04"
              fontFamily="Barlow, sans-serif" letterSpacing="0.6">DIESEL</text>
            {/* Cabina */}
            <path d="M70 14 h22 l12 12 v12 h-34 z" fill="#e85d04" />
            <path d="M75 18 h15 l8 8 h-23 z" fill="#dbeafe" />
            <rect x="100" y="30" width="6" height="4" rx="1" fill="#fde68a" />
            {/* Chasis */}
            <rect x="0" y="37" width="108" height="5" rx="2" fill="#374151" />
            {/* Llantas */}
            <g className="camion-titulo-llanta" style={{ transformOrigin: '20px 44px' }}>
              <circle cx="20" cy="44" r="7" fill="#111827" />
              <circle cx="20" cy="44" r="3" fill="#9ca3af" />
              <rect x="19" y="37.5" width="2" height="4" fill="#9ca3af" />
            </g>
            <g className="camion-titulo-llanta" style={{ transformOrigin: '50px 44px' }}>
              <circle cx="50" cy="44" r="7" fill="#111827" />
              <circle cx="50" cy="44" r="3" fill="#9ca3af" />
              <rect x="49" y="37.5" width="2" height="4" fill="#9ca3af" />
            </g>
            <g className="camion-titulo-llanta" style={{ transformOrigin: '90px 44px' }}>
              <circle cx="90" cy="44" r="7" fill="#111827" />
              <circle cx="90" cy="44" r="3" fill="#9ca3af" />
              <rect x="89" y="37.5" width="2" height="4" fill="#9ca3af" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}

const ESTILOS = `
  .camion-titulo { margin-top: 6px; }
  .camion-titulo-carril {
    position: relative; height: 40px; overflow: hidden;
  }
  /* Carretera: asfalto con línea central naranja que se mueve */
  .camion-titulo-carril::before {
    content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 9px;
    background: #1f2937; border-radius: 999px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
  }
  .camion-titulo-carril::after {
    content: ''; position: absolute; left: 6px; right: 6px; bottom: 3.5px; height: 2px;
    background: repeating-linear-gradient(90deg, #f97316 0 12px, transparent 12px 22px);
    animation: camionTituloLineas 0.7s linear infinite;
  }
  .camion-titulo.oscuro .camion-titulo-carril::before { background: rgba(255,255,255,0.18); }
  .camion-titulo-mover {
    position: absolute; bottom: 7px; left: 0; z-index: 1; display: flex; align-items: flex-end;
    animation: camionTituloAvanza 9s ease-in-out infinite;
  }
  .camion-titulo-svg { display: block; animation: camionTituloBrinca 0.5s ease-in-out infinite alternate; }
  .camion-titulo-llanta { animation: camionTituloGira 0.6s linear infinite; }
  .camion-titulo-humo {
    width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; opacity: 0;
    margin-right: -3px; margin-bottom: 10px; animation: camionTituloHumo 1.2s ease-out infinite;
  }
  .camion-titulo-humo.h2 { animation-delay: 0.4s; width: 5px; height: 5px; }
  .camion-titulo-humo.h3 { animation-delay: 0.8s; width: 4px; height: 4px; }
  @keyframes camionTituloAvanza {
    0%   { transform: translateX(-90px); }
    100% { transform: translateX(calc(var(--camion-ancho, 340px) + 20px)); }
  }
  @keyframes camionTituloBrinca { from { transform: translateY(0); } to { transform: translateY(-1.5px); } }
  @keyframes camionTituloGira { to { transform: rotate(360deg); } }
  @keyframes camionTituloLineas { to { background-position: -22px 0; } }
  @keyframes camionTituloHumo {
    0%   { opacity: 0.6; transform: translate(0, 0) scale(0.6); }
    100% { opacity: 0;   transform: translate(-14px, -8px) scale(1.6); }
  }
  @media (prefers-reduced-motion: reduce) {
    .camion-titulo-mover, .camion-titulo-svg, .camion-titulo-llanta,
    .camion-titulo-humo, .camion-titulo-carril::after { animation: none; }
    .camion-titulo-mover { transform: translateX(12px); }
  }
`
