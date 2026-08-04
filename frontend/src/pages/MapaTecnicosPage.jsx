import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { crearIconoTecnico, CATEGORIA_LEYENDA, CATEGORIA_ICONO, CATEGORIA_COLOR } from "../utils/tecnicoIcons";
import { API_BASE_URL } from "../api/baseURL";

// axios público sin interceptor de auth — para endpoints públicos como /tecnicos/
const publicApi = axios.create({ baseURL: API_BASE_URL });

const CATEGORIAS = [
  { value: "", label: "Categoría" },
  { value: "motor_diesel", label: "Motor diesel" },
  { value: "electrico", label: "Eléctrico" },
  { value: "frenos_suspension", label: "Frenos y suspensión" },
  { value: "transmision", label: "Transmisión" },
  { value: "hidraulico", label: "Sistema hidráulico" },
  { value: "aire", label: "Sistema de aire" },
  { value: "mecanica", label: "Mecánica general" },
  { value: "soldadura", label: "Soldadura" },
];

export default function MapaTecnicosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const enviado = localStorage.getItem("td_form_tecnico_enviado") === "true";

  if (user?.rol === "cliente" && !enviado) {
    return <Navigate to="/solicitar-tecnico" replace />;
  }

  const [tecnicos, setTecnicos] = useState([]);
  const [busqueda, setBusqueda] = useState({ ciudad: "", categoria: "" });
  const [loading, setLoading] = useState(true);
  const [mapaListo, setMapaListo] = useState(false);
  const [tecnicoElegido, setTecnicoElegido] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("td_tecnico_elegido") || "null");
    } catch {
      return null;
    }
  });
  const [confirmando, setConfirmando] = useState(null);

  // ── Panel de administración de técnicos (solo admin/coordinador) ──
  const puedeAdministrar = user?.rol === "admin" || user?.rol === "coordinador";
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [modoImport, setModoImport] = useState("agregar");
  const [archivoExcel, setArchivoExcel] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);

  const descargarPlantilla = async () => {
    try {
      const res = await api.get("/tecnicos/plantilla_excel/", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "plantilla_tecnicos.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { console.error("Error descargando plantilla:", e); }
  };

  const subirExcel = async () => {
    if (!archivoExcel) return;
    setSubiendo(true); setResultadoImport(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoExcel);
      formData.append("modo", modoImport);
      const { data } = await api.post("/tecnicos/importar_excel/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResultadoImport(data);
      setArchivoExcel(null);
      fetchTecnicos(busqueda);
    } catch (e) {
      setResultadoImport({ error: e?.response?.data?.error || "No se pudo importar el archivo." });
    } finally { setSubiendo(false); }
  };

  const eliminarTecnico = async (t) => {
    if (!window.confirm(`¿Eliminar a ${t.nombre} del mapa?`)) return;
    try {
      await api.delete(`/tecnicos/${t.id}/`);
      setTecnicos(prev => prev.filter(x => x.id !== t.id));
    } catch (e) {
      alert("No se pudo eliminar. " + (e?.response?.data?.error || ""));
    }
  };

  // Inicializar iconos Leaflet en useEffect (no a nivel módulo)
  useEffect(() => {
    try {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
    } catch (e) {
      console.warn("Leaflet init:", e);
    }
    setMapaListo(true);
  }, []);

  const fetchTecnicos = (params = {}) => {
    setLoading(true);
    const q = new URLSearchParams();
    if (params.ciudad) q.set("ciudad", params.ciudad);
    if (params.categoria) q.set("categoria", params.categoria);
    // Usar publicApi para no disparar el interceptor de auth
    publicApi
      .get(`/tecnicos/?${q}`)
      .then(({ data }) => setTecnicos(data.results || data))
      .catch((e) => console.error("Error cargando técnicos:", e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTecnicos();
  }, []);

  const elegirTecnico = (t) => {
    if (user?.rol !== "cliente") return;
    localStorage.setItem("td_tecnico_elegido", JSON.stringify(t));
    localStorage.setItem("td_form_tecnico_enviado", "true");
    setTecnicoElegido(t);
    setConfirmando(t);
    setTimeout(() => setConfirmando(null), 3000);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main
        className="main-content-fluid"
        style={{
          background:
            "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600&q=80) center/cover no-repeat",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "2.5rem 3rem",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1
            style={{
              fontFamily: "Bebas Neue",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              color: "white",
              letterSpacing: 2,
              margin: 0,
            }}
          >
            ENCUENTRA A TU TÉCNICO MÁS CERCANO
          </h1>
          <p style={{ color: "#4ade80", fontSize: "0.85rem", marginTop: 6 }}>
            📍 Da clic en WhatsApp para seleccionar tu técnico
          </p>
        </div>

        {tecnicoElegido && (
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              background: "rgba(5,150,105,0.9)",
              borderRadius: 10,
              padding: "10px 16px",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "white", fontSize: "0.9rem" }}>
              ✅ Técnico seleccionado: <strong>{tecnicoElegido.nombre}</strong>{" "}
              — {tecnicoElegido.ciudad}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => navigate("/cliente/dashboard")}
                style={{
                  background: "white",
                  color: "#059669",
                  border: "none",
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Ver en Inicio
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("td_tecnico_elegido");
                  setTecnicoElegido(null);
                }}
                style={{
                  background: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                Cambiar
              </button>
            </div>
          </div>
        )}

        {confirmando && (
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              background: "#fef3c7",
              borderRadius: 10,
              padding: "10px 16px",
              marginBottom: "0.5rem",
              color: "#92400e",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            🎉 ¡{confirmando.nombre} agregado a tu inicio!
          </div>
        )}

        {/* Panel de administración de técnicos — solo admin/coordinador */}
        {puedeAdministrar && (
          <div style={{ width: "100%", maxWidth: 900, marginBottom: "1rem" }}>
            <button
              onClick={() => setPanelAbierto(v => !v)}
              style={{
                background: "rgba(0,0,0,0.5)", color: "white", border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 10, padding: "8px 14px", fontSize: "0.85rem", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              📊 {panelAbierto ? "Ocultar" : "Administrar técnicos por Excel"} {panelAbierto ? "▲" : "▼"}
            </button>

            {panelAbierto && (
              <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 10, padding: "1rem", marginTop: 8 }}>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8rem", marginBottom: 10 }}>
                  Descarga la plantilla, llénala con tus técnicos y súbela. Usa <strong>"Agregar"</strong> para sumar
                  nuevos sin tocar los existentes, o <strong>"Reemplazar todos"</strong> para borrar los técnicos
                  actuales (incluyendo los de prueba) y dejar solo los del archivo.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <button onClick={descargarPlantilla} style={{
                    background: "#374151", color: "white", border: "none", borderRadius: 8,
                    padding: "8px 14px", fontSize: "0.82rem", cursor: "pointer",
                  }}>
                    ⬇️ Descargar plantilla Excel
                  </button>

                  <input type="file" accept=".xlsx"
                    onChange={e => setArchivoExcel(e.target.files?.[0] || null)}
                    style={{ color: "white", fontSize: "0.8rem", maxWidth: 220 }} />

                  <select value={modoImport} onChange={e => setModoImport(e.target.value)} style={{
                    padding: "8px 10px", borderRadius: 8, border: "none", fontSize: "0.82rem", cursor: "pointer",
                  }}>
                    <option value="agregar">Agregar a los existentes</option>
                    <option value="reemplazar">Reemplazar todos</option>
                  </select>

                  <button onClick={subirExcel} disabled={!archivoExcel || subiendo} style={{
                    background: archivoExcel ? "#059669" : "#4b5563", color: "white", border: "none", borderRadius: 8,
                    padding: "8px 14px", fontSize: "0.82rem", cursor: archivoExcel ? "pointer" : "not-allowed",
                  }}>
                    {subiendo ? "Subiendo..." : "⬆️ Subir e importar"}
                  </button>
                </div>

                {resultadoImport && (
                  <div style={{
                    background: resultadoImport.error ? "rgba(220,38,38,0.2)" : "rgba(5,150,105,0.2)",
                    border: `1px solid ${resultadoImport.error ? "#dc2626" : "#059669"}`,
                    borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem", color: "white",
                  }}>
                    {resultadoImport.error ? (
                      <span>❌ {resultadoImport.error}</span>
                    ) : (
                      <>
                        <div>✅ {resultadoImport.importados} técnico(s) importado(s). Total en el mapa: {resultadoImport.total_tecnicos}.</div>
                        {resultadoImport.errores?.length > 0 && (
                          <ul style={{ marginTop: 6, paddingLeft: 18, color: "#fca5a5" }}>
                            {resultadoImport.errores.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Buscador */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "1.25rem",
            width: "100%",
            maxWidth: 900,
          }}
        >
          <input
            placeholder="Ciudad o Estado..."
            value={busqueda.ciudad}
            onChange={(e) =>
              setBusqueda({ ...busqueda, ciudad: e.target.value })
            }
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
          <select
            value={busqueda.categoria}
            onChange={(e) =>
              setBusqueda({ ...busqueda, categoria: e.target.value })
            }
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: "0.95rem",
              background: "white",
              cursor: "pointer",
            }}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchTecnicos(busqueda)}
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Buscar
          </button>
        </div>

        {/* Leyenda de la librería de íconos por categoría */}
        <div style={{
          width: "100%", maxWidth: 900, display: "flex", flexWrap: "wrap", gap: "0.5rem",
          marginBottom: "1rem", background: "rgba(0,0,0,0.45)", borderRadius: 10, padding: "0.6rem 0.85rem",
        }}>
          {CATEGORIA_LEYENDA.map(c => (
            <span key={c.value} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 10px 3px 6px",
              fontSize: "0.72rem", color: "white",
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%", background: CATEGORIA_COLOR[c.value],
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0,
              }}>{CATEGORIA_ICONO[c.value]}</span>
              {c.label}
            </span>
          ))}
        </div>

        {/* Mapa */}
        <div
          style={{
            width: "100%",
            maxWidth: 900,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            flex: 1,
            minHeight: 420,
          }}
        >
          {mapaListo ? (
            <MapContainer
              center={[23.6345, -102.5528]}
              zoom={5}
              style={{ height: "100%", width: "100%", minHeight: 420 }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {tecnicos.map((t, i) => (
                <Marker
                  key={t.id}
                  position={[t.latitud, t.longitud]}
                  icon={crearIconoTecnico(t.categoria, t.disponible)}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong style={{ fontSize: "1rem" }}>{t.nombre}</strong>
                      <br />
                      <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                        {t.categoria_display}
                      </span>
                      <br />
                      <div style={{ marginTop: 6, fontSize: "0.85rem" }}>
                        📍 {t.ciudad}, {t.estado}
                        <br />
                        🏠 {t.direccion}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <a
                          href={`https://maps.google.com/?q=${t.latitud},${t.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <button
                            style={{
                              background: "#2563eb",
                              color: "white",
                              border: "none",
                              borderRadius: 20,
                              padding: "5px 12px",
                              fontSize: "0.78rem",
                              cursor: "pointer",
                            }}
                          >
                            🧭 Cómo llegar
                          </button>
                        </a>
                        {user?.rol === "cliente" ? (
                          <a
                            href={`https://wa.me/${t.telefono.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => elegirTecnico(t)}
                          >
                            <button
                              style={{
                                background: "#059669",
                                color: "white",
                                border: "none",
                                borderRadius: 20,
                                padding: "5px 12px",
                                fontSize: "0.78rem",
                                cursor: "pointer",
                              }}
                            >
                              {tecnicoElegido?.id === t.id
                                ? "✅ Seleccionado"
                                : "💬 WhatsApp"}
                            </button>
                          </a>
                        ) : (
                          <a
                            href={`https://wa.me/${t.telefono.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <button
                              style={{
                                background: "#059669",
                                color: "white",
                                border: "none",
                                borderRadius: 20,
                                padding: "5px 12px",
                                fontSize: "0.78rem",
                                cursor: "pointer",
                              }}
                            >
                              💬 WhatsApp
                            </button>
                          </a>
                        )}
                      </div>
                      {user?.rol === "cliente" &&
                        tecnicoElegido?.id !== t.id && (
                          <p
                            style={{
                              fontSize: "0.7rem",
                              color: "#6b7280",
                              marginTop: 6,
                              marginBottom: 0,
                            }}
                          >
                            Al dar clic en WhatsApp, este técnico se agregará a
                            tu inicio
                          </p>
                        )}
                      {puedeAdministrar && (
                        <button
                          onClick={() => eliminarTecnico(t)}
                          style={{
                            marginTop: 8, background: "transparent", color: "#dc2626",
                            border: "1px solid #dc2626", borderRadius: 20, padding: "4px 12px",
                            fontSize: "0.72rem", cursor: "pointer",
                          }}
                        >
                          🗑 Eliminar técnico
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 420,
                background: "rgba(0,0,0,0.3)",
                color: "white",
              }}
            >
              Cargando mapa...
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
