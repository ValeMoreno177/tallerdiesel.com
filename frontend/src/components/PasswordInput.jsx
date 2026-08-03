import { useState } from 'react'

/**
 * Input de contraseña con botón de mostrar/ocultar (ojito).
 * Acepta las mismas props que un <input>, además de className/style opcionales.
 */
export default function PasswordInput({ className = 'form-input', style = {}, ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ ...style, width: '100%', paddingRight: 40, boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          fontSize: '1rem', lineHeight: 1, color: '#6b7280', userSelect: 'none',
        }}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
