import axios from 'axios'
import { API_BASE_URL } from './baseURL'

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshingToken = false
let refreshQueue = []

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  refreshQueue = []
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config

    // Si no es 401, o ya se reintentó, o es la propia petición de refresh → rechazar sin redirigir
    if (
      err.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh/') ||
      original.url?.includes('/auth/login/')
    ) {
      return Promise.reject(err)
    }

    original._retry = true

    if (refreshingToken) {
      // Encolar mientras se refresca
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }).catch(e => Promise.reject(e))
    }

    refreshingToken = true
    const refresh = localStorage.getItem('refresh_token')

    if (!refresh) {
      refreshingToken = false
      // No hay refresh token — solo limpiar si era una petición de datos del usuario
      if (original.url?.includes('/auth/me/')) {
        localStorage.clear()
      }
      return Promise.reject(err)
    }

    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh })
      localStorage.setItem('access_token', data.access)
      original.headers.Authorization = `Bearer ${data.access}`
      processQueue(null, data.access)
      return api(original)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      // Solo limpiar y redirigir si era /auth/me/ (carga inicial de sesión)
      // Para otras peticiones, NO cerrar la sesión automáticamente
      if (original.url?.includes('/auth/me/')) {
        localStorage.clear()
        window.location.href = '/login'
      }
      return Promise.reject(refreshErr)
    } finally {
      refreshingToken = false
    }
  }
)

export default api