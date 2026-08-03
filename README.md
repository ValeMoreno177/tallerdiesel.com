# TallerDiesel 🚛 — Plataforma de Auxilio Carretero

## Tecnologías
- **Frontend:** React 18 + Vite + React Router + Leaflet + Recharts
- **Backend:** Django 4.2 + Django REST Framework + JWT
- **Base de datos:** SQLite

---

## Instalación rápida (Linux / Mac)

```bash
chmod +x start.sh
./start.sh
```

---

## Instalación manual

### Backend (Django)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Mac/Linux
# venv\Scripts\activate           # Windows

pip install -r requirements.txt
python manage.py migrate              # incluye la migración de los nuevos requerimientos
python manage.py seed_data             # crea/actualiza datos y usuarios de prueba (idempotente)
python manage.py runserver
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## URLs
| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API REST | http://localhost:8000/api/ |
| Admin Django | http://localhost:8000/admin |

---

## Usuarios de prueba
| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | admin1234 | Administrador |
| coord1 | coord1234 | Coordinador |
| cliente1 | cliente1234 | Cliente |

---

## Estructura del proyecto

```
tallerdiesel/
├── backend/
│   ├── core/                    # Configuración Django
│   │   ├── settings.py
│   │   └── urls.py
│   ├── tallerdiesel_api/        # App principal
│   │   ├── models.py            # Usuario, Ticket, Técnico, etc.
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── management/commands/seed_data.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegistroPage.jsx
│   │   │   ├── SolicitarServicioPage.jsx
│   │   │   ├── DashboardCliente.jsx
│   │   │   ├── DashboardCoordinador.jsx
│   │   │   ├── DashboardAdmin.jsx
│   │   │   ├── BitacoraPage.jsx
│   │   │   └── UsuariosPage.jsx
│   │   ├── components/
│   │   │   └── Sidebar.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── start.sh
└── README.md
```

---

## Funcionalidades incluidas

### Autenticación
- Login con JWT (access + refresh token)
- Registro de nuevos usuarios
- 3 roles: Administrador, Coordinador, Cliente

### Portal público — Solicitar servicio
- Formulario de solicitud con respuesta en 5 min
- Mapa interactivo de técnicos más cercanos (Leaflet / OpenStreetMap)
- Filtro por ciudad y categoría
- Modal de técnico con info, Cómo llegar, WhatsApp y opiniones

### Dashboard Cliente
- Estadísticas: servicios en curso, terminados, pagos pendientes
- Tabla de servicios recientes

### Dashboard Coordinador
- Estadísticas + ganancias del día
- Tabla completa de tickets asignados

### Dashboard Admin
- Resumen general: ingresos, ganancia, IVA, comisiones, costos
- Top empresas por facturación + resumen financiero
- Corte mensual con gráfica de barras por mes

### Bitácora de tickets
- Los tickets se generan **automáticamente** al solicitar un servicio (ya no se crean manualmente)
- Edición y eliminación: solo Admin y Coordinador
- Flujo de estatus: **Pendiente → Atendido → En proceso → Finalizado**
- Asignación de técnico (Coordinador/Admin), visible para el cliente
- Cálculo automático: costo, ganancia, total, IVA 16%, ISR 1.25%, comisión 10%
- Búsqueda por ticket / empresa
- Diferente vista para Admin (con comisiones) y Coordinador

### Gestión de Usuarios (Admin, y Coordinador con permiso)
- Ver todos los usuarios con rol y estatus
- Agregar / editar usuarios
- Activar / desactivar usuarios
- Filtro por rol y búsqueda
- El Administrador puede otorgar a un Coordinador el permiso de **editar información del sistema**
  (empleados, catálogos y datos generales). Las cuentas de Administrador nunca pueden ser
  creadas, editadas o desactivadas por un Coordinador.

### Configuración de la empresa (solo Admin)
- Nombre, RFC, dirección, teléfono, correo y sitio web del taller
- No es delegable: ni siquiera un Coordinador con permiso de edición puede modificarla

### Aviso de privacidad
- Debe leerse y aceptarse obligatoriamente durante el registro de un nuevo usuario

---

## Requerimientos incorporados en esta versión

1. **Administración** — el Admin puede otorgar a un Coordinador el permiso de editar
   información del sistema; el nombre/datos de la empresa solo los edita el Admin.
2. **Módulo del Cliente** — campos de lugar/ubicación y datos de unidad en la solicitud de
   servicio; el ticket y su bitácora aparecen automáticamente tras solicitar el servicio;
   aviso de privacidad obligatorio en el registro.
3. **Gestión de Tickets** — el ticket se crea automáticamente al solicitar el servicio (ya no
   de forma manual); visible para Cliente, Coordinador y Administrador; solo Coordinador y
   Administrador pueden editarlo.
4. **Estados del Ticket** — se eliminó la opción "Crear ticket"; flujo
   Pendiente → Atendido → En proceso → Finalizado.
5. **Asignación de Técnicos** — Coordinador/Admin asignan técnico desde la solicitud o desde
   el ticket; el nombre del técnico se muestra al cliente; el estatus avanza automáticamente
   al asignar.
6. **Comunicación por WhatsApp** — por ahora el cliente contacta primero al Coordinador
   (botón de WhatsApp ya existente); la integración con WhatsApp Business API queda marcada
   como trabajo futuro, tal como indica el documento de requerimientos.
7. **Bitácora y Seguimiento** — cada ticket registra cambios de estatus, asignación de
   técnico, observaciones y actualizaciones del servicio.
