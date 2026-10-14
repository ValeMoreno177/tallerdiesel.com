// Piezas de interfaz reutilizables. Antes cada pantalla repetía los mismos estilos escritos a mano;
// aquí viven en un solo lugar, así un cambio de diseño se hace una vez y se ve igual en todo el sistema.

const ESTILOS = `
  .ui-pildora { display: inline-flex; align-items: center; gap: 5px; border: none; border-radius: 999px;
    padding: 5px 12px; font-size: 0.78rem; font-weight: 500; cursor: pointer; text-decoration: none;
    color: white !important; transition: transform 0.15s, filter 0.15s; line-height: 1.4; }
  .ui-pildora:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .ui-pildora.marino { background: #111827; }
  .ui-pildora.verde { background: #059669; }
  .ui-pildora.naranja { background: var(--naranja, #e85d04); }
  .ui-pildora.gris { background: #6b7280; }
  .ui-pildora.azul { background: #1e40af; }
  .ui-pildora.borde-rojo { background: transparent; color: #dc2626 !important; border: 1px solid #dc2626; }
  .ui-encabezado { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .ui-encabezado-acciones { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
`

/** Botón redondeado tipo "píldora". Si recibe `href`, es un enlace con forma de botón. */
export function BotonPildora({ color = 'marino', href, children, ...resto }) {
  const clase = `ui-pildora ${color}`
  return (
    <>
      <style>{ESTILOS}</style>
      {href
        ? <a className={clase} href={href} target="_blank" rel="noreferrer" {...resto}>{children}</a>
        : <button type="button" className={clase} {...resto}>{children}</button>}
    </>
  )
}

/** Encabezado de página: título, subtítulo, decoración opcional y acciones a la derecha. */
export function EncabezadoPagina({ titulo, subtitulo, decoracion, children }) {
  return (
    <div className="ui-encabezado">
      <style>{ESTILOS}</style>
      <div>
        <h1 className="page-title">{titulo}</h1>
        {subtitulo && <p className="page-subtitle">{subtitulo}</p>}
        {decoracion}
      </div>
      {children && <div className="ui-encabezado-acciones">{children}</div>}
    </div>
  )
}
