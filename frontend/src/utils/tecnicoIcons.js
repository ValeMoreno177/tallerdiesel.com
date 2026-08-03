// Librería de íconos de técnicos — un ícono y color distinto por categoría,
// para identificar de un vistazo la especialidad de cada marcador en el mapa.
import L from 'leaflet'

export const CATEGORIA_ICONO = {
  motor_diesel:      '🔧',
  electrico:         '⚡',
  frenos_suspension: '🛑',
  transmision:       '⚙️',
  hidraulico:        '💧',
  aire:              '💨',
  mecanica:          '🔩',
  soldadura:         '🔥',
}

export const CATEGORIA_COLOR = {
  motor_diesel:      '#e85d04', // naranja
  electrico:         '#eab308', // amarillo
  frenos_suspension: '#dc2626', // rojo
  transmision:       '#2563eb', // azul
  hidraulico:        '#0891b2', // cian
  aire:              '#7c3aed', // morado
  mecanica:          '#059669', // verde
  soldadura:         '#db2777', // rosa
}

export const CATEGORIA_LEYENDA = [
  { value: 'motor_diesel',      label: 'Motor diesel' },
  { value: 'electrico',         label: 'Eléctrico' },
  { value: 'frenos_suspension', label: 'Frenos y suspensión' },
  { value: 'transmision',       label: 'Transmisión' },
  { value: 'hidraulico',        label: 'Sistema hidráulico' },
  { value: 'aire',              label: 'Sistema de aire' },
  { value: 'mecanica',          label: 'Mecánica general' },
  { value: 'soldadura',         label: 'Soldadura' },
]

const ICONO_DEFAULT = '🔨'
const COLOR_DEFAULT  = '#6b7280'

/**
 * Crea un ícono de Leaflet (círculo de color + emoji) según la categoría del técnico.
 * Si no está disponible, se ve en gris con borde rojo (igual que antes).
 */
export function crearIconoTecnico(categoria, disponible = true) {
  const emoji = CATEGORIA_ICONO[categoria] || ICONO_DEFAULT
  const color = disponible ? (CATEGORIA_COLOR[categoria] || COLOR_DEFAULT) : '#6b7280'
  const borde = disponible ? 'white' : '#dc2626'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;background:${color};
      border:3px solid ${borde};border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:14px;line-height:1;opacity:${disponible ? 1 : 0.75};
    ">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}
