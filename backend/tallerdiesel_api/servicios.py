"""Reglas de negocio de tickets y coordinadores (asignación, cola de espera y cambios de rol).

Están aquí, y no en views.py, para poder usarlas desde varios lugares (vistas, serializers) y probarlas solas.
"""
import math

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import ComentarioTicket, ConfiguracionEmpresa, Notificacion, Ticket, Usuario


# ── Quién puede editar un ticket ──────────────────────────────────────────────

def puede_gestionar_ticket(user, ticket):
    """¿Puede este usuario EDITAR el ticket (datos, técnico, solicitar finalización…)?

    - Coordinador: solo el coordinador asignado. Si el ticket aún no tiene coordinador, cualquiera puede
      tomarlo (al guardar, se queda con él).
    - Administrador: edita TODOS los tickets (se puede desactivar con ADMIN_PUEDE_EDITAR_TICKETS=false).
    - Cliente: no edita (sus acciones propias —comentar, confirmar finalización, calificar— van aparte).
    """
    if not (user and getattr(user, 'is_authenticated', False)) or ticket.eliminado:
        return False
    if user.rol == 'coordinador':
        return ticket.coordinador_id is None or ticket.coordinador_id == user.id
    if user.rol == 'admin':
        return bool(getattr(settings, 'ADMIN_PUEDE_EDITAR_TICKETS', True))
    return False


# ── Asignar un ticket a un coordinador ────────────────────────────────────────

def _comentario_sistema(ticket, autor, texto):
    ComentarioTicket.objects.create(
        ticket=ticket, autor=autor, autor_nombre=autor.nombre_completo if autor else 'Sistema', texto=texto)


def avisar_coordinador_asignado(ticket, coordinador):
    """Avisa al cliente (campana + correo) quién coordina ahora su servicio."""
    if not ticket.cliente_id:
        return
    Notificacion.objects.create(
        destinatario=ticket.cliente,
        titulo='Un coordinador tomó tu servicio',
        mensaje=f'{coordinador.nombre_completo} ahora coordina tu ticket {ticket.etiqueta}.',
        tipo='coordinador_asignado', referencia_id=ticket.id,
    )
    if ticket.cliente.email:
        try:
            from .emails import enviar_html, email_nuevo_comentario
            url = f'{settings.FRONTEND_URL}/cliente/dashboard'
            enviar_html(
                asunto=f'🧑‍💼 Un coordinador tomó tu servicio — {ticket.etiqueta}',
                destinatarios=[ticket.cliente.email],
                html_body=email_nuevo_comentario(coordinador.nombre_completo, 'coordinador', ticket.etiqueta,
                                                 f'{coordinador.nombre_completo} tomó tu servicio y ahora le da seguimiento personal.', url),
                text_body=f'{coordinador.nombre_completo} tomó tu servicio {ticket.etiqueta} y ahora le da seguimiento. Ingresa al sistema: {url}',
            )
        except Exception as e:  # el correo nunca debe tumbar la asignación
            print(f'⚠️  Error enviando correo de coordinador asignado: {e}')


def reclamar_ticket(ticket, coordinador, automatico=False, motivo=None):
    """Asigna el ticket a `coordinador` SOLO si sigue sin coordinador. Si dos coordinadores lo intentan a la
    vez, gana uno y al otro devuelve False. Al asignarlo se genera su folio consecutivo."""
    filas = Ticket.objects.filter(pk=ticket.pk, coordinador__isnull=True, eliminado=False).update(coordinador=coordinador)
    if not filas:
        return False
    ticket.refresh_from_db()
    ticket.asignar_folio()                     # folio consecutivo (TD001, TD002…) al asignarlo
    try:                                       # la solicitud ya no queda "pendiente" para los demás coordinadores
        solicitud = ticket.solicitud_origen
        if not solicitud.atendida:
            solicitud.atendida = True
            solicitud.save(update_fields=['atendida'])
    except Exception:
        pass
    Usuario.objects.filter(pk=coordinador.pk).update(libre_desde=None)   # ya tiene trabajo: deja de estar libre
    if motivo:
        _comentario_sistema(ticket, None, motivo)
    elif automatico:
        _comentario_sistema(ticket, None, f'{coordinador.nombre_completo} recibió este ticket automáticamente '
                                          'al finalizar su servicio anterior.')
    else:
        _comentario_sistema(ticket, coordinador, f'{coordinador.nombre_completo} tomó este servicio como coordinador.')
    avisar_coordinador_asignado(ticket, coordinador)
    return True


