/**
 * Campo "Usuario" que solo aparece cuando el correo escrito lo comparten varias cuentas
 * (el Administrador puede dar de alta varios coordinadores con el mismo correo).
 * Sirve para decir de cuál cuenta se trata.
 */
export default function CampoUsuarioCompartido({ value, onChange }) {
  return (
    <div className="form-group">
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '8px 12px', borderRadius: 8, marginBottom: 8, fontSize: '0.8rem' }}>
        Este correo lo comparten varias cuentas. Escribe tu nombre de usuario para saber de cuál se trata.
      </div>
      <label className="form-label">Usuario</label>
      <input className="form-input" type="text" autoComplete="username" placeholder="tu usuario"
        value={value} onChange={e => onChange(e.target.value)} required autoFocus />
    </div>
  )
}