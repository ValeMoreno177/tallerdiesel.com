import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { getMenuItems } from "../utils/menuItems";
import Avatar from "./Avatar";
import { aplicarTema } from "../utils/tema";
import { avisosDisponibles, permisoAvisos, pedirPermisoAvisos } from "../utils/avisosSistema";

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
  // "Instalar app" (Chrome/Edge/Android ofrecen el evento beforeinstallprompt)
  const [instalable, setInstalable] = useState(null);
  useEffect(() => {
    const alOfrecer = e => { e.preventDefault(); setInstalable(e); };
    window.addEventListener("beforeinstallprompt", alOfrecer);
    return () => window.removeEventListener("beforeinstallprompt", alOfrecer);
  }, []);
  const instalarApp = async () => {
    if (!instalable) return;
    instalable.prompt();
    try { await instalable.userChoice; } catch { /* nada */ }
    setInstalable(null);
  };
  const cambiarTema = () => {
    const nuevo = tema === 'oscuro' ? 'claro' : 'oscuro';
    aplicarTema(nuevo);
    setTema(nuevo);
  };
  const { user, logout, iniciarTour } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tecnicoEnviado, setTecnicoEnviado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

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

        <div className="sidebar-user">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Avatar usuario={user} size={34} />

            <div>
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
          </div>
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
          {instalable && (
            <button onClick={instalarApp} style={{ marginBottom: 6 }}>📲 Instalar app</button>
          )}
          {avisosDisponibles() && permiso === "default" && (
            <button onClick={activarAvisos} style={{ marginBottom: 6 }}>🔔 Activar avisos</button>
          )}
          <button className="btn-tema" onClick={cambiarTema} style={{ marginBottom: 6 }}
            aria-label={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
            {tema === 'oscuro' ? '☀️ Modo claro' : '🌙 Modo oscuro'}
          </button>
          <button data-tour="tutorial" onClick={iniciarTour} style={{ marginBottom: 6 }}>
            ❓ Ver tutorial
          </button>
          <button onClick={handleLogout}>
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