def asignar_siguiente_en_espera(coordinador):
    """Cuando el coordinador finaliza un ticket, recibe el siguiente en espera: la solicitud más antigua
    que sigue pendiente y sin coordinador. Devuelve el ticket asignado o None."""
    if not coordinador or coordinador.rol != 'coordinador' or not coordinador.is_active:
        return None
    en_espera = Ticket.objects.filter(
        eliminado=False, coordinador__isnull=True, estatus='pendiente', tipo_solicitud='coordinador',
    ).order_by('fecha_creacion', 'id')
    for candidato in en_espera[:5]:            # si otro coordinador se lo gana, se prueba con el siguiente
        if reclamar_ticket(candidato, coordinador, automatico=True):
            Notificacion.objects.create(
                destinatario=coordinador,
                titulo=f'📥 Se te asignó el ticket {candidato.etiqueta}',
                mensaje=f'Era el siguiente en espera ({candidato.empresa}). Ya puedes atenderlo.',
                tipo='ticket_asignado', referencia_id=candidato.id,
            )
            return candidato
    # No había nada en espera: queda libre desde ahora y será el primero en recibir el próximo servicio.
    Usuario.objects.filter(pk=coordinador.pk).update(libre_desde=timezone.now())
    return None


# ── Reparto automático de tickets nuevos entre coordinadores ──────────────────

def _elegir_coordinador(cfg):
    """Quién recibe el ticket nuevo (llamar con la configuración bloqueada):
    1) Si algún coordinador ya finalizó un servicio y sigue libre, el que lleva MÁS tiempo libre.
    2) Si no, por turno: el siguiente número después del último que recibió (1, 2, 3… y vuelve al 1)."""
    activos = list(Usuario.objects.filter(rol='coordinador', is_active=True).order_by('numero_coordinador', 'id'))
    if not activos:
        return None
    libres = [c for c in activos if c.libre_desde]
    if libres:
        return min(libres, key=lambda c: c.libre_desde)
    siguiente = next((c for c in activos if (c.numero_coordinador or 0) > cfg.ultimo_turno), activos[0])
    cfg.ultimo_turno = siguiente.numero_coordinador or 0
    cfg.save(update_fields=['ultimo_turno'])
    return siguiente


def asignar_coordinador_automatico(ticket):
    """Asigna un ticket nuevo (de tipo coordinador y aún sin coordinador) al que le toca. Al quedar asignado
    se genera su folio consecutivo (TD027 después de TD026…). Devuelve el coordinador o None si no hay."""
    if ticket.coordinador_id or ticket.tipo_solicitud != 'coordinador':
        return None
    ConfiguracionEmpresa.obtener()                       # asegura que exista el registro único
    with transaction.atomic():
        cfg = ConfiguracionEmpresa.objects.select_for_update().get(pk=1)   # una solicitud a la vez
        coordinador = _elegir_coordinador(cfg)
        if coordinador is None:
            return None                                  # sin coordinadores activos: queda en espera
        if not reclamar_ticket(ticket, coordinador, motivo=(
                f'Ticket asignado automáticamente a {coordinador.nombre_completo} '
                f'(coordinador #{coordinador.numero_coordinador}).')):
            return None
    Notificacion.objects.create(
        destinatario=coordinador,
        titulo=f'📥 Se te asignó el ticket {ticket.etiqueta}',
        mensaje=f'Es tu turno: {ticket.empresa}. Ya puedes atenderlo.',
        tipo='ticket_asignado', referencia_id=ticket.id,
    )
    return coordinador


# ── Cambio de rol de un usuario ───────────────────────────────────────────────

