import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import { lazy, Suspense } from "react";

// Cada pantalla se descarga solo cuando se abre (antes todo venía en un solo archivo de +500 KB).
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegistroPage = lazy(() => import("./pages/RegistroPage"));
const VerificarEmailPage = lazy(() => import("./pages/VerificarEmailPage"));
const ReenviarVerificacionPage = lazy(() => import("./pages/ReenviarVerificacionPage"));
const RecuperarContrasenaPage = lazy(() => import("./pages/RecuperarContrasenaPage"));
const SolicitarServicioPage = lazy(() => import("./pages/SolicitarServicioPage"));
const SolicitarCoordinadorPage = lazy(() => import("./pages/SolicitarCoordinadorPage"));
const MapaTecnicosPage = lazy(() => import("./pages/MapaTecnicosPage"));
const SolicitarTecnicoPage = lazy(() => import("./pages/SolicitarTecnicoPage"));
const DashboardCliente = lazy(() => import("./pages/DashboardCliente"));
const DashboardCoordinador = lazy(() => import("./pages/DashboardCoordinador"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const BitacoraPage = lazy(() => import("./pages/BitacoraPage"));
const ClienteBitacoraPage = lazy(() => import("./pages/ClienteBitacoraPage"));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage"));
const PerfilPage = lazy(() => import("./pages/PerfilPage"));
import TourGuia from "./components/TourGuia";
import SesionInactividad from "./components/SesionInactividad";
import CalificacionGlobal from "./components/CalificacionGlobal";
import { NotificacionesProvider } from "./context/NotificacionesContext";
import { PantallaCargando } from "./components/Esqueleto";

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
      <NotificacionesProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Suspense fallback={<PantallaCargando />}>
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
            path="/coordinador/perfil"
            element={
              <RutaProtegida roles={["coordinador"]}>
                <PerfilPage />
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
          {/* Configuración ya no está disponible: quien entre por la URL regresa a su inicio */}
          <Route path="/admin/configuracion" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
        <TourGuia />
        {/* Globales: cierre por inactividad (5 min) y ventana para calificar al terminar un servicio */}
        <SesionInactividad />
        <CalificacionGlobal />
      </BrowserRouter>
      </NotificacionesProvider>
    </AuthProvider>
  );
}