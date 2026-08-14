"""
Plantillas de correo con diseño de marca (negro + naranja, estilo TallerDiesel)
y helper para enviarlas como HTML con fallback de texto plano.
"""
from django.core.mail import EmailMultiAlternatives
from django.conf import settings

NARANJA = '#e85d04'
NEGRO = '#111111'


def enviar_html(asunto, destinatarios, html_body, text_body, fail_silently=True):
    """Envía un correo HTML con fallback de texto plano. Devuelve True/False según éxito."""
    if not destinatarios:
        return False
    try:
        msg = EmailMultiAlternatives(
            subject=asunto,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=destinatarios,
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=fail_silently)
        return True
    except Exception as e:
        print(f'⚠️  Error enviando correo HTML "{asunto}": {e}')
        if not fail_silently:
            raise
        return False


def _wrapper(contenido_html, titulo_barra='TALLERDIESEL'):
    """Envoltura general: header negro con logo, cuerpo blanco con tarjeta, footer gris."""
    return f"""\
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:{NEGRO};padding:28px 32px;">
            <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:1px;color:#ffffff;">TALLER<span style="color:{NARANJA};">DIESEL</span></span><br/>
            <span style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.55);">AUXILIO CARRETERO</span>
          </td>
        </tr>

        <!-- Contenido -->
        <tr>
          <td style="padding:32px;">
            {contenido_html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #eee;">
            <span style="font-family:Arial,sans-serif;font-size:11px;color:#9ca3af;">
              Este correo fue generado automáticamente por el sistema TallerDiesel. Si no reconoces esta actividad, ignora este mensaje.
            </span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _fila(label, valor):
    if not valor:
        return ''
    return f"""
        <tr>
          <td style="padding:6px 0;font-family:Arial,sans-serif;font-size:13px;color:#6b7280;width:150px;vertical-align:top;">{label}</td>
          <td style="padding:6px 0;font-family:Arial,sans-serif;font-size:13px;color:#111827;font-weight:600;vertical-align:top;">{valor}</td>
        </tr>"""


def _boton(texto, url):
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;">
      <tr><td style="border-radius:50px;background:{NEGRO};">
        <a href="{url}" style="display:inline-block;padding:13px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:50px;border:2px solid {NARANJA};">
          {texto}
        </a>
      </td></tr>
    </table>"""


def email_nueva_solicitud(tipo_display, nombre, telefono, empresa, problema, lugar, tipo_unidad, unidad,
                           tecnico_nombre, ticket_id, fecha_str, url_dashboard):
    color_badge = '#2563eb' if 'TÉCNICO' in tipo_display else NARANJA
    filas = (
        _fila('Nombre', nombre) + _fila('Teléfono', telefono) + _fila('Empresa', empresa or 'No especificada')
        + _fila('Lugar', lugar) + _fila('Tipo de unidad', tipo_unidad) + _fila('Datos de unidad', unidad)
        + _fila('Técnico elegido', tecnico_nombre) + _fila('Ticket', ticket_id) + _fila('Fecha', fecha_str)
    )
    contenido = f"""
      <span style="display:inline-block;background:{color_badge};color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;padding:5px 14px;border-radius:20px;">
        SOLICITUD DE {tipo_display}
      </span>
      <h2 style="font-family:Arial,sans-serif;font-size:20px;color:#111827;margin:16px 0 6px;">¡Nueva solicitud recibida! 🔧</h2>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#6b7280;margin:0 0 18px;">Alguien necesita auxilio carretero. Atiéndela lo antes posible.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas}</table>
      <div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border-left:4px solid {color_badge};border-radius:6px;">
        <span style="font-family:Arial,sans-serif;font-size:13px;color:#374151;">"{problema}"</span>
      </div>
      {_boton('Ir al panel de coordinador →', url_dashboard)}
    """
    return _wrapper(contenido)


