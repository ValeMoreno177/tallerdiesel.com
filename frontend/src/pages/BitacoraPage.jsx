import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import CampanaNotificaciones from '../components/CampanaNotificaciones'
import ModalDetalleTicket from '../components/ModalDetalleTicket'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

// ─────────────────────────────────────────────
const fmt = n => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

const FORM_VACIO = {
  empresa: '', fecha: new Date().toISOString().slice(0, 10),
  estatus: 'pendiente', tipo_unidad: '', unidad: '', lugar: '', operador: '', reparacion: '',
  sal_costo: '0', mo_costo: '0', ref_costo: '0',
  sal_ganancia: '0', mo_ganancia: '0', ref_ganancia: '0',
  factura: '', fecha_factura: '', estatus_factura: 'pendiente',
  coordinador: '', proveedor: '', tecnico: '',
}

function calcular(f) {
  const salC  = parseFloat(f.sal_costo    || 0)
  const moC   = parseFloat(f.mo_costo     || 0)
  const refC  = parseFloat(f.ref_costo    || 0)
  const salG  = parseFloat(f.sal_ganancia || 0)
  const moG   = parseFloat(f.mo_ganancia  || 0)
  const refG  = parseFloat(f.ref_ganancia || 0)
  const costo    = salC + moC + refC
  const ganancia = salG + moG + refG
  const total    = costo + ganancia
  const iva      = total * 0.16
  const neto     = total + iva
  const isr      = total * 0.0125
  const total_f  = neto - isr
  const comision = ganancia * 0.15
  return { costo, ganancia, total, iva, neto, isr, total_f, comision }
}

