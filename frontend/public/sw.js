// Service worker de TallerDiesel: permite "instalar" el sitio como app y mostrar avisos del sistema.
// - Las páginas se piden siempre a la red (para que nunca se quede una versión vieja); si no hay
//   internet se muestra la última copia guardada.
// - La API (/api) y los archivos del backend NUNCA se guardan en caché.
const CACHE = 'td-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/assets/'))) {
          const copia = res.clone()
          caches.open(CACHE).then(c => c.put(req, copia))
        }
        return res
      })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : undefined)))
  )
})

// Al tocar el aviso del sistema, se abre (o enfoca) la app en la página indicada
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const destino = e.notification.data?.url || '/dashboard'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const abierta = lista.find(c => 'focus' in c)
    if (abierta) { abierta.navigate?.(destino); return abierta.focus() }
    return self.clients.openWindow(destino)
  }))
})
