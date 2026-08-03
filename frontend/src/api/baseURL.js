// URL base de la API del backend.
// - En desarrollo local (npm run dev): queda vacío, y el proxy de vite.config.js
//   reenvía /api a http://localhost:8000 (nada cambia respecto a como ya funcionaba).
// - En producción (Vercel): defines la variable de entorno VITE_API_URL con la
//   URL completa de tu backend en Railway, por ejemplo:
//   VITE_API_URL=https://tallerdiesel-backend.up.railway.app/api
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
