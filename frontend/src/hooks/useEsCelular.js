import { useEffect, useState } from 'react'

// true cuando la pantalla es de celular (por defecto, 768 px o menos). Se actualiza al girar o
// cambiar el tamaño de la ventana.
export default function useEsCelular(maxAncho = 768) {
  const consulta = `(max-width: ${maxAncho}px)`
  const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(consulta)
    if (!mq) return undefined
    const alCambiar = e => setEs(e.matches)
    mq.addEventListener?.('change', alCambiar)
    setEs(mq.matches)
    return () => mq.removeEventListener?.('change', alCambiar)
  }, [consulta])
  return es
}
