import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import PasswordInput from '../components/PasswordInput'

const ROLES = ['admin', 'coordinador', 'cliente']

function ModalUsuario({ usuario, onClose, onSaved, viewerEsAdmin }) {
  const isNew = !usuario
  const rolesDisponibles = viewerEsAdmin ? ROLES : ROLES.filter(r => r !== 'admin')
  const [form, setForm] = useState(usuario ? {
    username: usuario.username, email: usuario.email, nombre: usuario.nombre || '',
    apellido_paterno: usuario.apellido_paterno || '', apellido_materno: usuario.apellido_materno || '',
    puesto: usuario.puesto || '', rol: usuario.rol, empresa: usuario.empresa || '',
    is_active: usuario.is_active, password: '', puede_editar_sistema: usuario.puede_editar_sistema || false,
  } : {
    username: '', email: '', nombre: '', apellido_paterno: '', apellido_materno: '',
    puesto: '', rol: 'coordinador', empresa: '', is_active: true, password: '', puede_editar_sistema: false,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (!viewerEsAdmin) delete payload.puede_editar_sistema  // solo Admin otorga este permiso
      if (isNew) await api.post('/usuarios/', payload)
      else await api.patch(`/usuarios/${usuario.id}/`, payload)
      onSaved(); onClose()
    } catch (e) {
      alert('Error: ' + JSON.stringify(e.response?.data))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{isNew ? 'Nuevo usuario' : `Editar usuario`}</h3>
        <p className="modal-subtitle">{isNew ? 'Completa los datos del nuevo usuario' : `Editando: ${usuario.username}`}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div style={{ gridColumn: '1/-1', fontWeight: 600, fontSize: '0.75rem', letterSpacing: 2, color: '#9ca3af' }}>DATOS PERSONALES</div>
          {[['nombre','Nombre *','Juan'],['apellido_paterno','Apellido paterno *','Garcia'],
            ['apellido_materno','Apellido materno','López'],['puesto','Puesto','Ej. Coordinador Norte']
          ].map(([name, label, ph]) => (
            <div key={name} className="form-group">
              <label className="form-label">{label}</label>
              <input className="form-input" value={form[name]} onChange={e => set(name, e.target.value)} placeholder={ph} />
            </div>
          ))}

          <div style={{ gridColumn: '1/-1', fontWeight: 600, fontSize: '0.75rem', letterSpacing: 2, color: '#9ca3af', marginTop: 8 }}>CUENTA</div>
          <div className="form-group">
            <label className="form-label">Usuario *</label>
            <input className="form-input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="juangarcia" />
          </div>
          <div className="form-group">
            <label className="form-label">Correo electrónico *</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@empresa.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Rol *</label>
            <select className="form-select" value={form.rol} onChange={e => set('rol', e.target.value)}>
              {rolesDisponibles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Empresa</label>
            <input className="form-input" value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Nombre de empresa" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">{isNew ? 'Contraseña *' : 'Nueva contraseña (dejar vacío para no cambiar)'}</label>
            <PasswordInput value={form.password}
              onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: 16, height: 16 }} />
            <label htmlFor="is_active" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Usuario activo</label>
            <span className={`badge badge-${form.is_active ? 'activo' : 'inactivo'}`}>{form.is_active ? 'Activo' : 'Inactivo'}</span>
          </div>

          {viewerEsAdmin && form.rol === 'coordinador' && (
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f9fafb', borderRadius: 8, padding: '0.6rem 0.875rem', marginTop: 4 }}>
              <input type="checkbox" id="puede_editar_sistema" checked={form.puede_editar_sistema}
                onChange={e => set('puede_editar_sistema', e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="puede_editar_sistema" style={{ fontSize: '0.85rem' }}>
                Permitir editar información del sistema (empleados, catálogos y datos generales)
              </label>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : isNew ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalDesactivar({ usuario, onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  const handleDesactivar = async () => {
    setLoading(true)
    await api.patch(`/usuarios/${usuario.id}/`, { is_active: !usuario.is_active })
    onSaved(); onClose()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔒</div>
        <h3 className="modal-title">{usuario.is_active ? '¿Desactivar Usuario?' : '¿Activar Usuario?'}</h3>
        <p style={{ color: '#6b7280', margin: '0.5rem 0 1.5rem', fontSize: '0.875rem' }}>
          El usuario <strong>{usuario.username}</strong> {usuario.is_active ? 'no podrá iniciar sesión mientras esté inactivo.' : 'podrá volver a iniciar sesión.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className={`btn ${usuario.is_active ? 'btn-danger' : 'btn-primary'}`} onClick={handleDesactivar} disabled={loading}>
            {loading ? 'Procesando...' : usuario.is_active ? 'Sí, desactivar' : 'Sí, activar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsuariosPage() {
  const { user: viewer } = useAuth()
  const viewerEsAdmin = viewer?.rol === 'admin'
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroRol, setFiltroRol] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  const fetchUsers = () => {
    setLoading(true)
    api.get('/usuarios/').then(({ data }) => setUsuarios(data.results || data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const filtrados = usuarios.filter(u => {
    const matchRol = !filtroRol || u.rol === filtroRol
    const matchBusq = !busqueda ||
      u.username?.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    return matchRol && matchBusq
  })

  const contar = rol => usuarios.filter(u => u.rol === rol).length
  const inactivos = usuarios.filter(u => !u.is_active).length

  const resumen = [
    { label: 'Administradores', count: contar('admin'), bg: '#fef2f2', color: '#991b1b', icon: '🛡️' },
    { label: 'Coordinadores', count: contar('coordinador'), bg: '#eff6ff', color: '#1e40af', icon: '👔' },
    { label: 'Clientes', count: contar('cliente'), bg: '#f0fdf4', color: '#065f46', icon: '🏢' },
    { label: 'Inactivos', count: inactivos, bg: '#f9fafb', color: '#6b7280', icon: '🔒' },
  ]

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <div className="card-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title">Gestión de Usuarios</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{usuarios.length} usuarios</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nuevo usuario</button>
        </div>

        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
          {resumen.map((r, i) => (
            <div key={i} className="stat-card" style={{ background: r.bg }}>
              <span style={{ fontSize: '1.5rem' }}>{r.icon}</span>
              <span className="stat-num" style={{ color: r.color }}>{r.count}</span>
              <span className="stat-label" style={{ color: r.color }}>{r.label}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
            <input className="form-input" placeholder="Buscar por nombre, usuario, correo..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: 1 }} />
            <select className="form-select" value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
              <option value="">Todos los roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          {loading ? <div className="loader"><div className="spinner" /></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Usuario</th><th>Nombre completo</th><th>Correo</th><th>Rol</th><th>Empresa</th><th>Estatus</th><th>Acciones</th></tr></thead>
                <tbody>
                  {filtrados.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No hay usuarios</td></tr>}
                  {filtrados.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>{u.nombre_completo || '—'}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge-${u.rol}`}>{u.rol.charAt(0).toUpperCase() + u.rol.slice(1)}</span>
                        {u.rol === 'coordinador' && u.puede_editar_sistema && (
                          <span title="Puede editar información del sistema" style={{ marginLeft: 6 }}>🔑</span>
                        )}
                      </td>
                      <td>{u.empresa || '—'}</td>
                      <td><span className={`badge badge-${u.is_active ? 'activo' : 'inactivo'}`}>{u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(viewerEsAdmin || u.rol !== 'admin') && (
                            <>
                              <button className="btn btn-sm btn-ghost" onClick={() => { setSelected(u); setModal('editar') }}>✏️</button>
                              <button className="btn btn-sm btn-ghost" style={{ color: u.is_active ? '#dc2626' : '#059669' }}
                                onClick={() => { setSelected(u); setModal('toggle') }}>🔒</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(modal === 'nuevo' || modal === 'editar') && (
          <ModalUsuario usuario={modal === 'editar' ? selected : null} onClose={() => setModal(null)} onSaved={fetchUsers} viewerEsAdmin={viewerEsAdmin} />
        )}
        {modal === 'toggle' && selected && (
          <ModalDesactivar usuario={selected} onClose={() => setModal(null)} onSaved={fetchUsers} />
        )}
      </main>
    </div>
  )
}
