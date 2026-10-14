import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { aplicarTemaGuardado } from './utils/tema'
import { iniciarMonitoreo } from './utils/monitoreo'
import { registrarServiceWorker } from './utils/avisosSistema'

aplicarTemaGuardado()    // modo claro/oscuro antes de pintar, para que no "parpadee"
iniciarMonitoreo()       // Sentry (solo si está configurado VITE_SENTRY_DSN)
registrarServiceWorker() // app instalable (PWA) y avisos del sistema

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
