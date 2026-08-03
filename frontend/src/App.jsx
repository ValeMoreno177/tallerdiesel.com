import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import RegistroPage from "./pages/RegistroPage";
import VerificarEmailPage from "./pages/VerificarEmailPage";
import ReenviarVerificacionPage from "./pages/ReenviarVerificacionPage";
import RecuperarContrasenaPage from "./pages/RecuperarContrasenaPage";
import SolicitarServicioPage from "./pages/SolicitarServicioPage";
import SolicitarCoordinadorPage from "./pages/SolicitarCoordinadorPage";
import MapaTecnicosPage from "./pages/MapaTecnicosPage";
import SolicitarTecnicoPage from "./pages/SolicitarTecnicoPage";

import DashboardCliente from "./pages/DashboardCliente";
import DashboardCoordinador from "./pages/DashboardCoordinador";
import DashboardAdmin from "./pages/DashboardAdmin";
import BitacoraPage from "./pages/BitacoraPage";
import Creditopage from "./pages/Creditopage";
import ClienteBitacoraPage from "./pages/ClienteBitacoraPage";
import UsuariosPage from "./pages/UsuariosPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";

function RutaProtegida({ children, roles, requierePermisoEdicion }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loader" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol))
    return <Navigate to="/dashboard" replace />;
  if (
    requierePermisoEdicion &&
    user.rol === "coordinador" &&
    !user.puede_editar_sistema
  )
    return <Navigate to="/dashboard" replace />;
  return children;
}

function RutaDashboard() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loader" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (user.rol === "coordinador")
    return <Navigate to="/coordinador/bitacora" replace />;
  return <Navigate to="/cliente/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route
            path="/verificar-email"
            element={<VerificarEmailPage />}
          />
          <Route
            path="/reenviar-verificacion"
            element={<ReenviarVerificacionPage />}
          />
          <Route
            path="/recuperar-contrasena"
            element={<RecuperarContrasenaPage />}
          />

          <Route path="/dashboard" element={<RutaDashboard />} />

          {/* ── CLIENTE ── */}
          <Route
            path="/cliente/dashboard"
            element={
              <RutaProtegida roles={["cliente"]}>
                <DashboardCliente />
              </RutaProtegida>
            }
          />
          <Route
            path="/cliente/bitacora"
            element={
              <RutaProtegida roles={["cliente"]}>
                <ClienteBitacoraPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/cliente/bitacora-tecnico"
            element={<Navigate to="/cliente/bitacora" replace />}
          />
          {/* Solicitar a Coordinador (sin mapa) */}
          <Route
            path="/solicitar-servicio"
            element={
              <RutaProtegida roles={["cliente", "admin", "coordinador"]}>
                <SolicitarServicioPage />
              </RutaProtegida>
            }
          />
          {/* Solicitar a Técnico (con mapa) */}
          <Route
            path="/solicitar-tecnico"
            element={
              <RutaProtegida roles={["cliente", "admin", "coordinador"]}>
                <SolicitarTecnicoPage />
              </RutaProtegida>
            }
          />
          {/* Compat */}
          <Route
            path="/mapa-tecnicos"
            element={
              <RutaProtegida roles={["cliente", "admin", "coordinador"]}>
                <MapaTecnicosPage />
              </RutaProtegida>
            }
          />

          <Route
            path="/cliente/solicitar"
            element={<Navigate to="/solicitar-servicio" replace />}
          />

          <Route
            path="/cliente/mapa-tecnicos"
            element={<Navigate to="/mapa-tecnicos" replace />}
          />

          {/* ── COORDINADOR ── */}
          <Route
            path="/coordinador/dashboard"
            element={
              <RutaProtegida roles={["coordinador"]}>
                <DashboardCoordinador />
              </RutaProtegida>
            }
          />
          <Route
            path="/coordinador/bitacora"
            element={
              <RutaProtegida roles={["coordinador"]}>
                <BitacoraPage rol="coordinador" />
              </RutaProtegida>
            }
          />
          <Route
            path="/coordinador/usuarios"
            element={
              <RutaProtegida roles={["coordinador"]} requierePermisoEdicion>
                <UsuariosPage />
              </RutaProtegida>
            }
          />
          {/* Solicitar coordinador (si acaso lo necesita desde otro lado) */}
          <Route
            path="/solicitar-coordinador"
            element={
              <RutaProtegida roles={["coordinador", "admin"]}>
                <SolicitarCoordinadorPage />
              </RutaProtegida>
            }
          />

          {/* ── ADMIN ── */}
          <Route
            path="/admin/dashboard"
            element={
              <RutaProtegida roles={["admin"]}>
                <DashboardAdmin />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin/bitacora"
            element={
              <RutaProtegida roles={["admin"]}>
                <BitacoraPage rol="admin" />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <RutaProtegida roles={["admin"]}>
                <UsuariosPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin/configuracion"
            element={
              <RutaProtegida roles={["admin", "coordinador"]}>
                <ConfiguracionPage />
              </RutaProtegida>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
