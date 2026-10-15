import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import { getMenuItems } from "../utils/menuItems";
import Avatar from "./Avatar";
import { aplicarTema } from "../utils/tema";
import { avisosDisponibles, permisoAvisos, pedirPermisoAvisos } from "../utils/avisosSistema";
import { abrirInstalarApp, useAppInstalada } from "./InstalarApp";

const LOGO = () => (
  <div
    style={{
      fontFamily: "Bebas Neue, sans-serif",
      fontSize: "1.4rem",
      letterSpacing: 2,
    }}
  >
    Taller<span style={{ color: "var(--naranja)" }}>diesel</span>

    <div
      style={{
        fontSize: "0.6rem",
        letterSpacing: 3,
        color: "#9ca3af",
        fontFamily: "Barlow",
        fontWeight: 400,
      }}
    >
      AUXILIO CARRETERO
    </div>
  </div>
);

export default function Sidebar() {
  const [tema, setTema] = useState(() => document.documentElement.getAttribute('data-tema') || 'claro');
  // Avisos del sistema (barra del celular / esquina de la computadora)
  const [permiso, setPermiso] = useState(() => permisoAvisos());
  const activarAvisos = async () => setPermiso(await pedirPermisoAvisos());
  const cambiarTema = () => {
    const nuevo = tema === 'oscuro' ? 'claro' : 'oscuro';
    aplicarTema(nuevo);
    setTema(nuevo);
  };
  const { user, logout, iniciarTour } = useAuth();
  const appInstalada = useAppInstalada();
  const navigate = useNavigate();
  const location = useLocation();

  const [tecnicoEnviado, setTecnicoEnviado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Menú de los tres puntos (⋮) junto al nombre
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(false);
  const opcionesRef = useRef(null);
  useEffect(() => {
    if (!opcionesAbiertas) return undefined;
    const fuera = e => { if (!opcionesRef.current?.contains(e.target)) setOpcionesAbiertas(false); };
    const esc = e => { if (e.key === "Escape") setOpcionesAbiertas(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [opcionesAbiertas]);
  const opcion = fn => () => { setOpcionesAbiertas(false); fn(); };

  useEffect(() => {
    setTecnicoEnviado(
      localStorage.getItem("td_form_tecnico_enviado") === "true"
    );
  }, []);

  // Cierra el menú móvil cada vez que cambia de página
  useEffect(() => { setMenuAbierto(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const items = getMenuItems(user);

  return (
    <>
      {/* Botón hamburguesa — solo visible en celular */}
      <button
        className="sidebar-toggle"
        aria-label="Abrir menú"
        onClick={() => setMenuAbierto(o => !o)}
      >
        {menuAbierto ? "✕" : "☰"}
      </button>

      {/* Fondo oscuro al abrir el menú en celular */}
      {menuAbierto && (
        <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)} />
      )}

      <aside className={`sidebar ${menuAbierto ? "open" : ""}`}>
        <div className="sidebar-logo">
          <LOGO />
        </div>

        <div className="sidebar-user" ref={opcionesRef}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Avatar usuario={user} size={34} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="username">
                {user?.nombre || user?.username}
              </div>

              <span
                className={`badge badge-${user?.rol}`}
                style={{ fontSize: "0.65rem" }}
              >
                {user?.rol === "admin"
                  ? "Administrador"
                  : user?.rol === "coordinador"
                  ? "Coordinador"
                  : "Cliente"}
              </span>
            </div>
            <button type="button" className="sidebar-opciones-btn" data-tour="tutorial"
              aria-label="Más opciones" aria-haspopup="menu" aria-expanded={opcionesAbiertas}
              title="Más opciones" onClick={() => setOpcionesAbiertas(v => !v)}>
              ⋮
            </button>
          </div>
          {opcionesAbiertas && (
            <div className="sidebar-opciones" role="menu">
              <button role="menuitem" onClick={opcion(cambiarTema)}>
                {tema === "oscuro" ? "☀️ Modo claro" : "🌙 Modo oscuro"}
              </button>
              <button role="menuitem" onClick={opcion(iniciarTour)}>❓ Ver tutorial</button>
              {!appInstalada && (
                <button role="menuitem" onClick={opcion(abrirInstalarApp)}>
                  📲 Descargar app
                </button>
              )}
              {avisosDisponibles() && permiso === "default" && (
                <button role="menuitem" onClick={opcion(activarAvisos)}>🔔 Activar avisos</button>
              )}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-tour={item.to}
              end
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button onClick={handleLogout}>
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
