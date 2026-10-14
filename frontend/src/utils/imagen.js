// Prepara una foto de perfil en el navegador: la recorta al centro en cuadrado y la reduce a
// lado×lado px (JPEG). Así pesa ~30 KB, se ve igual de bien en un círculo y no necesitamos
// procesar imágenes en el servidor.

export const EXTENSIONES_FOTO = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_FOTO_ORIGINAL_MB = 15

export async function prepararFotoPerfil(archivo, lado = 256) {
  if (!archivo || !archivo.type.startsWith('image/')) {
    throw new Error('Elige un archivo de imagen (JPG, PNG o WEBP).')
  }
  if (archivo.size > MAX_FOTO_ORIGINAL_MB * 1024 * 1024) {
    throw new Error(`La imagen pesa más de ${MAX_FOTO_ORIGINAL_MB} MB. Elige una más pequeña.`)
  }

  let img
  try {
    img = await cargarImagen(archivo)
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con una foto JPG o PNG.')
  }

  const origen = Math.min(img.width, img.height)           // cuadrado centrado
  const sx = (img.width - origen) / 2
  const sy = (img.height - origen) / 2
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'                                  // los PNG con transparencia se ven sobre blanco
  ctx.fillRect(0, 0, lado, lado)
  ctx.drawImage(img, sx, sy, origen, origen, 0, 0, lado, lado)
  if (img.close) img.close()

  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85))
  if (!blob) throw new Error('No se pudo procesar la imagen.')
  return blob
}

function cargarImagen(archivo) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(archivo)
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen')) }
    img.src = url
  })
}

// Reduce una foto (p. ej. tomada con la cámara del celular) antes de subirla como evidencia del
// chat: lado mayor de máximo `ladoMax` px, en JPEG. Los PDF y archivos que no son imagen se regresan
// tal cual. Si algo falla al procesarla, se sube la original para no bloquear al usuario.
export async function comprimirEvidencia(archivo, ladoMax = 1600, calidad = 0.82) {
  if (!archivo || !archivo.type || !archivo.type.startsWith('image/')) return archivo
  try {
    const img = await cargarImagen(archivo)
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height))
    const ancho = Math.round(img.width * escala)
    const alto = Math.round(img.height * escala)
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'                                // PNG con transparencia sobre blanco
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(img, 0, 0, ancho, alto)
    if (img.close) img.close()

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', calidad))
    if (!blob || blob.size >= archivo.size) return archivo     // no vale la pena: se queda la original
    const base = (archivo.name || 'foto').replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return archivo
  }
}
