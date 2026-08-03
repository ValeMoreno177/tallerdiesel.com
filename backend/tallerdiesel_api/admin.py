from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (Usuario, Ticket, Tecnico, Opinion, Proveedor,
                     SolicitudServicio, Notificacion, ComentarioTicket, TokenVerificacion,
                     ConfiguracionEmpresa)

@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display  = ['username', 'email', 'nombre_completo', 'rol', 'empresa', 'puede_editar_sistema', 'email_verificado', 'is_active']
    list_filter   = ['rol', 'is_active', 'email_verificado', 'puede_editar_sistema']
    search_fields = ['username', 'email', 'nombre', 'empresa']
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Info personal', {'fields': ('nombre', 'apellido_paterno', 'apellido_materno', 'email', 'telefono', 'empresa', 'puesto')}),
        ('Rol y permisos', {'fields': ('rol', 'puede_editar_sistema', 'email_verificado', 'aviso_privacidad_aceptado', 'is_active', 'is_staff', 'is_superuser')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('username', 'email', 'rol', 'password1', 'password2')}),
    )

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display  = ['ticket_id', 'empresa', 'fecha', 'estatus', 'unidad', 'lugar', 'tecnico', 'coordinador']
    list_filter   = ['estatus', 'estatus_factura']
    search_fields = ['ticket_id', 'empresa', 'unidad']

@admin.register(ComentarioTicket)
class ComentarioTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'autor_nombre', 'es_cambio_estatus', 'fecha']

@admin.register(Tecnico)
class TecnicoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'categoria', 'ciudad', 'estado', 'calificacion', 'activo']
    list_filter  = ['categoria', 'activo']

@admin.register(Opinion)
class OpinionAdmin(admin.ModelAdmin):
    list_display = ['tecnico', 'nombre_autor', 'calificacion', 'fecha']

@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'telefono', 'email', 'activo']

@admin.register(SolicitudServicio)
class SolicitudServicioAdmin(admin.ModelAdmin):
    list_display = ['nombre_completo', 'empresa', 'telefono', 'lugar', 'unidad', 'ticket', 'fecha', 'atendida']
    list_filter  = ['atendida']

@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ['destinatario', 'titulo', 'tipo', 'leida', 'fecha']

@admin.register(TokenVerificacion)
class TokenVerificacionAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'token', 'creado_en']

@admin.register(ConfiguracionEmpresa)
class ConfiguracionEmpresaAdmin(admin.ModelAdmin):
    list_display = ['nombre_empresa', 'telefono', 'email', 'actualizado_en', 'actualizado_por']
