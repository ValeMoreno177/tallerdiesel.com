import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import Sidebar from '../components/Sidebar'
import CampanaNotificaciones from '../components/CampanaNotificaciones'
import useAutoRefresh from '../hooks/useAutoRefresh'
import ModalDetalleTicket from '../components/ModalDetalleTicket'
import ChatTicketModal, { BotonChat } from '../components/ChatTicketModal'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import CamionTitulo from '../components/CamionTitulo'
import useEsCelular from '../hooks/useEsCelular'
import { EsqueletoTabla } from '../components/Esqueleto'

// ─────────────────────────────────────────────
const fmt = n => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

const FORM_VACIO = {
  empresa: '', fecha: new Date().toISOString().slice(0, 10),
  estatus: 'pendiente', tipo_unidad: '', unidad: '', lugar: '', operador: '', reparacion: '',
  sal_costo: '0', mo_costo: '0', ref_costo: '0',
  sal_ganancia: '0', mo_ganancia: '0', ref_ganancia: '0',
  factura: '', fecha_factura: '', estatus_factura: 'pendiente',
  coordinador: '', tecnico: '', cliente: '',
}

// Filtro de estatus de la Bitácora ('' = todos)
const ESTATUS_FILTRO = [
  ['pendiente', '⏳ En espera'],
  ['atendido', '🚚 En camino'],
  ['proceso', '🔧 Reparando'],
  ['terminado', '✅ Finalizado'],
  ['pendiente,atendido,proceso', '📂 Abiertos (sin finalizar)'],
  ['', '📋 Todos'],
]

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
  // Totales por concepto (costo + ganancia) para Facturación
  const total_salida = salC + salG
  const total_mo     = moC + moG
  const total_ref    = refC + refG
  return { costo, ganancia, total, iva, neto, isr, total_f, comision, total_salida, total_mo, total_ref }
}

// Campos del formulario definidos FUERA del modal: si se definen adentro, React los vuelve a crear
// en cada letra que se escribe y el cuadro de texto pierde el cursor.
function Row({ label, name, form, set, type = 'text', placeholder = '', readOnly = false }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} name={name} placeholder={placeholder}
        value={form[name] ?? ''} onChange={e => set(name, e.target.value)}
        readOnly={readOnly} style={readOnly ? { background: '#f9fafb', color: '#6b7280' } : {}} />
    </div>
  )
}

function CalcRow({ label, value, highlight }) {
  return (
    <div className="form-group">
      <label className="form-label" style={{ color: highlight ? '#d97706' : '#9ca3af' }}>{label}</label>
      <input className="form-input" value={value.toFixed(2)} readOnly
        style={{ background: '#f9fafb', color: highlight ? '#d97706' : '#6b7280', fontWeight: highlight ? 600 : 400 }} />
    </div>
  )
}

