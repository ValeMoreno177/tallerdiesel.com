from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'usuarios', views.UsuarioViewSet)
router.register(r'tickets', views.TicketViewSet)
router.register(r'tecnicos', views.TecnicoViewSet)
router.register(r'operadores', views.OperadorViewSet)
router.register(r'unidades-flotilla', views.UnidadFlotillaViewSet, basename='unidadflotilla')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/',                     views.login_view),
    path('auth/registro/',                  views.registro_view),
    path('auth/refresh/',                   TokenRefreshView.as_view()),
    path('auth/logout/',                    views.logout_view),
    path('auth/me/',                        views.me_view),
    path('auth/tour-completado/',           views.tour_completado_view),
    path('auth/foto/',                      views.mi_foto),
    path('auth/cambiar-password/',          views.cambiar_password),
    path('auth/verificar/',                 views.verificar_email),
    path('auth/reenviar-verificacion/',     views.reenviar_verificacion),
    path('auth/recuperar/',                 views.solicitar_recuperacion),
    path('auth/recuperar/confirmar/',       views.confirmar_recuperacion),
    path('solicitud/',                      views.solicitud_servicio),
    path('solicitudes-pendientes/',         views.solicitudes_pendientes),
    path('solicitudes-pendientes/<int:pk>/atender/', views.marcar_solicitud_atendida),
    path('notificaciones/',                 views.mis_notificaciones),
    path('notificaciones/<int:pk>/leer/',   views.marcar_leida),
    path('notificaciones/<int:pk>/restaurar/', views.restaurar_notificacion),
    path('notificaciones/leer-todas/',      views.marcar_todas_leidas),
    path('empresas/',                       views.lista_empresas),
    path('operadores/crear/',              views.crear_operador),
    path('empresa-config/',                 views.empresa_config),
]
