import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import CampanaNotificaciones from '../components/CampanaNotificaciones'
import ModalDetalleTicket from '../components/ModalDetalleTicket'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function DashboardCoordinador() {
  const { user } = useAuth()
  const [data,        setData]        = useState(null)
  const [solicitudes, setSolicitudes] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tabActivo,   setTabActivo]   = useState('tickets')
  const [ticketSel,         setTicketSel]         = useState(null)
  const [ticketNotificacion, setTicketNotificacion] = useState(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      api.get('/tickets/dashboard_coordinador/'),
      api.get('/solicitudes-pendientes/'),
    ]).then(([r1, r2]) => {
      setData(r1.data)
      setSolicitudes(r2.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  // Marcar como "rellena" — redirige al ticket creado
  const marcarRellenada = async (s) => {
    await api.patch(`/solicitudes-pendientes/${s.id}/atender/`)
    setSolicitudes(prev => prev.filter(x => x.id !== s.id))
    // Si tiene ticket, abrir el detalle
    if (s.ticket_id_obj) {
      const r = await api.get(`/tickets/${s.ticket_id_obj}/`)
      setTicketSel(r.data)
    }
    fetchData()
  }

  const stats = [
    { num: data?.en_proceso ?? 0, label: 'Reparando',    bg: '#eff6ff', color: '#1e40af', icon: '⚙️' },
    { num: data?.pendientes ?? 0, label: 'Pendientes',    bg: '#fef3c7', color: '#92400e', icon: '🕒' },
    { num: data?.terminados ?? 0, label: 'Terminados',    bg: '#f0fdf4', color: '#065f46', icon: '✅' },
    { num: `$${(data?.ganancias_hoy ?? 0).toFixed(2)}`, label: 'Ganancias hoy', bg: '#fffbeb', color: '#92400e', icon: '💰' },
  ]

  const formatFecha = f => new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const tabs = [
    ['tickets',     '📋 Mis Tickets'],
    ['solicitudes', `🔔 Solicitudes${solicitudes.length > 0 ? ` (${solicitudes.length})` : ''}`],
  ]

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Dashboard Coordinador</h1>
            <p className="page-subtitle">Bienvenido, {user?.nombre_completo || user?.username}</p>
          </div>
          <CampanaNotificaciones onAbrirTicket={(t) => setTicketNotificacion(t)} />
        </div>

        <div className="grid-stats">
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{ background: s.bg }}>
              <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
              <span className="stat-num" style={{ color: s.color }}>{s.num}</span>
              <span className="stat-label" style={{ color: s.color }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'white', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid #e5e7eb' }}>
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTabActivo(key)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: tabActivo === key ? 600 : 400,
                background: tabActivo === key ? '#111' : 'transparent',
                color: tabActivo === key ? 'white' : '#6b7280', fontSize: '0.875rem' }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? <div className="loader"><div className="spinner" /></div> : (
          <>
            {tabActivo === 'tickets' && (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
                  <h2 className="card-title">Tickets asignados</h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Ticket</th><th>Empresa</th><th>Fecha</th><th>Estatus</th><th>Unidad</th><th>Lugar</th><th>Tipo</th><th>Técnico / Coord.</th><th>Total</th><th>IVA</th><th>Factura</th><th>Ver</th></tr></thead>
                    <tbody>
                      {!data?.tickets?.length && <tr><td colSpan={11} style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>Sin tickets asignados</td></tr>}
                      {data?.tickets?.map(t => (
                        <tr key={t.id}>
                          <td className="td-link">{t.ticket_id}</td>
                          <td>{t.empresa}</td>
                          <td>{t.fecha}</td>
                          <td><span className={`badge badge-${t.estatus}`}>{t.estatus_display || t.estatus}</span></td>
                          <td>{t.unidad}</td>
                          <td>{t.lugar}</td>
                          <td><span style={{fontSize:'0.7rem',background:t.tipo_solicitud==='tecnico'?'#eff6ff':'#f0fdf4',color:t.tipo_solicitud==='tecnico'?'#1e40af':'#065f46',padding:'1px 6px',borderRadius:10,fontWeight:600}}>{t.tipo_solicitud==='tecnico'?'👷':'🧑‍💼'}</span></td>
                          <td>{t.tipo_solicitud==='tecnico' ? (t.tecnico_nombre||'—') : (t.coordinador_nombre||'—')}</td>
                          <td style={{ fontWeight: 600 }}>${parseFloat(t.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td className="td-naranja">${parseFloat(t.iva || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td>{t.factura || '—'}</td>
                          <td><button className="btn btn-sm btn-ghost" onClick={() => setTicketSel(t)}>👁 Ver</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tabActivo === 'solicitudes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {solicitudes.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
                    <p>No hay solicitudes pendientes</p>
                  </div>
                )}
                {solicitudes.map(s => (
                  <div key={s.id} className="card"
                    style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', border: '1px solid #e5e7eb' }}>
                    <div style={{ width: 44, height: 44, background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🔧</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{s.nombre_completo}</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{formatFecha(s.fecha)}</span>
                      </div>
                      {s.empresa && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 3 }}>🏢 {s.empresa}</div>}
                      {s.lugar && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 3 }}>📍 {s.lugar}</div>}
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 6 }}>📞 {s.telefono}</div>
                      <div style={{ fontSize: '0.875rem', color: '#374151', background: '#f9fafb', borderRadius: 6, padding: '6px 10px' }}>
                        {s.problema}
                      </div>
                      {s.ticket_codigo && (
                        <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: 6, fontWeight: 600 }}>
                          ✅ Ticket generado: {s.ticket_codigo}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {s.ticket_codigo && (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => marcarRellenada(s)}
                          style={{ whiteSpace: 'nowrap', background: '#2563eb' }}>
                          📋 Ver / Rellenar ticket
                        </button>
                      )}
                      <a href={`https://wa.me/${s.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                        <button className="btn btn-sm" style={{ background: '#059669', color: 'white', width: '100%' }}>💬 WhatsApp</button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {ticketSel && (
        <ModalDetalleTicket
          ticket={ticketSel}
          soloLectura={ticketSel.estatus === 'terminado' && !ticketSel.puede_editar_coordinador}
          onClose={() => setTicketSel(null)}
          onUpdated={fetchData}
        />
      )}
      {ticketNotificacion && (
        <ModalDetalleTicket
          ticket={ticketNotificacion}
          soloLectura={ticketNotificacion.estatus === 'terminado' && !ticketNotificacion.puede_editar_coordinador}
          onClose={() => setTicketNotificacion(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  )
}
