// Monitoreo de errores en producción con Sentry.
// Solo se activa si en Vercel defines la variable de entorno VITE_SENTRY_DSN (la da Sentry al crear
// el proyecto). Sin esa variable no hace nada y no se descarga la librería.
export function iniciarMonitoreo() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  import('@sentry/react')
    .then(Sentry => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,         // 10 % de las visitas para medir lentitud
        sendDefaultPii: false,          // no manda datos personales
      })
    })
    .catch(() => { /* si no carga, el sitio sigue funcionando igual */ })
}
