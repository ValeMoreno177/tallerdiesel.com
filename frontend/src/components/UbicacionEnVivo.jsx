import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, useMap } from 'react-leaflet'
import api from '../api/client'

// ── Ubicación del cliente EN TIEMPO REAL ──────────────────────────────────────
// Cliente: <BotonUbicacionEnVivo ticket={t} />  → comparte su GPS mientras tenga la página abierta.
// Coordinador / Admin: <MapaUbicacionCliente ticket={t} /> → la ve moverse en un mapa.

const ENVIO_MINIMO_MS = 10 * 1000      // como máximo un envío cada 10 s
const MOVIMIENTO_MINIMO_M = 25         // o antes, si se movió más de 25 m

function distanciaM(a, b) {
  const R = 6371000, rad = x => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function haceCuanto(fecha) {
  if (!fecha) return ''
  const s = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000))
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  return new Date(fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function BotonUbicacionEnVivo({ ticket, onCambio }) {
  const [activo, setActivo] = useState(false)
  const [error, setError] = useState('')
  const [ultimoEnvio, setUltimoEnvio] = useState(null)
  const vigilante = useRef(null)
  const ultimo = useRef({ t: 0, pos: null })
  const [, setTic] = useState(0)

  const detener = async (avisar = true) => {
    if (vigilante.current != null) navigator.geolocation?.clearWatch(vigilante.current)
    vigilante.current = null
    setActivo(false)
    if (avisar) {
      try { await api.post(`/tickets/${ticket.id}/ubicacion/`, { detener: true }); onCambio?.() } catch { /* nada */ }
    }
  }

  const iniciar = () => {
    setError('')
    if (!navigator.geolocation) { setError('Tu navegador no permite compartir la ubicación.'); return }
    vigilante.current = navigator.geolocation.watchPosition(async pos => {
      const actual = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      const ahora = Date.now()
      const movido = ultimo.current.pos ? distanciaM(ultimo.current.pos, actual) : Infinity
      if (ahora - ultimo.current.t < ENVIO_MINIMO_MS && movido < MOVIMIENTO_MINIMO_M) return
      ultimo.current = { t: ahora, pos: actual }
      try {
        await api.post(`/tickets/${ticket.id}/ubicacion/`, { ...actual, precision: pos.coords.accuracy })
        setUltimoEnvio(new Date())
        setActivo(true)
        onCambio?.()
      } catch (e) {
        setError(e?.response?.data?.error || 'No se pudo enviar tu ubicación.')
      }
    }, err => {
      setError(err.code === 1 ? 'Activa el permiso de ubicación en tu navegador.' : 'No se pudo obtener tu ubicación.')
      detener(false)
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })
    setActivo(true)
  }

  // El "hace X s" se actualiza solo
  useEffect(() => {
    if (!activo) return undefined
    const id = setInterval(() => setTic(x => x + 1), 5000)
    return () => clearInterval(id)
  }, [activo])
  // Al salir de la página se deja de vigilar el GPS (el servidor la conserva como "última ubicación")
  useEffect(() => () => { if (vigilante.current != null) navigator.geolocation?.clearWatch(vigilante.current) }, [])

  if (ticket.estatus === 'terminado') return null
  return (
    <div className="ubi-vivo">
      <style>{`
        .ubi-vivo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ubi-punto { width: 10px; height: 10px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 0 rgba(22,163,74,0.6); animation: ubiLatido 1.6s infinite; }
        @keyframes ubiLatido { 70% { box-shadow: 0 0 0 10px rgba(22,163,74,0); } 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); } }
        @media (prefers-reduced-motion: reduce) { .ubi-punto { animation: none; } }
      `}</style>
      {activo ? (
        <>
          <span className="ubi-punto" aria-hidden="true" />
          <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
            Compartiendo tu ubicación en tiempo real{ultimoEnvio ? ` · ${haceCuanto(ultimoEnvio)}` : '…'}
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => detener(true)}>⏹ Dejar de compartir</button>
        </>
      ) : (
        <button type="button" className="btn btn-sm btn-ghost" onClick={iniciar}
          title="Tu coordinador verá en un mapa dónde estás, mientras tengas esta página abierta">
          📍 Compartir mi ubicación en tiempo real
        </button>
      )}
      {error && <span role="alert" style={{ fontSize: '0.78rem', color: '#b91c1c' }}>{error}</span>}
    </div>
  )
}

function Recentrar({ pos }) {
  const map = useMap()
  useEffect(() => { map.setView(pos, Math.max(map.getZoom(), 14), { animate: true }) }, [pos[0], pos[1]])  // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export function MapaUbicacionCliente({ ticket }) {
  const [, setTic] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTic(x => x + 1), 5000)
    return () => clearInterval(id)
  }, [])
  if (ticket.ubicacion_lat == null || ticket.ubicacion_lng == null) return null
  const pos = [ticket.ubicacion_lat, ticket.ubicacion_lng]
  const enVivo = ticket.ubicacion_compartiendo && ticket.estatus !== 'terminado'
    && Date.now() - new Date(ticket.ubicacion_actualizada).getTime() < 2 * 60 * 1000
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
        📍 Ubicación del cliente
        <span style={{ fontSize: '0.7rem', letterSpacing: 0, textTransform: 'none', padding: '2px 8px', borderRadius: 999,
          background: enVivo ? '#dcfce7' : '#f3f4f6', color: enVivo ? '#166534' : '#6b7280' }}>
          {enVivo ? '● En vivo' : 'Última conocida'} · {haceCuanto(ticket.ubicacion_actualizada)}
        </span>
      </h4>
      <div style={{ height: 220, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <MapContainer center={pos} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          <Recentrar pos={pos} />
          {ticket.ubicacion_precision ? (
            <Circle center={pos} radius={ticket.ubicacion_precision} pathOptions={{ color: '#e85d04', weight: 1, fillOpacity: 0.1 }} />
          ) : null}
          <CircleMarker center={pos} radius={9} pathOptions={{ color: 'white', weight: 3, fillColor: enVivo ? '#16a34a' : '#e85d04', fillOpacity: 1 }} />
        </MapContainer>
      </div>
      <a href={`https://maps.google.com/?q=${pos[0]},${pos[1]}`} target="_blank" rel="noreferrer"
        style={{ fontSize: '0.8rem', color: 'var(--naranja)', fontWeight: 600, display: 'inline-block', marginTop: 6 }}>
        🧭 Abrir en Google Maps / Cómo llegar
      </a>
    </div>
  )
}
