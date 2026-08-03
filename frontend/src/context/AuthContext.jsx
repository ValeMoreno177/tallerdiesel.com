import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <AuthContext.Provider value={{ user, login, logout, registro, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
