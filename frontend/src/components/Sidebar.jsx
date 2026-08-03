import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

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
  const { user, logout } = useAuth();
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

  const getItems = () => {
    // ADMIN
    if (user?.rol === "admin")
      return [
        { to: "/admin/dashboard", label: "Dashboard", icon: "▦" },
        { to: "/admin/bitacora", label: "Bitácora", icon: "☰" },
        { to: "/admin/usuarios", label: "Usuarios", icon: "👥" },
        { to: "/mapa-tecnicos", label: "Mapa de Técnicos", icon: "🗺️" },
        { to: "/admin/configuracion", label: "Configuración", icon: "⚙" },
      ];

    // COORDINADOR
    if (user?.rol === "coordinador")
      return [
        { to: "/coordinador/dashboard", label: "Dashboard", icon: "▦" },
        { to: "/coordinador/bitacora", label: "Bitácora", icon: "☰" },

        ...(user?.puede_editar_sistema
          ? [
              {
                to: "/coordinador/usuarios",
                label: "Usuarios",
                icon: "👥",
              },
            ]
          : []),

        { to: "/mapa-tecnicos", label: "Mapa de Técnicos", icon: "🗺️" },
        { to: "/admin/configuracion", label: "Configuración", icon: "⚙" },
      ];

    // CLIENTE
    return [
      { to: '/cliente/dashboard',        label: 'Inicio',                  icon: '🏠' },
      { to: '/solicitar-servicio',       label: 'Solicitar a Coordinador', icon: '📍' },
      { to: '/solicitar-tecnico',        label: 'Solicitar a Técnico',     icon: '🔧' },
      { to: '/cliente/bitacora',         label: 'Bitácora',                icon: '🧑‍💼' },
    ];
  };

  const items = getItems();

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
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "var(--naranja)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.875rem",
                color: "white",
                flexShrink: 0,
              }}
            >
              {(user?.nombre || user?.username || "?")[0].toUpperCase()}
            </div>

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