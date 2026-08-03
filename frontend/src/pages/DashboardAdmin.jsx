import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import CampanaNotificaciones from '../components/CampanaNotificaciones'
import ModalDetalleTicket from '../components/ModalDetalleTicket'
import api from '../api/client'

export default function DashboardAdmin() {
  const [tab,         setTab]         = useState('general')
  const [data,        setData]        = useState(null)
  const [corte,       setCorte]       = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [ticketSel,   setTicketSel]   = useState(null)
  const [ticketNotificacion, setTicketNotificacion] = useState(null)

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      api.get('/tickets/dashboard_admin/'),
      api.get('/tickets/corte_mensual/'),
      api.get('/solicitudes-pendientes/'),
    ]).then(([r1, r2, r3]) => {
      setData(r1.data); setCorte(r2.data); setSolicitudes(r3.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const abrirTicket = async (ticketId) => {
    if (!ticketId) return
    try {
      const { data } = await api.get(`/tickets/${ticketId}/`)
      setTicketSel(data)
    } catch { }
  }

  const fmt = n => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  const formatFecha = f => new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const statsGeneral = [
    { num: fmt(data?.ingresos_totales), label: 'Ingresos totales',  bg: '#eff6ff', color: '#1e40af', icon: '💰' },
    { num: fmt(data?.ganancia_total),   label: 'Ganancia total',    bg: '#f0fdf4', color: '#065f46', icon: '📈' },
    { num: fmt(data?.iva_acumulado),    label: 'IVA acumulado',     bg: '#fffbeb', color: '#92400e', icon: '🧾' },
    { num: fmt(data?.comisiones),       label: 'Comisiones',        bg: '#faf5ff', color: '#5b21b6', icon: '💼' },
    { num: fmt(data?.costo_total),      label: 'Costo total',       bg: '#fff1f2', color: '#be123c', icon: '🔩' },
    { num: data?.servicios_terminados ?? 0, label: 'Terminados',    bg: '#f0fdf4', color: '#065f46', icon: '✅' },
    { num: data?.en_proceso           ?? 0, label: 'Reparando',    bg: '#eff6ff', color: '#1e40af', icon: '⚙️' },
    { num: data?.pendientes           ?? 0, label: 'Pendientes',    bg: '#fef3c7', color: '#92400e', icon: '🕒' },
    { num: data?.facturas_pagadas     ?? 0, label: 'Fact. pagadas', bg: '#f0fdf4', color: '#065f46', icon: '💳' },
  ]

  const tabs = [
    ['general',     '📊 Resumen general'],
    ['mes',         '📅 Corte mensual'],
    ['solicitudes', `🔔 Solicitudes${solicitudes.length > 0 ? ` (${solicitudes.length})` : ''}`],
  ]

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Dashboard Administrador</h1>
            <p className="page-subtitle">Visión ejecutiva del negocio</p>
          </div>
          <CampanaNotificaciones onAbrirTicket={(t) => setTicketNotificacion(t)} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: 'white', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid #e5e7eb' }}>
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: tab === key ? 600 : 400,
                background: tab === key ? '#111' : 'transparent',
                color: tab === key ? 'white' : '#6b7280', fontSize: '0.875rem' }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? <div className="loader"><div className="spinner" /></div> : (
          <>
            {tab === 'general' && (
              <>
                <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {statsGeneral.map((s, i) => (
                    <div key={i} className="stat-card" style={{ background: s.bg }}>
                      <span style={{ fontSize: '1.3rem' }}>{s.icon}</span>
                      <span className="stat-num" style={{ color: s.color, fontSize: '1.4rem' }}>{s.num}</span>
                      <span className="stat-label" style={{ color: s.color }}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="grid-2" style={{ marginTop: '1.5rem' }}>
                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Top empresas</h3>
                    {data?.top_empresas?.map((e, i) => (
                      <div key={i} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.875rem' }}>
                          <span>{e.empresa}</span><span style={{ fontWeight: 600 }}>{fmt(e.total)}</span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6 }}>
                          <div style={{ height: '100%', background: 'var(--azul)', borderRadius: 4, width: `${Math.min(100, (e.total / (data?.ingresos_totales || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Resumen financiero</h3>
                    {[['Costo Total', data?.costo_total],['Ganancia Total', data?.ganancia_total, '#059669'],
                      ['Total Ingresos', data?.ingresos_totales, '#1e40af'],['IVA acumulado', data?.iva_acumulado, '#d97706'],
                      ['Comisiones', data?.comisiones, '#d97706']].map(([label, val, color]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span style={{ fontWeight: 600, color: color || '#111' }}>{fmt(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'mes' && (
              <>
                <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {corte[0] && [
                    ['💰', fmt(corte[0].total),    'Total facturado', '#eff6ff', '#1e40af'],
                    ['📈', fmt(corte[0].ganancia), 'Ganancia',        '#f0fdf4', '#065f46'],
                    ['🧾', fmt(corte[0].iva),      'IVA del mes',     '#fffbeb', '#92400e'],
                    ['💼', fmt(corte[0].comision), 'Comisiones',      '#faf5ff', '#5b21b6'],
                  ].map(([icon, num, label, bg, color], i) => (
                    <div key={i} className="stat-card" style={{ background: bg }}>
                      <span style={{ fontSize: '1.3rem' }}>{icon}</span>
                      <span className="stat-num" style={{ color, fontSize: '1.4rem' }}>{num}</span>
                      <span className="stat-label" style={{ color }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="card" style={{ marginTop: '1.5rem' }}>
                  <h3 className="card-title" style={{ marginBottom: '1rem' }}>Historial de cortes</h3>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>MES</th><th>TICKETS</th><th>TOTAL</th><th>GANANCIA</th><th>IVA</th><th>COMISIONES</th></tr></thead>
                      <tbody>
                        {corte.map(c => (
                          <tr key={c.mes}>
                            <td style={{ fontWeight: 500 }}>{c.mes}</td>
                            <td>{c.tickets}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(c.total)}</td>
                            <td className="td-naranja">{fmt(c.ganancia)}</td>
                            <td className="td-naranja">{fmt(c.iva)}</td>
                            <td className="td-naranja">{fmt(c.comision)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {tab === 'solicitudes' && (
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
                        <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: 6, fontWeight: 600 }}>
                          ✅ Ticket generado: {s.ticket_codigo}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {s.ticket_id_obj && (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => abrirTicket(s.ticket_id_obj)}
                          style={{ whiteSpace: 'nowrap' }}>
                          📋 Ver ticket
                        </button>
                      )}
                      <a href={`https://wa.me/${s.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
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
          onClose={() => setTicketSel(null)}
          onUpdated={fetchAll}
        />
      )}
      {ticketNotificacion && (
        <ModalDetalleTicket
          ticket={ticketNotificacion}
          onClose={() => setTicketNotificacion(null)}
          onUpdated={fetchAll}
        />
      )}
    </div>
  )
}
