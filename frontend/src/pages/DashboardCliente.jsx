import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import ModalDetalleTicket from '../components/ModalDetalleTicket'
import api from '../api/client'
import CampanaNotificaciones from '../components/CampanaNotificaciones'
import { useAuth } from '../context/AuthContext'
import useAutoRefresh from '../hooks/useAutoRefresh'

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

  const fetchData = () =>
    api.get('/tickets/dashboard_cliente/')
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))

  // Recargar disponibilidad del técnico elegido en tiempo real
  const fetchDisponibilidad = () => {
    if (!tecnicoElegido?.id) return Promise.resolve()
    return api.get(`/tecnicos/${tecnicoElegido.id}/`)
      .then(({ data }) => setDisponibilidadActual(data.disponible))
      .catch(() => {})
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => { fetchDisponibilidad() }, [tecnicoElegido?.id])

  // Actualización automática cada 5 s (servicios, estatus y disponibilidad del técnico)
  useAutoRefresh(fetchData, { soloVisible: true })
  useAutoRefresh(fetchDisponibilidad, { activo: !!tecnicoElegido?.id, soloVisible: true })

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
                  <td className="td-link">{t.etiqueta || t.ticket_id}</td>
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
    <div className="dashboard-layout" style={{ position: 'relative', paddingBottom: '70px' }}>
      <style>{`
        /* ═════════ Camión pequeño que cruza toda la pantalla ═════════ */
        .truck-lane {
          position: fixed; bottom: 0; left: 0; width: 100vw; height: 50px;
          overflow: hidden; pointer-events: none; z-index: 10;
        }
        .truck-mover {
          position: absolute; bottom: 4px; left: 0; width: 160px; height: 85px;
          animation: driveAcross 14s linear infinite;
        }
        @keyframes driveAcross {
          from { transform: translateX(-180px); }
          to   { transform: translateX(100vw); }
        }
        .truck-scaler {
          position: absolute; bottom: 0; left: 0; width: 160px; height: 85px;
          transform: scale(0.42); transform-origin: bottom left;
        }
        .truck-animado {
          position: absolute; bottom: 0; left: 0; width: 160px; height: 85px;
          animation: bounceTruck 0.6s ease-in-out infinite alternate;
        }
        @keyframes bounceTruck {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-3px); }
        }
        .truck-box { position: absolute; left: 0; top: 10px; width: 95px; height: 50px; background: #f05443; border: 2.5px solid #222; border-radius: 4px; }
        .truck-box-stripe { position: absolute; top: 16px; left: 0; width: 95px; height: 14px; background: #6b6b6b; border-top: 2px solid #222; border-bottom: 2px solid #222; }
        .truck-cab { position: absolute; left: 93px; top: 22px; width: 45px; height: 38px; background: #f3d4a0; border: 2.5px solid #222; border-top-left-radius: 14px; border-top-right-radius: 8px; border-bottom-right-radius: 4px; }
        .truck-window { position: absolute; top: 6px; left: 6px; width: 22px; height: 16px; background: #fff; border: 2px solid #222; border-top-left-radius: 10px; }
        .truck-base { position: absolute; bottom: 12px; left: 15px; width: 115px; height: 10px; background: #f05443; border: 2px solid #222; border-radius: 2px; }
        .wheel-custom { width: 24px; height: 24px; background: #222; border: 3px solid #fff; border-radius: 50%; position: absolute; bottom: 0; box-shadow: 0 0 0 2px #222; animation: spin 0.8s linear infinite; }
        .wheel-custom.left { left: 30px; }
        .wheel-custom.right { left: 102px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .truck-mover, .truck-animado, .wheel-custom { animation: none; }
          .truck-mover { transform: translateX(40px); }
        }
      `}</style>

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
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>
                  ¿Quieres otro técnico para este mismo servicio? Ábrelo abajo en "Servicios" y usa el botón "Cambiar técnico" dentro del ticket.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a href={`https://wa.me/${tecnicoElegido.telefono?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                  <button className="btn btn-sm" style={{ background: '#059669', color: 'white' }}>💬 WhatsApp</button>
                </a>
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

      {/* ── Camión pequeño de reparto ── */}
      <div className="truck-lane" aria-hidden="true">
        <div className="truck-mover">
          <div className="truck-scaler">
            <div className="truck-animado">
              <div className="truck-box"><div className="truck-box-stripe"></div></div>
              <div className="truck-cab"><div className="truck-window"></div></div>
              <div className="truck-base"></div>
              <div className="wheel-custom left"></div>
              <div className="wheel-custom right"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
