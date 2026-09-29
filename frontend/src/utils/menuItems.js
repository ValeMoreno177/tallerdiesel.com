// Opciones del menú lateral según el rol. Se usa en el Sidebar y en el recorrido guiado.
export function getMenuItems(user) {
  if (user?.rol === 'admin')
    return [
      { to: '/admin/dashboard', label: 'Dashboard', icon: '▦' },
      { to: '/admin/bitacora', label: 'Bitácora', icon: '☰' },
      { to: '/admin/usuarios', label: 'Usuarios', icon: '👥' },
      { to: '/mapa-tecnicos', label: 'Mapa de Técnicos', icon: '🗺️' },
      { to: '/admin/configuracion', label: 'Configuración', icon: '⚙' },
    ]

  if (user?.rol === 'coordinador')
    return [
      { to: '/coordinador/dashboard', label: 'Dashboard', icon: '▦' },
      { to: '/coordinador/bitacora', label: 'Bitácora', icon: '☰' },
      ...(user?.puede_editar_sistema
        ? [{ to: '/coordinador/usuarios', label: 'Usuarios', icon: '👥' }]
        : []),
      { to: '/mapa-tecnicos', label: 'Mapa de Técnicos', icon: '🗺️' },
      { to: '/admin/configuracion', label: 'Configuración', icon: '⚙' },
    ]

  return [
    { to: '/cliente/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/solicitar-servicio', label: 'Solicitar a Coordinador', icon: '📍' },
    { to: '/solicitar-tecnico', label: 'Solicitar a Técnico', icon: '🔧' },
    { to: '/cliente/bitacora', label: 'Bitácora', icon: '🧑‍💼' },
  ]
}
