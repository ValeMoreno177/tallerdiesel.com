import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'
import { CLAVE_ACTIVIDAD } from '../config/tiempos'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tourForzado, setTourForzado] = useState(false)  // "Ver tutorial" desde el menú

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me/')
        .then(({ data }) => setUser(data))
        .catch(() => { localStorage.clear(); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now()))   // arranca el reloj de inactividad
    setUser(data.user)
    return data.user
  }

  const registro = async (formData) => {
    // El registro ahora devuelve mensaje de verificación, no tokens
    const { data } = await api.post('/auth/registro/', formData)
    return data  // { mensaje, email }
  }

  const logout = () => {
    const refresh = localStorage.getItem('refresh_token')
    if (refresh) {
      // Best-effort: invalida el token en el servidor. Si falla (sin internet,
      // token ya vencido, etc.) igual cerramos sesión localmente.
      api.post('/auth/logout/', { refresh }).catch(() => {})
    }
    localStorage.clear()
    setUser(null)
  }

  const iniciarTour = () => setTourForzado(true)

  // Al terminar u omitir el recorrido se guarda en el servidor para no volver a mostrarlo.
  const terminarTour = async () => {
    setTourForzado(false)
    if (user && user.tour_completado === false) {
      setUser(u => ({ ...u, tour_completado: true }))
      try { await api.post('/auth/tour-completado/') } catch { /* si falla, se reintenta en el próximo inicio */ }
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, registro, loading, tourForzado, iniciarTour, terminarTour }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)