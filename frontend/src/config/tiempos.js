// Tiempos del sistema (en milisegundos). Cámbialos aquí y se aplican en toda la app.

// Refresco máximo de datos visibles en dashboards, bitácoras y detalle del ticket.
export const REFRESCO_MS = 5 * 1000

// Campana de notificaciones/alertas. Antes era cada 1 s: con varios usuarios conectados eso
// saturaba el servidor. 3 s sigue sintiéndose inmediato.
export const NOTIFICACIONES_MS = 3000

// Con la pestaña en segundo plano las alertas se siguen revisando (para que suenen), pero más espaciado.
export const NOTIFICACIONES_OCULTO_MS = 15 * 1000

// Mensajes del chat abierto (solo mientras la ventana está visible).
export const CHAT_MS = 2000

// Tiempo sin actividad (mouse, teclado, toque, scroll) tras el cual se cierra la sesión.
export const INACTIVIDAD_MS = 5 * 60 * 1000

// Aviso con cuenta regresiva antes de cerrar la sesión por inactividad.
// Va DENTRO de los 5 minutos: a los 4:30 aparece el aviso y a los 5:00 se cierra.
// Pon 0 para cerrar sin avisar.
export const AVISO_INACTIVIDAD_MS = 30 * 1000

// Claves de almacenamiento del cierre por inactividad
export const CLAVE_ACTIVIDAD = 'td_ultima_actividad'          // localStorage: última actividad (se comparte entre pestañas)
export const CLAVE_SESION_EXPIRADA = 'td_sesion_expirada'      // sessionStorage: mostrar aviso en el login
