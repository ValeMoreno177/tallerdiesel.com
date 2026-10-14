// Modo claro / oscuro. Se guarda en este navegador (es una preferencia personal de quien lo usa).
const CLAVE = 'td_tema'

export function temaActual() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'oscuro' || guardado === 'claro') return guardado
  } catch { /* modo privado */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema)
  try { localStorage.setItem(CLAVE, tema) } catch { /* modo privado */ }
}

export function aplicarTemaGuardado() {
  let tema = 'claro'
  try { tema = localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro' } catch { /* modo privado */ }
  document.documentElement.setAttribute('data-tema', tema)
}