// ─────────────────────────────────────────────
// Modal CRUD
// ─────────────────────────────────────────────
function ModalTicket({ ticket, coordinadoresList, empresasList, tecnicosList, onClose, onSaved, rol }) {
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
      const nullToStr = ['cliente','coordinador','tecnico','factura','fecha_factura','estatus_factura','reparacion','lugar','operador','unidad','tipo_unidad','empresa']
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

  // Clientes registrados, para mostrar (y elegir) el cliente debajo de la empresa
  const [clientes, setClientes] = useState([])
  useEffect(() => {
    api.get('/usuarios/clientes/').then(({ data }) => setClientes(data)).catch(() => {})
  }, [])
  const clientesEmpresa = clientes.filter(c => !form.empresa || (c.empresa || '').toLowerCase() === form.empresa.toLowerCase())
  // Por default: al elegir la empresa se pone su cliente (el primero registrado con esa empresa)
  useEffect(() => {
    if (!form.empresa || form.cliente || !clientes.length) return
    const delaEmpresa = clientes.find(c => (c.empresa || '').toLowerCase() === form.empresa.toLowerCase())
    if (delaEmpresa) setForm(f => ({ ...f, cliente: String(delaEmpresa.id) }))
  }, [form.empresa, form.cliente, clientes])

  const [nuevaEmpresa,    setNuevaEmpresa]    = useState('')
  const [addingEmpresa,   setAddingEmpresa]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // El Administrador edita TODOS los tickets, también los finalizados
  const esTerminado = !esNuevo && ticket?.estatus === 'terminado' && !ticket?.puede_editar_coordinador && !esAdmin
  // Servicio directo con técnico y con cliente: el coordinador no lo finaliza aquí, el cliente lo confirma.
  const requiereConfirmacionCliente = esCoord && !esNuevo && ticket?.tipo_solicitud === 'tecnico' && !!ticket?.cliente

  const calc = calcular(form)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const confirmarEmpresa = () => {
    if (nuevaEmpresa.trim()) { set('empresa', nuevaEmpresa.trim()); setAddingEmpresa(false) }
  }

  const handleSave = async () => {
    if (!form.empresa || !form.fecha) { setError('Empresa y fecha son obligatorios.'); return }
    setSaving(true); setError('')
    // Convertir strings vacíos a null para campos de fecha y FK
    const payload = {
      ...form,
      coordinador:   form.coordinador   || null,
      tecnico:       form.tecnico       || null,
      cliente:       form.cliente       || null,
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{esNuevo ? '➕ Agregar nuevo servicio' : `Editar ticket ${ticket.etiqueta || ticket.ticket_id}`}</h3>
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
            {/* Cliente: aparece debajo de la empresa, ya elegido por default */}
            <label className="form-label" style={{ marginTop: 8 }}>Cliente</label>
            <select className="form-select" value={form.cliente} onChange={e => set('cliente', e.target.value)}>
              <option value="">Sin cliente</option>
              {(clientesEmpresa.length ? clientesEmpresa : clientes).map(c => (
                <option key={c.id} value={c.id}>{c.nombre_completo}{c.empresa ? ` — ${c.empresa}` : ''}</option>
              ))}
              {/* Si el cliente actual no está en la lista (otra empresa), igual se muestra */}
              {form.cliente && !clientes.some(c => String(c.id) === String(form.cliente)) && (
                <option value={form.cliente}>{ticket?.cliente_nombre || `Cliente #${form.cliente}`}</option>
              )}
            </select>
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
              <option value="terminado" disabled={requiereConfirmacionCliente && ticket?.estatus !== 'terminado'}>
                Finalizado{requiereConfirmacionCliente && ticket?.estatus !== 'terminado' ? ' (lo confirma el cliente)' : ''}
              </option>
            </select>
            {requiereConfirmacionCliente && ticket?.estatus !== 'terminado' && (
              <span style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
                Servicio directo con técnico: usa "Solicitar finalización" en el detalle del ticket.
              </span>
            )}
          </div>

          <Row form={form} set={set} label="Tipo de unidad" name="tipo_unidad" placeholder="Tractocamión, Caja seca..." />
          <Row form={form} set={set} label="Unidad"   name="unidad"   placeholder="Kenworth T680" />
          <Row form={form} set={set} label="Lugar"    name="lugar"    placeholder="Ciudad, Estado" />
          <Row form={form} set={set} label="Operador" name="operador" placeholder="Nombre del operador" />

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

          <CalcRow label="Total de Salida"        value={calc.total_salida} />
          <CalcRow label="Total de Refacciones"   value={calc.total_ref} />
          <CalcRow label="Total de Mano de obra"  value={calc.total_mo} />
          <CalcRow label="Costo Total"    value={calc.costo} />
          <CalcRow label="Ganancia Total" value={calc.ganancia} highlight />
          <CalcRow label="Total General"  value={calc.total} />
          <CalcRow label="IVA (16%)"      value={calc.iva} highlight />
          <CalcRow label="Neto"           value={calc.neto} />
          <CalcRow label="ISR (1.25%)"    value={calc.isr} highlight />
          <CalcRow label="Total Final"    value={calc.total_f} />
          <CalcRow label="Comisión (15%)" value={calc.comision} highlight />

          <div style={{ gridColumn: '1/-1', fontSize: '0.72rem', fontWeight: 700, letterSpacing: 2, color: '#9ca3af', marginTop: 8 }}>FACTURA</div>

          <Row form={form} set={set} label="No. Factura"   name="factura"       placeholder="FAC-001" />
          <Row form={form} set={set} label="Fecha Factura" name="fecha_factura" type="date" />
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
          Se eliminará <strong>{ticket.etiqueta || ticket.ticket_id}</strong> — {ticket.empresa}. Esta acción no se puede deshacer.
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
  const esCelular = useEsCelular()
  const [tickets,       setTickets]       = useState([])
  const [coordinadores, setCoordinadores] = useState([])
  const [empresas,      setEmpresas]      = useState([])
  const [tecnicos,      setTecnicos]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [busqueda,      setBusqueda]      = useState('')
  const [tipoFiltro,    setTipoFiltro]    = useState('todos')
  // Al abrir se muestran los servicios EN ESPERA (pendientes); se puede cambiar a cualquier estatus o a todos
  const [estatusFiltro, setEstatusFiltro] = useState('pendiente')
  const [fechaDesde,    setFechaDesde]    = useState('')
  const [fechaHasta,    setFechaHasta]    = useState('')
  const [actualizado,   setActualizado]   = useState(null)
  const [empresaFiltro, setEmpresaFiltro] = useState([])   // Excel-like column filter (vacío = todas)
  const paramsTickets = (() => {
    const p = new URLSearchParams()
    if (estatusFiltro) p.set('estatus', estatusFiltro)
    if (fechaDesde) p.set('fecha_desde', fechaDesde)
    if (fechaHasta) p.set('fecha_hasta', fechaHasta)
    if (empresaFiltro.length) p.set('empresas', empresaFiltro.join(','))
    const q = p.toString()
    return q ? `?${q}` : ''
  })()
  const [ticketNotif,   setTicketNotif]   = useState(null)
  const [ticketChat, setTicketChat] = useState(null)
  const [modal,         setModal]         = useState(null)
  const [selected,      setSelected]      = useState(null)
  const [filtroEmpresaAbierto, setFiltroEmpresaAbierto] = useState(false)
  const [posFiltroEmpresa, setPosFiltroEmpresa] = useState(null)
  const [buscaEmpresa, setBuscaEmpresa] = useState('')
  const botonEmpresaRef = useRef(null)
  const panelEmpresaRef = useRef(null)
  const abrirFiltroEmpresa = () => {
    if (filtroEmpresaAbierto) { setFiltroEmpresaAbierto(false); return }
    const r = botonEmpresaRef.current?.getBoundingClientRect()
    if (r) setPosFiltroEmpresa({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 90, window.innerWidth - 248)) })
    setBuscaEmpresa('')
    setFiltroEmpresaAbierto(true)
  }
  // Se cierra al hacer clic fuera, al desplazarse o al cambiar el tamaño de la ventana
  useEffect(() => {
    if (!filtroEmpresaAbierto) return undefined
    const fuera = e => {
      if (panelEmpresaRef.current?.contains(e.target) || botonEmpresaRef.current?.contains(e.target)) return
      setFiltroEmpresaAbierto(false)
    }
    const cerrar = e => { if (!panelEmpresaRef.current?.contains(e.target)) setFiltroEmpresaAbierto(false) }
    document.addEventListener('mousedown', fuera)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [filtroEmpresaAbierto])
  const [paginaSiguiente, setPaginaSiguiente] = useState(null)   // URL de la siguiente página (o null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [totalTickets, setTotalTickets] = useState(0)
  const [papeleraTickets, setPapeleraTickets] = useState([])
  const [loadingPapelera, setLoadingPapelera] = useState(false)
  const [restaurando, setRestaurando] = useState(null)
  // ── Selección para mandar varios tickets a la papelera de una vez ──
  const [seleccion, setSeleccion] = useState(() => new Set())
  const [confirmarPapelera, setConfirmarPapelera] = useState(null)   // { todos: bool, cantidad }
  const [moviendo, setMoviendo] = useState(false)
  const puedeBorrarVarios = rol === 'admin' || rol === 'coordinador'
  const borrableEnLote = t => rol === 'admin' || (rol === 'coordinador' && t.coordinador === user?.id)
  // Al cambiar los filtros se limpia la selección (para no borrar algo que ya no se ve)
  useEffect(() => { setSeleccion(new Set()) }, [paramsTickets, tipoFiltro, busqueda, empresaFiltro])
  const alternarSeleccion = id => setSeleccion(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

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

  const paginasCargadas = useRef(1)   // cuántas páginas de tickets tiene cargadas el usuario

  const fetchAll = useCallback(() => {
    setLoading(true)
    paginasCargadas.current = 1
    Promise.all([
      api.get(`/tickets/${paramsTickets}`),
      api.get('/usuarios/coordinadores/'),
      api.get('/empresas/'),
      api.get('/tecnicos/'),
    ]).then(([t, c, e, tec]) => {
      const allTickets = t.data.results || t.data
      setTickets(allTickets)
      setPaginaSiguiente(t.data.next || null)
      setTotalTickets(t.data.count ?? allTickets.length)
      setCoordinadores(c.data)
      setEmpresas(e.data)
      setTecnicos(tec.data.results || tec.data)
      setActualizado(new Date())
    }).finally(() => setLoading(false))
  }, [rol, user?.id, paramsTickets])

  const cargarMasTickets = () => {
    if (!paginaSiguiente) return
    setCargandoMas(true)
    api.get(paginaSiguiente)
      .then(({ data }) => {
        paginasCargadas.current += 1
        setTickets(prev => [...prev, ...(data.results || data)])
        setPaginaSiguiente(data.next || null)
      })
      .finally(() => setCargandoMas(false))
  }

  useEffect(() => { fetchAll() }, [fetchAll])

  // Actualización automática cada 5 s: solo los tickets, sin spinner y sin perder el scroll,
  // los filtros ni las páginas que el usuario ya cargó con "Cargar más".
  const refrescarSilencioso = useCallback(async () => {
    const { data } = await api.get(`/tickets/${paramsTickets}`)
    setActualizado(new Date())
    const frescos = data.results || data
    if (paginasCargadas.current === 1) {
      setTickets(frescos)
      setPaginaSiguiente(data.next || null)
      setTotalTickets(data.count ?? frescos.length)
    } else {
      // Ya hay más páginas cargadas: se actualizan los que cambiaron y se agregan los nuevos arriba
      setTickets(prev => {
        const porId = new Map(frescos.map(t => [t.id, t]))
        const idsPrev = new Set(prev.map(t => t.id))
        return [...frescos.filter(t => !idsPrev.has(t.id)), ...prev.map(t => porId.get(t.id) || t)]
      })
      setTotalTickets(data.count ?? frescos.length)
    }
  }, [paramsTickets])
  useAutoRefresh(refrescarSilencioso, { soloVisible: true })

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

  // Todas las empresas (catálogo + las de los tickets cargados), no solo las de la página visible
  const empresasUnicas = [...new Set([...(empresas || []), ...tickets.map(t => t.empresa)].filter(Boolean))]
    .sort((x, y) => x.localeCompare(y, 'es'))
  const empresasLista = empresasUnicas.filter(e => e.toLowerCase().includes(buscaEmpresa.trim().toLowerCase()))

  const filtrados = tickets.filter(t => {
    const matchBusqueda =
      (t.etiqueta || t.ticket_id || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (t.empresa   || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (t.unidad    || '').toLowerCase().includes(busqueda.toLowerCase())
    const matchTipo = tipoFiltro === 'todos' || (t.tipo_solicitud || 'coordinador') === tipoFiltro
    const matchEmpresa = empresaFiltro.length === 0 || empresaFiltro.includes(t.empresa)
    return matchBusqueda && matchTipo && matchEmpresa
  })

  // ── Exportar con los filtros que se están viendo ──
  const [exportando, setExportando] = useState(false)
  const exportarExcel = async () => {
    setExportando(true)
    try {
      const params = new URLSearchParams()
      if (tipoFiltro && tipoFiltro !== 'todos' && tipoFiltro !== 'papelera') params.set('tipo', tipoFiltro)
      if (busqueda) params.set('busqueda', busqueda)
      if (empresaFiltro.length) params.set('empresas', empresaFiltro.join(','))
      if (estatusFiltro) params.set('estatus', estatusFiltro)
      if (fechaDesde) params.set('fecha_desde', fechaDesde)
      if (fechaHasta) params.set('fecha_hasta', fechaHasta)
      const { data } = await api.get(`/tickets/exportar_excel/?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `bitacora_tallerdiesel_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      alert('No se pudo generar el Excel. Intenta de nuevo.')
    } finally { setExportando(false) }
  }
  const exportarPDF = () => {
    // Abre una versión para imprimir; desde ahí se elige "Guardar como PDF".
    // Todo texto que viene de la base de datos se escapa antes de meterlo al HTML
    const esc = v => String(v ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))
    const filas = filtrados.map(t => `<tr>
      <td>${esc(t.etiqueta || t.ticket_id)}</td><td>${esc(t.empresa)}</td><td>${esc(t.fecha)}</td>
      <td>${esc(t.estatus_display || t.estatus)}</td><td>${esc(t.unidad)}</td><td>${esc(t.lugar)}</td>
      <td>${esc(t.tecnico_nombre || '—')}</td><td>${esc(t.coordinador_nombre || '—')}</td>
      <td style="text-align:right">${fmt(t.total)}</td><td>${esc(t.factura || '—')}</td></tr>`).join('')
    const filtrosTexto = [
      tipoFiltro !== 'todos' ? `Tipo: ${tipoFiltro}` : null,
      busqueda ? `Búsqueda: "${esc(busqueda)}"` : null,
      empresaFiltro.length ? `Empresas: ${esc(empresaFiltro.join(', '))}` : null,
      estatusFiltro ? `Estatus: ${ESTATUS_FILTRO.find(e => e[0] === estatusFiltro)?.[1] || estatusFiltro}` : null,
      fechaDesde || fechaHasta ? `Fechas: ${fechaDesde || '…'} a ${fechaHasta || '…'}` : null,
    ].filter(Boolean).join(' · ') || 'Sin filtros'
    const total = filtrados.reduce((acc, t) => acc + (parseFloat(t.total) || 0), 0)
    const w = window.open('', '_blank')
    if (!w) { alert('Permite las ventanas emergentes para generar el PDF.'); return }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Bitácora TallerDiesel</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111}
        h1{margin:0;font-size:20px} h1 span{color:#e85d04}
        .meta{color:#6b7280;font-size:12px;margin:4px 0 14px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#111827;color:#fff;text-align:left;padding:6px}
        td{padding:5px 6px;border-bottom:1px solid #e5e7eb}
        tr:nth-child(even) td{background:#f9fafb}
        tfoot td{font-weight:bold;border-top:2px solid #111827}
        @page{size:landscape;margin:12mm}
      </style></head><body>
      <h1>TALLER<span>DIESEL</span> — Bitácora</h1>
      <div class="meta">${new Date().toLocaleString('es-MX')} · ${filtrados.length} registros · ${filtrosTexto}</div>
      <table><thead><tr><th>Ticket</th><th>Empresa</th><th>Fecha</th><th>Estatus</th><th>Unidad</th><th>Lugar</th>
      <th>Técnico</th><th>Coordinador</th><th>Total</th><th>Factura</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="8">Total</td><td style="text-align:right">${fmt(total)}</td><td></td></tr></tfoot></table>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`)
    w.document.close()
  }

  const mandarAPapelera = async () => {
    if (!confirmarPapelera) return
    setMoviendo(true)
    try {
      const params = new URLSearchParams(paramsTickets.replace(/^\?/, ''))
      if (tipoFiltro && tipoFiltro !== 'todos') params.set('tipo', tipoFiltro)
      if (busqueda) params.set('busqueda', busqueda)
      if (empresaFiltro.length) params.set('empresas', empresaFiltro.join(','))
      const cuerpo = confirmarPapelera.todos ? { todos: true } : { ids: [...seleccion] }
      const { data } = await api.post(`/tickets/mandar_a_papelera/?${params}`, cuerpo)
      setSeleccion(new Set())
      setConfirmarPapelera(null)
      fetchAll()
      alert(`🗑️ ${data.movidos} ${data.movidos === 1 ? 'ticket se mandó' : 'tickets se mandaron'} a la papelera. Puedes restaurarlos desde la pestaña Papelera.`)
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudieron mandar a la papelera.')
    } finally { setMoviendo(false) }
  }

  const restaurarTodos = async () => {
    if (!window.confirm(`¿Restaurar los ${papeleraTickets.length} tickets de la papelera?`)) return
    try {
      const { data } = await api.post('/tickets/restaurar_todos/', { todos: true })
      fetchPapelera(); fetchAll()
      alert(`↩️ Se restauraron ${data.restaurados} tickets.`)
    } catch (e) { alert(e?.response?.data?.error || 'No se pudieron restaurar.') }
  }

  const toggleEmpresaFiltro = (emp) => {
    setEmpresaFiltro(prev => prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp])
  }

  const openModal = (tipo, ticket = null) => { setSelected(ticket); setModal(tipo) }
  const closeModal = () => setModal(null)

  return (
    <div className="dashboard-layout" style={{ position: 'relative', paddingBottom: '70px' }}>

      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Bitácora</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              {filtrados.length} de {totalTickets} registros{paginaSiguiente ? ' (hay más sin cargar)' : ''}
              {actualizado && (
                <span className="bit-actualizado" title="La lista se actualiza sola cada pocos segundos">
                  {' '}· 🔄 actualizado {actualizado.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
              {rol === 'coordinador' && ' · solo tus servicios'}
            </p>
            <CamionTitulo />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input className="form-input" placeholder="Buscar ticket, empresa, unidad..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: 260 }} />
            {(rol === 'admin' || rol === 'coordinador') && tipoFiltro !== 'papelera' && (
              <>
                <button className="btn btn-ghost" onClick={exportarExcel} disabled={exportando} title="Descargar en Excel con los filtros actuales">
                  {exportando ? '⏳' : '📊'} Excel
                </button>
                <button className="btn btn-ghost" onClick={exportarPDF} title="Imprimir o guardar como PDF con los filtros actuales">
                  🖨️ PDF
                </button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => openModal('editar', null)}
              style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              ＋ Agregar nuevo servicio
            </button>
            <CampanaNotificaciones
              onAbrirTicket={setTicketNotif}
              onAbrirChat={setTicketChat}
            />
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

        {tipoFiltro !== 'papelera' && (
          <div className="bit-filtros">
            <label>
              <span>Estatus</span>
              <select className="form-select" value={estatusFiltro} onChange={e => setEstatusFiltro(e.target.value)}>
                {ESTATUS_FILTRO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span>Desde</span>
              <input className="form-input" type="date" value={fechaDesde} max={fechaHasta || undefined}
                onChange={e => setFechaDesde(e.target.value)} />
            </label>
            <label>
              <span>Hasta</span>
              <input className="form-input" type="date" value={fechaHasta} min={fechaDesde || undefined}
                onChange={e => setFechaHasta(e.target.value)} />
            </label>
            {[['Hoy', 0], ['7 días', 7], ['30 días', 30]].map(([l, d]) => (
              <button key={l} type="button" className="btn btn-sm btn-ghost" onClick={() => {
                const hoy = new Date(); const ini = new Date(); ini.setDate(hoy.getDate() - d)
                const f = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
                setFechaDesde(f(ini)); setFechaHasta(f(hoy))
              }}>{l}</button>
            ))}
            {(estatusFiltro !== 'pendiente' || fechaDesde || fechaHasta) && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEstatusFiltro('pendiente'); setFechaDesde(''); setFechaHasta('') }}>
                ↺ Restablecer
              </button>
            )}
            <style>{`
              .bit-filtros { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin: -0.5rem 0 1rem; }
              .bit-filtros label { display: flex; flex-direction: column; gap: 3px; font-size: 0.72rem; color: #6b7280; font-weight: 600; }
              .bit-filtros .form-select, .bit-filtros .form-input { padding: 7px 10px; font-size: 0.85rem; }
              .bit-actualizado { color: #9ca3af; }
            `}</style>
          </div>
        )}

        {puedeBorrarVarios && tipoFiltro !== 'papelera' && !loading && filtrados.length > 0 && (
          <div className="bit-lote">
            {seleccion.size > 0 ? (
              <>
                <strong>{seleccion.size} seleccionado{seleccion.size === 1 ? '' : 's'}</strong>
                <button className="btn btn-sm btn-danger" onClick={() => setConfirmarPapelera({ todos: false, cantidad: seleccion.size })}>
                  🗑️ Mandar seleccionados a la papelera
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setSeleccion(new Set())}>Quitar selección</button>
              </>
            ) : (
              <span style={{ color: '#6b7280' }}>Marca las casillas para mandar varios tickets a la papelera, o:</span>
            )}
            <button className="btn btn-sm btn-ghost" style={{ color: '#dc2626', borderColor: '#fecaca', marginLeft: 'auto' }}
              onClick={() => setConfirmarPapelera({ todos: true, cantidad: totalTickets })}
              title="Manda a la papelera TODOS los tickets que coinciden con los filtros actuales">
              🗑️ Todos los de este filtro ({totalTickets})
            </button>
            <style>{`.bit-lote { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 0.75rem;
              padding: 8px 12px; border-radius: 10px; background: white; border: 1px dashed #e5e7eb; font-size: 0.85rem; }
              html[data-tema="oscuro"] .bit-lote { background: #111827; border-color: #334155; }`}</style>
          </div>
        )}

        {tipoFiltro === 'papelera' ? (
          loadingPapelera ? <EsqueletoTabla filas={4} /> : (
            <div className="card" style={{ padding: 0 }}>
              {papeleraTickets.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{papeleraTickets.length} en la papelera</span>
                  <button className="btn btn-sm btn-ghost" onClick={restaurarTodos}>↩️ Restaurar todos</button>
                </div>
              )}
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
                        <td>{t.etiqueta || t.ticket_id}</td>
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
        ) : loading ? <EsqueletoTabla /> : esCelular ? (
          /* ── Celular: una tarjeta por ticket en lugar de la tabla ancha ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtrados.length === 0 && (
              <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No hay tickets</div>
            )}
            {filtrados.map(t => {
              const editable = t.puede_editar && (t.estatus !== 'terminado' || t.puede_editar_coordinador || rol === 'admin')
              const borrable = rol === 'admin' || (rol === 'coordinador' && t.coordinador === user?.id)
              return (
                <article key={t.id} className="card bit-tarjeta" style={{ padding: '0.9rem 1rem', opacity: t.estatus === 'terminado' ? 0.85 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editable && (
                      <button className="btn btn-sm btn-ghost" style={{ padding: '2px 7px' }} title="Editar"
                        aria-label={`Editar ${t.etiqueta || t.ticket_id}`} onClick={() => openModal('editar', t)}>✏️</button>
                    )}
                    <button className="td-link" style={{ background: 'none', border: 0, padding: 0, fontSize: '1rem' }}
                      onClick={() => openModal('detalle', t)}>{t.etiqueta || t.ticket_id}</button>
                    <span className={`badge badge-${t.estatus}`} style={{ marginLeft: 'auto' }}>{t.estatus_display || t.estatus}</span>
                    {t.estatus === 'terminado' && <span title="Cerrado">🔒</span>}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{t.empresa}</div>
                  {t.cliente_nombre && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>👤 {t.cliente_nombre}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.8rem', color: '#6b7280', marginTop: 6 }}>
                    <span>📅 {t.fecha}</span>
                    <span>🚛 {t.unidad || '—'}</span>
                    <span>📍 {t.lugar || '—'}</span>
                    <span>👷 {t.tecnico_nombre || 'Sin técnico'}</span>
                    <span>🧑‍💼 {t.coordinador_nombre || '—'}</span>
                    <span style={{ fontWeight: 700, color: '#111' }}>{fmt(t.total)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <BotonChat ticket={t} onClick={() => setTicketChat(t)} />
                    {t.estatus_factura && <span className={`badge badge-${t.estatus_factura}`}>Factura: {t.estatus_factura}</span>}
                    {borrable && (
                      <button className="btn btn-sm btn-ghost" title="Eliminar" aria-label="Eliminar"
                        style={{ marginLeft: 'auto', color: '#dc2626' }} onClick={() => openModal('eliminar', t)}>🗑️</button>
                    )}
                  </div>
                </article>
              )
            })}
            {paginaSiguiente && (
              <button className="btn btn-ghost" style={{ justifyContent: 'center' }} disabled={cargandoMas} onClick={cargarMasTickets}>
                {cargandoMas ? 'Cargando...' : `⬇ Cargar más (${totalTickets - tickets.length} restantes)`}
              </button>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="col-sticky-1">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {puedeBorrarVarios && (
                          <input type="checkbox" aria-label="Seleccionar todos los tickets visibles"
                            checked={filtrados.filter(borrableEnLote).length > 0 && filtrados.filter(borrableEnLote).every(t => seleccion.has(t.id))}
                            onChange={e => setSeleccion(e.target.checked ? new Set(filtrados.filter(borrableEnLote).map(t => t.id)) : new Set())} />
                        )}
                        Ticket
                      </div>
                    </th>
                    <th className="col-sticky-2">
                      <div className="th-filtro">
                        <span>Empresa</span>
                        <button
                          type="button"
                          className="th-filtro-btn"
                          title="Filtrar por empresa"
                          ref={botonEmpresaRef}
                          onClick={abrirFiltroEmpresa}
                        >
                          🔽{empresaFiltro.length > 0 ? ` (${empresaFiltro.length})` : ''}
                        </button>
                      </div>
                      {filtroEmpresaAbierto && posFiltroEmpresa && createPortal(
                        <div className="th-filtro-panel th-filtro-flotante" ref={panelEmpresaRef}
                          style={{ position: 'fixed', top: posFiltroEmpresa.top, left: posFiltroEmpresa.left }}
                          onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <button type="button" className="th-filtro-accion" style={{ color: 'var(--naranja)', fontWeight: 600 }}
                              onClick={() => setEmpresaFiltro([])}>Limpiar</button>
                            <button type="button" className="th-filtro-accion" onClick={() => setFiltroEmpresaAbierto(false)}>Cerrar</button>
                          </div>
                          <input className="form-input" placeholder="Buscar empresa…" value={buscaEmpresa} autoFocus
                            onChange={e => setBuscaEmpresa(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: '0.8rem', marginBottom: 6 }} />
                          {empresasLista.length === 0 && (
                            <div style={{ color: '#9ca3af', padding: '4px 6px' }}>Sin empresas</div>
                          )}
                          {empresasLista.map(emp => (
                            <label key={emp} className="th-filtro-item">
                              <input
                                type="checkbox"
                                checked={empresaFiltro.includes(emp)}
                                onChange={() => toggleEmpresaFiltro(emp)}
                              />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp}</span>
                            </label>
                          ))}
                        </div>,
                        document.body,
                      )}
                    </th>
                    <th className="col-sticky-3">Fecha</th>
                    <th className="col-sticky-4">Estatus</th>
                    <th>Chat</th>
                    <th>Tipo Unidad</th>
                    <th>Unidad</th><th>Lugar</th><th>Técnico</th><th>Reparación</th>
                    {rol === 'admin' && <><th>Sal.C</th><th>M.O.C</th><th>Ref.C</th></>}
                    <th>Costo</th><th>Ganancia</th><th>Total</th><th>IVA</th>
                    {rol === 'admin' && <><th>Neto</th><th>ISR</th><th>Total F</th></>}
                    <th>Factura</th><th>F.Fact.</th><th>Est.Fact.</th>
                    <th>Operador</th><th>Coordinador</th>
                    {rol === 'admin' && <th>Comisión</th>}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 && (
                    <tr><td colSpan={rol === 'admin' ? 27 : 20} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No hay tickets</td></tr>
                  )}
                  {filtrados.map(t => (
                    <tr key={t.id} style={{ opacity: t.estatus === 'terminado' ? 0.8 : 1, background: seleccion.has(t.id) ? '#fff7ed' : undefined }}>
                      <td className="col-sticky-1">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {puedeBorrarVarios && (
                            borrableEnLote(t)
                              ? <input type="checkbox" aria-label={`Seleccionar ${t.etiqueta || t.ticket_id}`}
                                  checked={seleccion.has(t.id)} onChange={() => alternarSeleccion(t.id)} />
                              : <span style={{ width: 13, display: 'inline-block' }} aria-hidden="true" />
                          )}
                          {t.puede_editar && (t.estatus !== 'terminado' || t.puede_editar_coordinador || rol === 'admin') ? (
                            <button className="btn btn-sm btn-ghost" title="Editar" aria-label={`Editar ${t.etiqueta || t.ticket_id}`}
                              style={{ padding: '2px 6px' }} onClick={() => openModal('editar', t)}>✏️</button>
                          ) : (
                            <span style={{ width: 30, display: 'inline-block' }} aria-hidden="true" />
                          )}
                          <span className="td-link" role="button" tabIndex={0} title="Ver detalle"
                            onClick={() => openModal('detalle', t)}
                            onKeyDown={e => e.key === 'Enter' && openModal('detalle', t)}>{t.etiqueta || t.ticket_id}</span>
                        </div>
                      </td>
                      <td className="col-sticky-2">
                        {t.empresa}
                        {t.cliente_nombre && (
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {t.cliente_nombre}</div>
                        )}
                      </td>
                      <td className="col-sticky-3">{t.fecha}</td>
                      <td className="col-sticky-4">
                        <span className={`badge badge-${t.estatus}`}>{t.estatus_display || t.estatus}</span>
                        {t.estatus === 'terminado' && <span title="Cerrado" style={{ marginLeft: 4 }}>🔒</span>}
                      </td>
                      <td><BotonChat ticket={t} compacto onClick={() => setTicketChat(t)} /></td>
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
                      <td>{t.operador || '—'}</td>
                      <td>{t.coordinador_nombre || '—'}</td>
                      {rol === 'admin' && <td className="td-naranja">{fmt(t.comision)}</td>}
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(rol === 'admin' || (rol === 'coordinador' && t.coordinador === user?.id)) && (
                            <button className="btn btn-sm btn-ghost" title="Eliminar" style={{ color: '#dc2626' }}
                              onClick={() => openModal('eliminar', t)}>🗑️</button>
                          )}
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
          empresasList={empresas}
          tecnicosList={tecnicos}
          onClose={closeModal}
          onSaved={fetchAll}
          rol={rol}
        />
      )}
      {confirmarPapelera && (
        <div className="modal-overlay" onClick={() => !moviendo && setConfirmarPapelera(null)}>
          <div className="modal" style={{ maxWidth: 440, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🗑️</div>
            <h3 className="modal-title">
              ¿Mandar {confirmarPapelera.cantidad} {confirmarPapelera.cantidad === 1 ? 'ticket' : 'tickets'} a la papelera?
            </h3>
            <p style={{ color: '#6b7280', margin: '0.5rem 0 1.25rem', fontSize: '0.875rem' }}>
              {confirmarPapelera.todos
                ? 'Se mandarán TODOS los tickets que coinciden con los filtros actuales (estatus, fechas, búsqueda y empresa), incluidos los que aún no se han cargado en pantalla.'
                : 'Se mandarán los tickets que seleccionaste.'}
              {rol === 'coordinador' && ' Solo se moverán los que tienes asignados.'}
              <br />No se borran: podrás restaurarlos desde la pestaña <strong>Papelera</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-ghost" disabled={moviendo} onClick={() => setConfirmarPapelera(null)}>Cancelar</button>
              <button className="btn btn-danger" disabled={moviendo} onClick={mandarAPapelera}>
                {moviendo ? 'Moviendo...' : 'Sí, mandar a la papelera'}
              </button>
            </div>
          </div>
        </div>
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
      {ticketChat && (
        <ChatTicketModal
          ticket={ticketChat}
          onClose={() => setTicketChat(null)}
          onRead={fetchAll}
        />
      )}
    </div>
  )
}
