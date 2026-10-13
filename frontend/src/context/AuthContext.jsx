import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import useAutoRefresh from '../hooks/useAutoRefresh'
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

  // Cada 30 s se revisa el perfil: si el Administrador cambia el rol o los permisos de esta persona,
  // el menú y las pantallas se ajustan solos (sin tener que cerrar sesión).
  const refrescarPerfil = useCallback(async () => {
    const { data } = await api.get('/auth/me/')
    setUser(prev => {
      if (!prev || prev.id !== data.id) return prev
      const siguiente = { ...prev, ...data }
      return JSON.stringify(siguiente) === JSON.stringify(prev) ? prev : siguiente
    })
  }, [])
  useAutoRefresh(refrescarPerfil, { activo: !!user, soloVisible: true })

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

  // Actualiza los datos del usuario en pantalla (p. ej. al cambiar su foto) sin volver a iniciar sesión
  const actualizarUsuario = (datos) => setUser(u => ({ ...u, ...datos }))

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
    <AuthContext.Provider value={{ user, login, logout, registro, loading, tourForzado, iniciarTour, terminarTour, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
