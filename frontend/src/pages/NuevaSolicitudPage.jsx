import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import CamionTitulo from '../components/CamionTitulo'
import { EncabezadoPagina } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

// Módulo del Coordinador / Administrador: registrar una solicitud a nombre de un cliente.
// Si el cliente no existe, se da de alta en ese momento con usuario y contraseña automáticos.

const CLIENTE_VACIO = { nombre: '', apellido_paterno: '', apellido_materno: '', telefono: '', empresa: '', email: '' }
const SERVICIO_VACIO = { tipo_unidad: '', unidad: '', operador: '', lugar: '', problema: '' }

const ESTILOS = `
  .ns-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; }
  .ns-grid .ancho { grid-column: 1 / -1; }
  .ns-modo { display: flex; width: 100%; max-width: 420px; background: #f3f4f6; border-radius: 999px; padding: 4px; gap: 4px; margin-bottom: 1rem; box-sizing: border-box; }
  .ns-modo button { border: 0; border-radius: 999px; padding: 9px 10px; flex: 1 1 0; white-space: nowrap; font-size: 0.88rem; cursor: pointer; background: transparent; color: #4b5563; font-weight: 600; }
  .ns-modo button.activo { background: #111827; color: white; }
  .ns-lista { max-height: 260px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 8px; }
  .ns-cliente { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 10px 12px; border: 0;
    border-bottom: 1px solid #f3f4f6; background: white; cursor: pointer; }
  .ns-cliente:hover { background: #fff7ed; }
  .ns-cliente.activo { background: #ffedd5; box-shadow: inset 3px 0 0 var(--naranja); }
  .ns-cred { background: #111827; color: white; border-radius: 14px; padding: 1.25rem; margin-top: 1rem; }
  .ns-cred-dato { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: rgba(255,255,255,0.08);
    border-radius: 10px; padding: 10px 14px; margin-top: 8px; font-size: 1.05rem; }
  .ns-cred-dato code { font-size: 1.2rem; font-weight: 700; color: #fdba74; letter-spacing: 1px; word-break: break-all; }
  html[data-tema="oscuro"] .ns-modo { background: #1f2937; }
  html[data-tema="oscuro"] .ns-cliente { background: #111827; border-color: #1f2937; color: #e5e7eb; }
  html[data-tema="oscuro"] .ns-cliente:hover { background: #1f2937; }
  html[data-tema="oscuro"] .ns-lista { border-color: #334155; }
  @media (max-width: 640px) { .ns-grid { grid-template-columns: 1fr; } }
`

function copiar(texto) {
  try {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(texto)
  } catch { /* sigue con el respaldo */ }
  const t = document.createElement('textarea')
  t.value = texto; document.body.appendChild(t); t.select()
  try { document.execCommand('copy') } catch { /* nada */ }
  t.remove()
  return Promise.resolve()
}