// ─────────────────────────────────────────────
// Modal CRUD
// ─────────────────────────────────────────────
function ModalTicket({ ticket, coordinadoresList, proveedoresList, empresasList, tecnicosList, onClose, onSaved, onNuevoProveedor, rol }) {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'
  const esCoord = user?.rol === 'coordinador'
  const esNuevo = !ticket

  const nombreCoord = user
    ? `${user.nombre || ''} ${user.apellido_paterno || ''}`.trim() || user.username
    : ''

  const [form, setForm] = useState(() => {
    if (!esNuevo) {
      // Normalizar null/undefined a '' para evitar selects no controlados
      const t = { ...FORM_VACIO, ...ticket }
      const nullToStr = ['coordinador','proveedor','tecnico','factura','fecha_factura','estatus_factura','reparacion','lugar','operador','unidad','tipo_unidad','empresa']
      nullToStr.forEach(k => { if (t[k] == null) t[k] = '' })
      const nullToNum = ['sal_costo','mo_costo','ref_costo','sal_ganancia','mo_ganancia','ref_ganancia']
      nullToNum.forEach(k => { if (t[k] == null) t[k] = '0' })
      // Si el ticket todavía no tiene coordinador y quien edita es Coordinador, se
      // toma por default a sí mismo — así lo que se ve en pantalla (su nombre)
      // coincide con lo que en verdad se va a guardar al presionar Guardar.
      if (!t.coordinador && esCoord) t.coordinador = String(user.id)
      return t
    }
    return { ...FORM_VACIO, coordinador: esCoord ? String(user.id) : '' }
  })

  const [nuevaEmpresa,    setNuevaEmpresa]    = useState('')
  const [nuevoProveedor,  setNuevoProveedor]  = useState('')
  const [addingEmpresa,   setAddingEmpresa]   = useState(false)
  const [addingProveedor, setAddingProveedor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const esTerminado = !esNuevo && ticket?.estatus === 'terminado' && !ticket?.puede_editar_coordinador

  const calc = calcular(form)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const confirmarEmpresa = () => {
    if (nuevaEmpresa.trim()) { set('empresa', nuevaEmpresa.trim()); setAddingEmpresa(false) }
  }

  const confirmarProveedor = async () => {
    if (!nuevoProveedor.trim()) return
    try {
      const { data } = await api.post('/proveedores/crear/', { nombre: nuevoProveedor.trim() })
      onNuevoProveedor(data)
      set('proveedor', String(data.id))
      setNuevoProveedor(''); setAddingProveedor(false)
    } catch { setError('No se pudo crear el proveedor.') }
  }

  const handleSave = async () => {
    if (!form.empresa || !form.fecha) { setError('Empresa y fecha son obligatorios.'); return }
    setSaving(true); setError('')
    // Convertir strings vacíos a null para campos de fecha y FK
    const payload = {
      ...form,
      coordinador:   form.coordinador   || null,
      proveedor:     form.proveedor     || null,
      tecnico:       form.tecnico       || null,
      fecha_factura: form.fecha_factura || null,
      factura:       form.factura       || '',
    }
    // Si el servicio era "directo con técnico" y el Coordinador lo toma (queda con
    // coordinador asignado y sin técnico), pasa automáticamente a tipo "coordinador"
    // — así el cliente ya ve la línea de tiempo, sin que el Admin tenga que hacer nada.
    if (!esNuevo && ticket?.tipo_solicitud === 'tecnico' && payload.coordinador && !payload.tecnico) {
      payload.tipo_solicitud = 'coordinador'
    }
    try {
      if (esNuevo) await api.post('/tickets/', payload)
      else         await api.patch(`/tickets/${ticket.id}/`, payload)
      onSaved(); onClose()
    } catch (e) {
      setError('Error al guardar: ' + JSON.stringify(e.response?.data))
    } finally { setSaving(false) }
  }

  const Row = ({ label, name, type = 'text', placeholder = '', readOnly = false }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} name={name} placeholder={placeholder}
        value={form[name] ?? ''} onChange={e => set(name, e.target.value)}
        readOnly={readOnly} style={readOnly ? { background: '#f9fafb', color: '#6b7280' } : {}} />
    </div>
  )

  const CalcRow = ({ label, value, highlight }) => (
    <div className="form-group">
      <label className="form-label" style={{ color: highlight ? '#d97706' : '#9ca3af' }}>{label}</label>
      <input className="form-input" value={value.toFixed(2)} readOnly
        style={{ background: '#f9fafb', color: highlight ? '#d97706' : '#6b7280', fontWeight: highlight ? 600 : 400 }} />
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{esNuevo ? '➕ Agregar nuevo servicio' : `Editar ticket ${ticket.ticket_id}`}</h3>
        <p className="modal-subtitle">Los totales se calculan automáticamente</p>

        {esTerminado && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: '0.875rem', color: '#991b1b' }}>
            🔒 Ticket <strong>Terminado</strong> — solo lectura.
          </div>
        )}
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 14px', borderRadius: 8, marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', opacity: esTerminado ? 0.6 : 1, pointerEvents: esTerminado ? 'none' : 'auto' }}>

          <div style={{ gridColumn: '1/-1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: '#9ca3af' }}>IDENTIFICACIÓN</div>

          {/* EMPRESA */}
          <div className="form-group">
            <label className="form-label">Empresa *</label>
            {addingEmpresa ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" placeholder="Nombre de la empresa" autoFocus
                  value={nuevaEmpresa} onChange={e => setNuevaEmpresa(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmarEmpresa()} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={confirmarEmpresa}>✓</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingEmpresa(false)}>✕</button>
              </div>
            ) : (
              <select className="form-select" value={form.empresa}
                onChange={e => e.target.value === '__nueva__' ? setAddingEmpresa(true) : set('empresa', e.target.value)}>
                <option value="">Selecciona empresa...</option>
                {empresasList.map(e => <option key={e} value={e}>{e}</option>)}
                <option value="__nueva__">➕ Agregar nueva empresa...</option>
              </select>
            )}
            {form.empresa && !addingEmpresa && (
              <span style={{ fontSize: '0.75rem', color: '#059669', marginTop: 2 }}>✓ {form.empresa}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Fecha *</label>
            <input className="form-input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Estatus</label>
            <select className="form-select" value={form.estatus} onChange={e => set('estatus', e.target.value)}>
              <option value="pendiente">Pendiente</option>
              <option value="atendido">En camino</option>
              <option value="proceso">Reparando</option>
              <option value="terminado">Finalizado</option>
            </select>
          </div>

          <Row label="Tipo de unidad" name="tipo_unidad" placeholder="Tractocamión, Caja seca..." />
          <Row label="Unidad"   name="unidad"   placeholder="Kenworth T680" />
          <Row label="Lugar"    name="lugar"    placeholder="Ciudad, Estado" />
          <Row label="Operador" name="operador" placeholder="Nombre del operador" />

          {/* COORDINADOR */}
          <div className="form-group">
            <label className="form-label">Coordinador</label>
            {esCoord ? (
              <input className="form-input" value={nombreCoord} readOnly
                style={{ background: '#f0fdf4', color: '#065f46', fontWeight: 600 }} />
            ) : (
              <select className="form-select" value={form.coordinador} onChange={e => set('coordinador', e.target.value)}>
                <option value="">Sin asignar</option>
                {coordinadoresList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_completo} {c.rol === 'admin' ? '👑' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* TÉCNICO — visible para ambos */}
          <div className="form-group">
            <label className="form-label">Técnico asignado</label>
            <select className="form-select" value={form.tecnico} onChange={e => set('tecnico', e.target.value)}>
              <option value="">Sin asignar</option>
              {tecnicosList.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          {/* PROVEEDOR */}
          <div className="form-group">
            <label className="form-label">Proveedor</label>
            {addingProveedor ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" placeholder="Nombre del proveedor" autoFocus
                  value={nuevoProveedor} onChange={e => setNuevoProveedor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmarProveedor()} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={confirmarProveedor}>✓</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingProveedor(false)}>✕</button>
              </div>
            ) : (
              <select className="form-select" value={form.proveedor}
                onChange={e => e.target.value === '__nuevo__' ? setAddingProveedor(true) : set('proveedor', e.target.value)}>
                <option value="">Sin proveedor</option>
                {proveedoresList.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                <option value="__nuevo__">➕ Agregar nuevo proveedor...</option>
              </select>
            )}
          </div>

          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Reparación realizada</label>
            <textarea className="form-input" rows={2} value={form.reparacion}
              onChange={e => set('reparacion', e.target.value)} placeholder="Describir la reparación..." />
          </div>

          {/* COSTOS */}
          <div style={{ gridColumn: '1/-1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: '#9ca3af', marginTop: 8 }}>COSTOS</div>

          {[
            ['sal_costo',    'Salida — Costo'],
            ['mo_costo',     'Mano de obra — Costo'],
            ['ref_costo',    'Refacciones — Costo'],
            ['sal_ganancia', 'Salida — Ganancia'],
            ['mo_ganancia',  'Mano de obra — Ganancia'],
            ['ref_ganancia', 'Refacciones — Ganancia'],
          ].map(([name, label]) => (
            <div key={name} className="form-group">
              <label className="form-label" style={{ color: name.includes('ganancia') ? '#d97706' : undefined }}>{label}</label>
              <input className="form-input" type="number" min="0" step="0.01"
                value={form[name]} onChange={e => set(name, e.target.value)} />
            </div>
          ))}

          <div style={{ gridColumn: '1/-1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: '#9ca3af', marginTop: 8 }}>TOTALES CALCULADOS</div>

          <CalcRow label="Costo Total"    value={calc.costo} />
          <CalcRow label="Ganancia Total" value={calc.ganancia} highlight />
          <CalcRow label="Total"          value={calc.total} />
          <CalcRow label="IVA (16%)"      value={calc.iva} highlight />
          <CalcRow label="Neto"           value={calc.neto} />
          <CalcRow label="ISR (1.25%)"    value={calc.isr} highlight />
          <CalcRow label="Total Final"    value={calc.total_f} />
          <CalcRow label="Comisión (15%)" value={calc.comision} highlight />

          <div style={{ gridColumn: '1/-1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: '#9ca3af', marginTop: 8 }}>FACTURA</div>

          <Row label="No. Factura"   name="factura"       placeholder="FAC-001" />
          <Row label="Fecha Factura" name="fecha_factura" type="date" />
          <div className="form-group">
            <label className="form-label">Estatus Factura</label>
            <select className="form-select" value={form.estatus_factura} onChange={e => set('estatus_factura', e.target.value)}>
              <option value="pendiente">Pendiente</option>
              <option value="pagada">Pagada</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          {!esTerminado && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : esNuevo ? 'Agregar servicio' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalEliminar({ ticket, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🗑️</div>
        <h3 className="modal-title">¿Eliminar ticket?</h3>
        <p style={{ color: '#6b7280', margin: '0.5rem 0 1.5rem', fontSize: '0.875rem' }}>
          Se eliminará <strong>{ticket.ticket_id}</strong> — {ticket.empresa}. Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" disabled={loading} onClick={async () => {
            setLoading(true)
            await api.delete(`/tickets/${ticket.id}/`)
            onDeleted(); onClose()
          }}>
            {loading ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
export default function BitacoraPage({ rol }) {
  const { user } = useAuth()
  const [tickets,       setTickets]       = useState([])
  const [proveedores,   setProveedores]   = useState([])
  const [coordinadores, setCoordinadores] = useState([])
  const [empresas,      setEmpresas]      = useState([])
  const [tecnicos,      setTecnicos]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [busqueda,      setBusqueda]      = useState('')
  const [tipoFiltro,    setTipoFiltro]    = useState('todos')
  const [ticketNotif,   setTicketNotif]   = useState(null)
  const [modal,         setModal]         = useState(null)
  const [selected,      setSelected]      = useState(null)
  const [empresaFiltro, setEmpresaFiltro] = useState([])   // Excel-like column filter (vacío = todas)
  const [filtroEmpresaAbierto, setFiltroEmpresaAbierto] = useState(false)
  const [paginaSiguiente, setPaginaSiguiente] = useState(null)   // URL de la siguiente página (o null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [totalTickets, setTotalTickets] = useState(0)
  const [papeleraTickets, setPapeleraTickets] = useState([])
  const [loadingPapelera, setLoadingPapelera] = useState(false)
  const [restaurando, setRestaurando] = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()

  // Abrir modal automáticamente si viene ?ticket=ID en la URL
  useEffect(() => {
    const ticketId = searchParams.get('ticket')
    if (ticketId && tickets.length > 0) {
      const t = tickets.find(tk => tk.id === parseInt(ticketId))
      if (t) {
        setSelected(t)
        setModal('editar')
        // Limpiar el parámetro de la URL sin recargar
        setSearchParams({})
      } else {
        // Si no está en la lista local, buscarlo en la API
        api.get(`/tickets/${ticketId}/`).then(({ data }) => {
          setSelected(data)
          setModal('editar')
          setSearchParams({})
        }).catch(() => {})
      }
    }
  }, [searchParams, tickets])

  const fetchAll = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/tickets/'),
      api.get('/proveedores/'),
      api.get('/usuarios/coordinadores/'),
      api.get('/empresas/'),
      api.get('/tecnicos/'),
    ]).then(([t, p, c, e, tec]) => {
      const allTickets = t.data.results || t.data
      setTickets(allTickets)
      setPaginaSiguiente(t.data.next || null)
      setTotalTickets(t.data.count ?? allTickets.length)
      setProveedores(p.data.results || p.data)
      setCoordinadores(c.data)
      setEmpresas(e.data)
      setTecnicos(tec.data.results || tec.data)
    }).finally(() => setLoading(false))
  }, [rol, user?.id])

  const cargarMasTickets = () => {
    if (!paginaSiguiente) return
    setCargandoMas(true)
    api.get(paginaSiguiente)
      .then(({ data }) => {
        setTickets(prev => [...prev, ...(data.results || data)])
        setPaginaSiguiente(data.next || null)
      })
      .finally(() => setCargandoMas(false))
  }

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchPapelera = useCallback(() => {
    setLoadingPapelera(true)
    api.get('/tickets/papelera/')
      .then(({ data }) => setPapeleraTickets(data))
      .finally(() => setLoadingPapelera(false))
  }, [])

  useEffect(() => {
    if (tipoFiltro === 'papelera') fetchPapelera()
  }, [tipoFiltro, fetchPapelera])

  const restaurarTicket = async (id) => {
    setRestaurando(id)
    try {
      await api.post(`/tickets/${id}/restaurar/`)
      fetchPapelera()
      fetchAll()
    } catch (e) {
      alert('No se pudo restaurar. ' + (e?.response?.data?.error || ''))
    } finally { setRestaurando(null) }
  }

  const handleNuevoProveedor = (prov) => setProveedores(prev => [...prev, prov])

  const empresasUnicas = [...new Set(tickets.map(t => t.empresa).filter(Boolean))].sort()

  const filtrados = tickets.filter(t => {
    const matchBusqueda =
      (t.ticket_id || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (t.empresa   || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (t.unidad    || '').toLowerCase().includes(busqueda.toLowerCase())
    const matchTipo = tipoFiltro === 'todos' || (t.tipo_solicitud || 'coordinador') === tipoFiltro
    const matchEmpresa = empresaFiltro.length === 0 || empresaFiltro.includes(t.empresa)
    return matchBusqueda && matchTipo && matchEmpresa
  })

  const toggleEmpresaFiltro = (emp) => {
    setEmpresaFiltro(prev => prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp])
  }

  const openModal = (tipo, ticket = null) => { setSelected(ticket); setModal(tipo) }
  const closeModal = () => setModal(null)

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Bitácora</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              {filtrados.length} de {totalTickets} registros{paginaSiguiente ? ' (hay más sin cargar)' : ''}
              {rol === 'coordinador' && ' · solo tus servicios'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input className="form-input" placeholder="Buscar ticket, empresa, unidad..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: 260 }} />
            <button className="btn btn-primary" onClick={() => openModal('editar', null)}
              style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              ＋ Agregar nuevo servicio
            </button>
            <CampanaNotificaciones onAbrirTicket={(t) => { setTicketNotif(t) }} />
          </div>
        </div>

        {/* Tabs Técnico / Coordinador */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'white', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid #e5e7eb' }}>
          {[['todos','📋 Todos'],['coordinador','🧑‍💼 Coordinador'],['tecnico','👷 Técnico'],
            ...(rol === 'admin' || rol === 'coordinador' ? [['papelera','🗑️ Papelera']] : [])
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTipoFiltro(key)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: tipoFiltro === key ? 600 : 400,
                background: tipoFiltro === key ? '#111' : 'transparent',
                color: tipoFiltro === key ? 'white' : '#6b7280', fontSize: '0.875rem' }}>
              {label}
            </button>
          ))}
        </div>

        {tipoFiltro === 'papelera' ? (
          loadingPapelera ? <div className="loader"><div className="spinner" /></div> : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket</th><th>Empresa</th><th>Fecha</th><th>Estatus</th>
                      <th>Eliminado por</th><th>Eliminado el</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {papeleraTickets.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                        La papelera está vacía
                      </td></tr>
                    )}
                    {papeleraTickets.map(t => (
                      <tr key={t.id}>
                        <td>{t.ticket_id}</td>
                        <td>{t.empresa}</td>
                        <td>{t.fecha}</td>
                        <td><span className={`badge badge-${t.estatus}`}>{t.estatus_display || t.estatus}</span></td>
                        <td>{t.eliminado_por_nombre || '—'}</td>
                        <td>{t.eliminado_en ? new Date(t.eliminado_en).toLocaleString('es-MX') : '—'}</td>
                        <td>
                          <button className="btn btn-sm btn-ghost" disabled={restaurando === t.id}
                            onClick={() => restaurarTicket(t.id)}>
                            {restaurando === t.id ? 'Restaurando...' : '↩️ Restaurar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : loading ? <div className="loader"><div className="spinner" /></div> : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="col-sticky-1">Ticket</th>
                    <th className="col-sticky-2" style={{ position: 'relative', zIndex: filtroEmpresaAbierto ? 50 : undefined }}>
                      <div className="th-filtro">
                        <span>Empresa</span>
                        <button
                          type="button"
                          className="th-filtro-btn"
                          title="Filtrar por empresa"
                          onClick={() => setFiltroEmpresaAbierto(v => !v)}
                        >
                          🔽{empresaFiltro.length > 0 ? ` (${empresaFiltro.length})` : ''}
                        </button>
                      </div>
                      {filtroEmpresaAbierto && (
                        <div className="th-filtro-panel" onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span
                              style={{ color: 'var(--azul)', cursor: 'pointer', fontWeight: 600 }}
                              onClick={() => setEmpresaFiltro([])}
                            >
                              Limpiar
                            </span>
                            <span
                              style={{ color: '#9ca3af', cursor: 'pointer' }}
                              onClick={() => setFiltroEmpresaAbierto(false)}
                            >
                              Cerrar
                            </span>
                          </div>
                          {empresasUnicas.length === 0 && (
                            <div style={{ color: '#9ca3af', padding: '4px 6px' }}>Sin empresas</div>
                          )}
                          {empresasUnicas.map(emp => (
                            <label key={emp} className="th-filtro-item">
                              <input
                                type="checkbox"
                                checked={empresaFiltro.includes(emp)}
                                onChange={() => toggleEmpresaFiltro(emp)}
                              />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </th>
                    <th className="col-sticky-3">Fecha</th>
                    <th className="col-sticky-4">Estatus</th>
                    <th>Tipo Unidad</th>
                    <th>Unidad</th><th>Lugar</th><th>Técnico</th><th>Reparación</th>
                    {rol === 'admin' && <><th>Sal.C</th><th>M.O.C</th><th>Ref.C</th></>}
                    <th>Costo</th><th>Ganancia</th><th>Total</th><th>IVA</th>
                    {rol === 'admin' && <><th>Neto</th><th>ISR</th><th>Total F</th></>}
                    <th>Factura</th><th>F.Fact.</th><th>Est.Fact.</th>
                    <th>Proveedor</th><th>Coordinador</th>
                    {rol === 'admin' && <th>Comisión</th>}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 && (
                    <tr><td colSpan={26} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No hay tickets</td></tr>
                  )}
                  {filtrados.map(t => (
                    <tr key={t.id} style={{ opacity: t.estatus === 'terminado' ? 0.8 : 1 }}>
                      <td className="td-link col-sticky-1" onClick={() => openModal('detalle', t)}>{t.ticket_id}</td>
                      <td className="col-sticky-2">{t.empresa}</td>
                      <td className="col-sticky-3">{t.fecha}</td>
                      <td className="col-sticky-4">
                        <span className={`badge badge-${t.estatus}`}>{t.estatus_display || t.estatus}</span>
                        {t.estatus === 'terminado' && <span title="Cerrado" style={{ marginLeft: 4 }}>🔒</span>}
                      </td>
                      <td>{t.tipo_unidad || '—'}</td>
                      <td>{t.unidad}</td>
                      <td>{t.lugar}</td>
                      <td>{t.tecnico_nombre || '—'}</td>
                      <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.reparacion}</td>
                      {rol === 'admin' && <>
                        <td>{fmt(t.sal_costo)}</td>
                        <td>{fmt(t.mo_costo)}</td>
                        <td>{fmt(t.ref_costo)}</td>
                      </>}
                      <td style={{ fontWeight: 600 }}>{fmt(t.costo)}</td>
                      <td className="td-naranja">{fmt(t.ganancia)}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(t.total)}</td>
                      <td className="td-naranja">{fmt(t.iva)}</td>
                      {rol === 'admin' && <>
                        <td>{fmt(t.neto)}</td>
                        <td>{fmt(t.isr)}</td>
                        <td style={{ fontWeight: 700 }}>{fmt(t.total_f)}</td>
                      </>}
                      <td>{t.factura || '—'}</td>
                      <td>{t.fecha_factura || '—'}</td>
                      <td>{t.estatus_factura ? <span className={`badge badge-${t.estatus_factura}`}>{t.estatus_factura}</span> : '—'}</td>
                      <td>{t.proveedor_nombre || '—'}</td>
                      <td>{t.coordinador_nombre || '—'}</td>
                      {rol === 'admin' && <td className="td-naranja">{fmt(t.comision)}</td>}
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-ghost" title="Ver" onClick={() => openModal('detalle', t)}>👁</button>
                          {(t.estatus !== 'terminado' || t.puede_editar_coordinador) && (
                            <button className="btn btn-sm btn-ghost" title="Editar" onClick={() => openModal('editar', t)}>✏️</button>
                          )}
                          <button className="btn btn-sm btn-ghost" title="Eliminar" style={{ color: '#dc2626' }}
                            onClick={() => openModal('eliminar', t)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginaSiguiente && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                <button className="btn btn-ghost" disabled={cargandoMas} onClick={cargarMasTickets}>
                  {cargandoMas ? 'Cargando...' : `⬇ Cargar más (${totalTickets - tickets.length} restantes)`}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {modal === 'editar' && (
        <ModalTicket
          ticket={selected}
          coordinadoresList={coordinadores}
          proveedoresList={proveedores}
          empresasList={empresas}
          tecnicosList={tecnicos}
          onClose={closeModal}
          onSaved={fetchAll}
          onNuevoProveedor={handleNuevoProveedor}
          rol={rol}
        />
      )}
      {modal === 'eliminar' && selected && (
        <ModalEliminar ticket={selected} onClose={closeModal} onDeleted={fetchAll} />
      )}
      {ticketNotif && (
        <ModalDetalleTicket
          ticket={ticketNotif}
          soloLectura={ticketNotif.estatus === 'terminado' && !ticketNotif.puede_editar_coordinador}
          onClose={() => setTicketNotif(null)}
          onUpdated={fetchAll}
        />
      )}
      {modal === 'detalle' && selected && (
        <ModalDetalleTicket
          ticket={selected}
          soloLectura={selected.estatus === 'terminado' && !selected.puede_editar_coordinador}
          onClose={closeModal}
          onUpdated={fetchAll}
        />
      )}
    </div>
  )
}
