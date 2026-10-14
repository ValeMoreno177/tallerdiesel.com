// Avisos del sistema operativo (los que salen en la barra del celular o en la esquina de la computadora)
// cuando llega una notificación y la pestaña de TallerDiesel no está a la vista.
// Nota: funcionan mientras el sitio esté abierto (aunque sea en segundo plano o instalado como app).
// Para recibirlos con el sitio totalmente cerrado se necesita "Web Push" con llaves VAPID en el servidor.

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin PWA, el sitio funciona igual */ })
  })
}

export function avisosDisponibles() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permisoAvisos() {
  return avisosDisponibles() ? Notification.permission : 'denied'
}

export async function pedirPermisoAvisos() {
  if (!avisosDisponibles()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try { return await Notification.requestPermission() } catch { return 'denied' }
}

export async function mostrarAvisoSistema(titulo, cuerpo, url = '/dashboard') {
  if (!avisosDisponibles() || Notification.permission !== 'granted' || !document.hidden) return
  const opciones = { body: cuerpo, icon: '/android-chrome-192x192.png', badge: '/favicon-32x32.png', data: { url }, tag: 'td-aviso' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) await reg.showNotification(titulo, opciones)
    else new Notification(titulo, opciones)
  } catch { /* algunos navegadores no lo permiten */ }
}