def email_confirmacion_cliente(nombre, empresa, problema):
    contenido = f"""
      <span style="display:inline-block;background:#059669;color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;padding:5px 14px;border-radius:20px;">
        SOLICITUD RECIBIDA
      </span>
      <h2 style="font-family:Arial,sans-serif;font-size:20px;color:#111827;margin:16px 0 6px;">¡Gracias, {nombre}! ✅</h2>
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.5;margin:0 0 18px;">
        Recibimos tu solicitud de auxilio carretero. Un coordinador se pondrá en contacto contigo en menos de <b>5 minutos</b>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        {_fila('Empresa', empresa or 'No especificada')}
      </table>
      <div style="margin-top:14px;padding:14px 16px;background:#f9fafb;border-left:4px solid {NARANJA};border-radius:6px;">
        <span style="font-family:Arial,sans-serif;font-size:13px;color:#374151;">"{problema}"</span>
      </div>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;margin-top:18px;">¿Es urgente? También puedes llamarnos directamente.</p>
    """
    return _wrapper(contenido)


def email_codigo_verificacion(nombre, codigo, minutos_validez):
    contenido = f"""
      <h2 style="font-family:Arial,sans-serif;font-size:20px;color:#111827;margin:0 0 6px;">Hola {nombre} 👋</h2>
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.5;margin:0 0 20px;">
        Usa este código para verificar tu cuenta de TallerDiesel:
      </p>
      <div style="text-align:center;padding:22px;background:{NEGRO};border-radius:10px;">
        <span style="font-family:Arial,sans-serif;font-size:34px;font-weight:800;letter-spacing:10px;color:{NARANJA};">{codigo}</span>
      </div>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;margin-top:16px;text-align:center;">Válido por {minutos_validez} minutos.</p>
    """
    return _wrapper(contenido)


def email_nuevo_comentario(autor_nombre, autor_rol, ticket_id, texto, url_destino):
    """autor_rol: 'cliente' o 'coordinador' (quién escribió el comentario)."""
    if autor_rol == 'cliente':
        badge_color = '#0DE255'
        badge_texto = 'NUEVO MENSAJE DEL CLIENTE'
        titulo = f'{autor_nombre} te escribió 💬'
        boton_texto = 'Ir a responder →'
    else:
        badge_color = '#2563eb'
        badge_texto = 'RESPUESTA DEL COORDINADOR'
        titulo = f'{autor_nombre} respondió tu solicitud 💬'
        boton_texto = 'Ver conversación →'
    contenido = f"""
      <span style="display:inline-block;background:{badge_color};color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;padding:5px 14px;border-radius:20px;">
        {badge_texto}
      </span>
      <h2 style="font-family:Arial,sans-serif;font-size:20px;color:#111827;margin:16px 0 6px;">{titulo}</h2>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#6b7280;margin:0 0 14px;">Ticket {ticket_id}</p>
      <div style="padding:14px 16px;background:#f9fafb;border-left:4px solid {badge_color};border-radius:6px;">
        <span style="font-family:Arial,sans-serif;font-size:13px;color:#374151;">"{texto}"</span>
      </div>
      {_boton(boton_texto, url_destino)}
    """
    return _wrapper(contenido)


def email_tecnico_asignado(tecnico_nombre, ticket_id, es_cambio, url_destino):
    """Se manda al cliente cuando se le asigna o se le cambia el técnico de su servicio."""
    badge_texto = 'TÉCNICO ACTUALIZADO' if es_cambio else 'TÉCNICO ASIGNADO'
    titulo = 'Cambiamos tu técnico 🔧' if es_cambio else '¡Ya tienes técnico asignado! 🔧'
    contenido = f"""
      <span style="display:inline-block;background:#7c3aed;color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;padding:5px 14px;border-radius:20px;">
        {badge_texto}
      </span>
      <h2 style="font-family:Arial,sans-serif;font-size:20px;color:#111827;margin:16px 0 6px;">{titulo}</h2>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#6b7280;margin:0 0 14px;">Ticket {ticket_id}</p>
      <div style="padding:14px 16px;background:#f9fafb;border-left:4px solid #7c3aed;border-radius:6px;">
        <span style="font-family:Arial,sans-serif;font-size:14px;color:#374151;">
          <strong>{tecnico_nombre}</strong> {'ahora' if es_cambio else ''} atenderá tu servicio.
        </span>
      </div>
      {_boton('Ver detalle del servicio →', url_destino)}
    """
    return _wrapper(contenido)
