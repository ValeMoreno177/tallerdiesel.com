import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import ModalDetalleTicket from '../components/ModalDetalleTicket'
import api from '../api/client'
import CampanaNotificaciones from '../components/CampanaNotificaciones'
import { useAuth } from '../context/AuthContext'

const PASOS = ['pendiente','atendido','proceso','terminado']
const LABELS = { pendiente:'Pendiente', atendido:'En camino', proceso:'Reparando', terminado:'Finalizado' }

function MiniBarra({ estatus }) {
  const idx = PASOS.indexOf(estatus)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 6 }}>
      {PASOS.map((p, i) => (
        <div key={p} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? '#1a56db' : '#e5e7eb' }} title={LABELS[p]} />
      ))}
    </div>
  )
}

export default function DashboardCliente() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data,               setData]               = useState(null)
  const [loading,            setLoading]            = useState(true)
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null)
  const [ticketNotificacion, setTicketNotificacion] = useState(null)
  const [tecnicoElegido,     setTecnicoElegido]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('td_tecnico_elegido') || 'null') } catch { return null }
  })
  const [disponibilidadActual, setDisponibilidadActual] = useState(null)

  const fetchData = () => {
    api.get('/tickets/dashboard_cliente/')
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))
  }

  // Recargar disponibilidad del técnico elegido en tiempo real
  const fetchDisponibilidad = () => {
    if (!tecnicoElegido?.id) return
    api.get(`/tecnicos/${tecnicoElegido.id}/`)
      .then(({ data }) => setDisponibilidadActual(data.disponible))
      .catch(() => {})
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchDisponibilidad()
    const interval = setInterval(fetchDisponibilidad, 30000)
    return () => clearInterval(interval)
  }, [tecnicoElegido?.id])

  const todosLosServicios = data?.recientes || []

  const stats = [
    { num: data?.en_curso         ?? 0, label: 'En curso',        bg: '#eff6ff', color: '#1e40af', icon: '🔧' },
    { num: data?.terminados       ?? 0, label: 'Terminados',       bg: '#f0fdf4', color: '#065f46', icon: '✅' },
    { num: data?.pagos_pendientes ?? 0, label: 'Pagos pendientes', bg: '#fffbeb', color: '#92400e', icon: '💳' },
    { num: data?.total            ?? 0, label: 'Total servicios',  bg: '#faf5ff', color: '#5b21b6', icon: '📋' },
  ]

  const TablaTickets = ({ tickets }) => (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">📋 Servicios</h2>
        <button className="btn btn-sm btn-ghost"
          onClick={() => navigate('/cliente/bitacora')}>
          ☰ Ver bitácora completa
        </button>
      </div>
      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th><th>Unidad</th><th>Lugar</th><th>Fecha</th><th>Estatus</th>
                <th>Atendido por</th>
                <th>Total</th><th>Ver</th>
              </tr>
            </thead>
            <tbody>
              {!tickets.length && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>
                  No hay servicios aún
                </td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id}>
                  <td className="td-link">{t.ticket_id}</td>
                  <td>{t.unidad}</td>
                  <td>{t.lugar || '—'}</td>
                  <td>{t.fecha}</td>
                  <td>
                    <div>
                      <span className={`badge badge-${t.estatus}`}>{t.estatus_display || t.estatus}</span>
                      {(t.tipo_solicitud !== 'tecnico' || t.coordinador_nombre) && (
                        <MiniBarra estatus={t.estatus} />
                      )}
                    </div>
                  </td>
                  <td>
                    {t.tipo_solicitud === 'tecnico'
                      ? (t.tecnico_nombre || <span style={{ color: '#9ca3af' }}>Técnico sin asignar</span>)
                      : (t.coordinador_nombre || <span style={{ color: '#9ca3af' }}>Coordinador sin asignar</span>)
                    }
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    ${parseFloat(t.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => setTicketSeleccionado(t)}>👁 Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Hola, {user?.nombre || user?.username} 👋</h1>
            <p className="page-subtitle">{user?.empresa} — {user?.puesto || 'Cliente'}</p>
          </div>
          <CampanaNotificaciones onAbrirTicket={(t) => setTicketNotificacion(t)} />
        </div>

        <div className="grid-stats" style={{ marginBottom: '1.5rem' }}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{ background: s.bg }}>
              <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
              <span className="stat-num" style={{ color: s.color }}>{s.num}</span>
              <span className="stat-label" style={{ color: s.color }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Técnico elegido desde el mapa */}
        {tecnicoElegido && (
          <div className="card" style={{ marginBottom: '1.25rem', border: `1px solid ${disponibilidadActual === false ? '#fecaca' : '#bbf7d0'}`, background: disponibilidadActual === false ? '#fef2f2' : '#f0fdf4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  👷 Técnico seleccionado: {tecnicoElegido.nombre}
                  <span style={{
                    marginLeft: 10, fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: disponibilidadActual === false ? '#fee2e2' : '#d1fae5',
                    color: disponibilidadActual === false ? '#991b1b' : '#065f46'
                  }}>
                    {disponibilidadActual === false ? '🔴 Ocupado' : '🟢 Disponible'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                  {tecnicoElegido.categoria_display} — {tecnicoElegido.ciudad}, {tecnicoElegido.estado}
                </div>
                {disponibilidadActual === false && (
                  <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: 4 }}>
                    ⚠️ Este técnico está ocupado actualmente. Puedes contactarlo o elegir otro.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a href={`https://wa.me/${tecnicoElegido.telefono?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                  <button className="btn btn-sm" style={{ background: '#059669', color: 'white' }}>💬 WhatsApp</button>
                </a>
                <button className="btn btn-sm btn-ghost" onClick={() => navigate('/solicitar-tecnico')}>
                  🔄 Cambiar técnico
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => {
                  localStorage.removeItem('td_tecnico_elegido')
                  setTecnicoElegido(null)
                }}>✕</button>
              </div>
            </div>
          </div>
        )}

        {/* Tabla única de Servicios */}
        <TablaTickets tickets={todosLosServicios} />

      </main>

      {ticketSeleccionado && (
        <ModalDetalleTicket
          ticket={ticketSeleccionado}
          onClose={() => setTicketSeleccionado(null)}
          onUpdated={fetchData}
        />
      )}
      {ticketNotificacion && (
        <ModalDetalleTicket
          ticket={ticketNotificacion}
          onClose={() => setTicketNotificacion(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  )
}