export default function NuevaSolicitudPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [modo, setModo] = useState('nuevo')            // 'nuevo' | 'existente'
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [clienteId, setClienteId] = useState(null)
  const [cliente, setCliente] = useState(CLIENTE_VACIO)
  const [servicio, setServicio] = useState(SERVICIO_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    api.get('/usuarios/clientes/').then(({ data }) => setClientes(data)).catch(() => {})
  }, [resultado])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return clientes.filter(c => !q || `${c.nombre_completo} ${c.empresa}`.toLowerCase().includes(q)).slice(0, 50)
  }, [clientes, busca])

  // Aviso si el cliente "nuevo" ya existe (por correo o teléfono) → se usará el existente
  const parecido = useMemo(() => {
    if (modo !== 'nuevo') return null
    const tel = cliente.telefono.replace(/\D/g, '').slice(-10)
    const nombre = cliente.nombre.trim().toLowerCase()
    if (tel.length < 8 && !nombre) return null
    return clientes.find(c => nombre.length > 2 && c.nombre_completo.toLowerCase().startsWith(nombre)) || null
  }, [modo, cliente, clientes])

  const setC = (k, v) => setCliente(c => ({ ...c, [k]: v }))
  const setS = (k, v) => setServicio(s => ({ ...s, [k]: v }))

  const enviar = async e => {
    e.preventDefault()
    setError('')
    if (modo === 'existente' && !clienteId) { setError('Elige un cliente de la lista.'); return }
    setEnviando(true)
    try {
      const cuerpo = modo === 'existente' ? { cliente_id: clienteId, servicio } : { cliente, servicio }
      const { data } = await api.post('/coordinador/nueva-solicitud/', cuerpo)
      setResultado(data)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo registrar la solicitud.')
    } finally { setEnviando(false) }
  }

  const otra = () => {
    setResultado(null); setCliente(CLIENTE_VACIO); setServicio(SERVICIO_VACIO); setClienteId(null); setBusca(''); setCopiado(false)
  }

  const textoCredenciales = resultado?.credenciales
    ? `Hola ${resultado.cliente.nombre_completo}, tu servicio ${resultado.ticket.etiqueta} quedó registrado en TallerDiesel.\n`
      + `Entra en ${window.location.origin}/login para seguirlo:\nUsuario: ${resultado.credenciales.usuario}\nContraseña: ${resultado.credenciales.password}`
    : ''
  const whatsapp = resultado?.cliente?.telefono
    ? `https://wa.me/${(() => { const d = resultado.cliente.telefono.replace(/\D/g, ''); return d.length === 10 ? '52' + d : d })()}?text=${encodeURIComponent(textoCredenciales)}`
    : null
  const rutaBitacora = user?.rol === 'admin' ? '/admin/bitacora' : '/coordinador/bitacora'

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <style>{ESTILOS}</style>
        <EncabezadoPagina titulo="➕ Nueva solicitud"
          subtitulo="Registra un servicio a nombre de un cliente. Si no existe, se da de alta solo con usuario y contraseña."
          decoracion={<CamionTitulo />} />

        {resultado ? (
          <div className="card" style={{ maxWidth: 640 }}>
            <h2 className="card-title">✅ Solicitud {resultado.ticket.etiqueta} registrada</h2>
            <p style={{ color: '#6b7280', marginTop: 6 }}>
              Cliente: <strong>{resultado.cliente.nombre_completo}</strong>
              {resultado.cliente.empresa ? ` · ${resultado.cliente.empresa}` : ''}
              {resultado.cliente_nuevo ? ' · ' : ' · cliente que ya existía'}
              {resultado.cliente_nuevo && <span className="badge badge-cliente">Cliente nuevo</span>}
            </p>

            {resultado.credenciales && (
              <div className="ns-cred">
                <div style={{ fontWeight: 700 }}>🔑 Datos de acceso del cliente</div>
                <div style={{ fontSize: '0.8rem', color: '#fdba74', marginTop: 2 }}>
                  Dáselos ahora: por seguridad la contraseña no se vuelve a mostrar
                  {resultado.correo_enviado ? ' (también se le enviaron por correo).' : '.'}
                </div>
                <div className="ns-cred-dato"><span>Usuario</span><code>{resultado.credenciales.usuario}</code></div>
                <div className="ns-cred-dato"><span>Contraseña</span><code>{resultado.credenciales.password}</code></div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button type="button" className="btn btn-primary" onClick={() => copiar(textoCredenciales).then(() => setCopiado(true))}>
                    {copiado ? '✓ Copiado' : '📋 Copiar datos'}
                  </button>
                  {whatsapp && (
                    <a className="btn" href={whatsapp} target="_blank" rel="noreferrer" style={{ background: '#059669', color: 'white', textDecoration: 'none' }}>
                      💬 Enviar por WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: '1.25rem' }}>
              <button className="btn btn-ghost" onClick={() => navigate(rutaBitacora)}>☰ Ver en la Bitácora</button>
              <button className="btn btn-primary" onClick={otra}>➕ Registrar otra solicitud</button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 820 }}>
            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>1. Cliente</h2>
              <div className="ns-modo" role="tablist">
                <button type="button" role="tab" aria-selected={modo === 'nuevo'} className={modo === 'nuevo' ? 'activo' : ''}
                  onClick={() => { setModo('nuevo'); setClienteId(null) }}>🆕 Cliente nuevo</button>
                <button type="button" role="tab" aria-selected={modo === 'existente'} className={modo === 'existente' ? 'activo' : ''}
                  onClick={() => setModo('existente')}>👤 Ya está registrado</button>
              </div>

              {modo === 'existente' ? (
                <>
                  <input className="form-input" placeholder="Buscar por nombre o empresa…" value={busca}
                    onChange={e => setBusca(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                  <div className="ns-lista">
                    {filtrados.length === 0 && <div style={{ padding: 12, color: '#9ca3af' }}>No hay clientes con ese nombre.</div>}
                    {filtrados.map(c => (
                      <button type="button" key={c.id} className={`ns-cliente ${clienteId === c.id ? 'activo' : ''}`}
                        onClick={() => setClienteId(c.id)}>
                        <span style={{ fontSize: '1.2rem' }}>{clienteId === c.id ? '✅' : '👤'}</span>
                        <span><strong>{c.nombre_completo}</strong><br /><small style={{ color: '#6b7280' }}>{c.empresa || 'Sin empresa'}</small></span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="ns-grid">
                    <label className="form-group"><span className="form-label">Nombre *</span>
                      <input className="form-input" required value={cliente.nombre} onChange={e => setC('nombre', e.target.value)} autoComplete="off" /></label>
                    <label className="form-group"><span className="form-label">Apellido paterno</span>
                      <input className="form-input" value={cliente.apellido_paterno} onChange={e => setC('apellido_paterno', e.target.value)} autoComplete="off" /></label>
                    <label className="form-group"><span className="form-label">Apellido materno</span>
                      <input className="form-input" value={cliente.apellido_materno} onChange={e => setC('apellido_materno', e.target.value)} autoComplete="off" /></label>
                    <label className="form-group"><span className="form-label">Teléfono *</span>
                      <input className="form-input" required type="tel" inputMode="tel" value={cliente.telefono} onChange={e => setC('telefono', e.target.value)} autoComplete="off" /></label>
                    <label className="form-group"><span className="form-label">Empresa</span>
                      <input className="form-input" value={cliente.empresa} onChange={e => setC('empresa', e.target.value)} autoComplete="off" /></label>
                    <label className="form-group"><span className="form-label">Correo (opcional)</span>
                      <input className="form-input" type="email" inputMode="email" value={cliente.email} onChange={e => setC('email', e.target.value)} autoComplete="off" /></label>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '10px 0 0' }}>
                    Si el teléfono o el correo ya pertenecen a un cliente, se usa ese cliente (no se duplica).
                    Si es nuevo, el sistema le crea su <strong>usuario y contraseña</strong> automáticamente.
                  </p>
                  {parecido && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '0.82rem' }}>
                      ¿Es <strong>{parecido.nombre_completo}</strong>{parecido.empresa ? ` (${parecido.empresa})` : ''}?{' '}
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setModo('existente'); setClienteId(parecido.id); setBusca(parecido.nombre_completo) }}>
                        Usar ese cliente
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>2. Servicio</h2>
              <div className="ns-grid">
                <label className="form-group"><span className="form-label">Tipo de unidad</span>
                  <input className="form-input" placeholder="Tractocamión, caja seca…" value={servicio.tipo_unidad} onChange={e => setS('tipo_unidad', e.target.value)} /></label>
                <label className="form-group"><span className="form-label">Unidad</span>
                  <input className="form-input" placeholder="Kenworth T680" value={servicio.unidad} onChange={e => setS('unidad', e.target.value)} /></label>
                <label className="form-group"><span className="form-label">Operador</span>
                  <input className="form-input" placeholder="Nombre del operador" value={servicio.operador} onChange={e => setS('operador', e.target.value)} /></label>
                <label className="form-group"><span className="form-label">Lugar</span>
                  <input className="form-input" placeholder="Carretera / ciudad, estado" value={servicio.lugar} onChange={e => setS('lugar', e.target.value)} /></label>
                <label className="form-group ancho"><span className="form-label">Problema / descripción *</span>
                  <textarea className="form-input" rows={3} required value={servicio.problema} onChange={e => setS('problema', e.target.value)}
                    placeholder="¿Qué le pasa a la unidad?" style={{ resize: 'vertical' }} /></label>
              </div>
            </section>

            {error && <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: 8 }}>{error}</div>}
            <div>
              <button className="btn btn-primary" type="submit" disabled={enviando} style={{ padding: '12px 24px', fontSize: '1rem' }}>
                {enviando ? 'Registrando…' : '✅ Registrar solicitud'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