def aplicar_cambio_de_rol(usuario, rol_anterior):
    """Ajusta lo que depende del rol cuando el Administrador cambia el rol de alguien:
    - El permiso de editar el sistema solo existe para coordinadores.
    - Si deja de ser coordinador, sus tickets sin finalizar regresan a la espera (sin coordinador) y se avisa al
      Administrador para que los reasigne. Los ya finalizados conservan su historial.
    Los permisos se evalúan con el rol guardado en cada petición, así que el cambio aplica de inmediato."""
    if usuario.rol != 'coordinador' and usuario.puede_editar_sistema:
        usuario.puede_editar_sistema = False
        usuario.save(update_fields=['puede_editar_sistema'])

    if rol_anterior == 'coordinador' and usuario.rol != 'coordinador':
        pendientes = list(Ticket.objects.filter(coordinador=usuario, eliminado=False).exclude(estatus='terminado'))
        for t in pendientes:
            Ticket.objects.filter(pk=t.pk).update(coordinador=None)
            _comentario_sistema(t, None, f'{usuario.nombre_completo} dejó de ser coordinador: el ticket quedó sin coordinador.')
        if pendientes:
            for admin in Usuario.objects.filter(rol='admin', is_active=True):
                Notificacion.objects.create(
                    destinatario=admin,
                    titulo=f'{len(pendientes)} ticket(s) quedaron sin coordinador',
                    mensaje=f'{usuario.nombre_completo} dejó de ser coordinador. Reasigna sus tickets sin finalizar.',
                    tipo='cambio_estatus', referencia_id=pendientes[0].id,
                )


# ── Geolocalización ───────────────────────────────────────────────────────────

def distancia_km(lat1, lon1, lat2, lon2):
    """Distancia en km entre dos coordenadas (fórmula de Haversine)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def coordenada_valida(lat, lng):
    """Convierte a float y valida rango; devuelve (lat, lng) o None."""
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180) or (math.isnan(lat) or math.isnan(lng)):
        return None
    return lat, lng


# ── Alta automática de clientes (módulo "Nueva solicitud" del coordinador) ────

import re as _re
import secrets as _secrets
import unicodedata as _unicodedata

DOMINIO_SIN_CORREO = 'sin-correo.invalid'   # clientes dados de alta sin correo (no recibe mensajes)


def _sin_acentos(texto):
    return ''.join(c for c in _unicodedata.normalize('NFD', texto or '') if _unicodedata.category(c) != 'Mn')


def generar_usuario(nombre, apellido=''):
    """'Juan', 'Pérez' → 'jperez' (o 'jperez2', 'jperez3'… si ya existe)."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    nombre = _re.sub(r'[^a-z0-9]', '', _sin_acentos(nombre).lower())
    apellido = _re.sub(r'[^a-z0-9]', '', _sin_acentos(apellido).lower())
    base = ((nombre[:1] + apellido) if apellido else nombre) or 'cliente'
    base = base[:20]
    candidato, n = base, 1
    while User.objects.filter(username__iexact=candidato).exists():
        n += 1
        candidato = f'{base}{n}'
    return candidato


def generar_password(largo=10):
    """Contraseña aleatoria fácil de dictar (sin 0/O, 1/l/I) con letras y números."""
    letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
    numeros = '23456789'
    while True:
        pw = ''.join(_secrets.choice(letras + numeros) for _ in range(largo))
        if any(c in numeros for c in pw) and any(c.isupper() for c in pw) and any(c.islower() for c in pw):
            return pw


def solo_digitos(texto):
    return _re.sub(r'\D', '', texto or '')


def buscar_cliente_existente(email='', telefono=''):
    """Busca un cliente por correo o por teléfono (últimos 10 dígitos)."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    email = (email or '').strip()
    if email:
        u = User.objects.filter(rol='cliente', email__iexact=email).first()
        if u:
            return u
    tel = solo_digitos(telefono)[-10:]
    if len(tel) >= 8:
        for u in User.objects.filter(rol='cliente').exclude(telefono=''):
            if solo_digitos(u.telefono)[-10:] == tel:
                return u
    return None
