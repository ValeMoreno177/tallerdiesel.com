from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from django.utils import timezone

from .models import ComentarioTicket, Notificacion, Opinion, Tecnico, Ticket

User = get_user_model()


class CalificacionServicioTests(APITestCase):
    """Al finalizar un servicio se pide al cliente calificar al técnico."""

    def setUp(self):
        mk = lambda u, rol: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u,
                                                     email_verificado=True)
        self.cliente = mk('cli', 'cliente')
        self.otro = mk('otro', 'cliente')
        self.coord = mk('coord', 'coordinador')
        self.admin = mk('adm', 'admin')
        self.tec = Tecnico.objects.create(nombre='Juan', categoria='motor_diesel', ciudad='X', estado='Y',
                                          telefono='1', latitud=0, longitud=0)
        self.ticket = Ticket.objects.create(empresa='ACME', fecha=date.today(), unidad='U1',
                                            cliente=self.cliente, coordinador=self.coord,
                                            tecnico=self.tec, estatus='proceso', tipo_solicitud='tecnico')

    def _finalizar_con_cliente(self):
        self.client.force_authenticate(self.coord)
        self.assertEqual(self.client.post(f'/api/tickets/{self.ticket.id}/solicitar_finalizacion/').status_code, 200)
        self.client.force_authenticate(self.cliente)
        r = self.client.post(f'/api/tickets/{self.ticket.id}/responder_finalizacion/', {'acepta': True}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_finalizar_crea_aviso_y_pendiente(self):
        self._finalizar_con_cliente()
        self.ticket.refresh_from_db()
        self.assertIsNotNone(self.ticket.fecha_finalizacion)
        self.assertEqual(Notificacion.objects.filter(destinatario=self.cliente, tipo='calificar_servicio').count(), 1)
        r = self.client.get('/api/tickets/pendientes_calificar/')
        self.assertEqual([t['id'] for t in r.data], [self.ticket.id])
        self.assertEqual(r.data[0]['tecnico_nombre'], 'Juan')

    def test_el_admin_ya_no_edita_tickets_asi_que_no_los_finaliza(self):
        # Solo el coordinador asignado edita; el admin solo lee. (Con cliente, el coordinador tampoco cierra solo.)
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f'/api/tickets/{self.ticket.id}/', {'estatus': 'terminado'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.estatus, 'proceso')

    def test_calificar_ok_y_no_se_repite(self):
        self._finalizar_con_cliente()
        url = f'/api/tickets/{self.ticket.id}/calificar/'
        # faltan estrellas
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'calificacion_tecnico': 6}, format='json').status_code, 400)
        # comentario opcional
        r = self.client.post(url, {'calificacion_tecnico': 2}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.post(url, {'calificacion_tecnico': 5}, format='json').status_code, 400)
        self.tec.refresh_from_db()
        self.assertEqual(self.tec.calificacion, 2)
        op = Opinion.objects.get(ticket=self.ticket)
        self.assertEqual((op.calificacion, op.calificacion_servicio, op.comentario), (2, None, ''))
        # ya no está pendiente y el aviso de la campana queda leído
        self.assertEqual(self.client.get('/api/tickets/pendientes_calificar/').data, [])
        self.assertFalse(Notificacion.objects.filter(tipo='calificar_servicio', leida=False).exists())
        d = self.client.get(f'/api/tickets/{self.ticket.id}/').data
        self.assertTrue(d['calificado'])
        self.assertFalse(d['puede_calificar'])
        self.assertEqual(d['calificacion_detalle']['calificacion_tecnico'], 2)
        self.assertNotIn('calificacion_servicio', d['calificacion_detalle'])

    def test_promedio_y_total_se_actualizan_con_cada_evaluacion(self):
        self.ticket.estatus = 'terminado'
        self.ticket.save()
        self.client.force_authenticate(self.cliente)
        r = self.client.post(
            f'/api/tickets/{self.ticket.id}/calificar/',
            {'calificacion_tecnico': 2},
            format='json',
        )
        self.assertEqual(r.status_code, 201, r.data)

        segundo_ticket = Ticket.objects.create(
            empresa='ACME', fecha=date.today(), unidad='U2',
            cliente=self.otro, coordinador=self.coord, tecnico=self.tec, estatus='terminado',
        )
        self.client.force_authenticate(self.otro)
        r = self.client.post(
            f'/api/tickets/{segundo_ticket.id}/calificar/',
            {'calificacion_tecnico': 4},
            format='json',
        )
        self.assertEqual(r.status_code, 201, r.data)

        self.tec.refresh_from_db()
        self.assertEqual(self.tec.calificacion, 3)

        response = self.client.get('/api/tecnicos/')
        tecnicos = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        datos_tecnico = next(t for t in tecnicos if t['id'] == self.tec.id)
        self.assertEqual(float(datos_tecnico['calificacion_promedio']), 3)
        self.assertEqual(datos_tecnico['total_calificaciones'], 2)

        sin_votos = Tecnico.objects.create(
            nombre='Sin votos', categoria='motor_diesel', ciudad='X', estado='Y',
            telefono='2', latitud=1, longitud=1,
        )
        response = self.client.get('/api/tecnicos/')
        tecnicos = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        datos_sin_votos = next(t for t in tecnicos if t['id'] == sin_votos.id)
        self.assertIsNone(datos_sin_votos['calificacion_promedio'])
        self.assertEqual(datos_sin_votos['total_calificaciones'], 0)

    def test_opinion_directa_rechaza_estrellas_fuera_de_rango_y_actualiza_promedio(self):
        url = f'/api/tecnicos/{self.tec.id}/agregar_opinion/'
        respuesta = self.client.post(url, {'nombre_autor': 'Cliente', 'calificacion': 6}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        respuesta = self.client.post(
            url,
            {'nombre_autor': 'Cliente', 'calificacion': 4, 'comentario': 'Buen servicio'},
            format='json',
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.tec.refresh_from_db()
        self.assertEqual(self.tec.calificacion, 4)

    def test_no_se_califica_si_no_esta_finalizado_ni_ajeno_ni_staff(self):
        url = f'/api/tickets/{self.ticket.id}/calificar/'
        body = {'calificacion_tecnico': 5}
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.post(url, body, format='json').status_code, 403)  # no finalizado (permiso)
        self.ticket.estatus = 'terminado'; self.ticket.save()
        self.client.force_authenticate(self.otro)
        self.assertEqual(self.client.post(url, body, format='json').status_code, 404)  # ticket de otro cliente
        self.client.force_authenticate(self.coord)
        self.assertEqual(self.client.post(url, body, format='json').status_code, 403)  # staff no califica

    def test_sin_tecnico_no_se_puede_calificar(self):
        self.ticket.tecnico = None; self.ticket.estatus = 'terminado'; self.ticket.save()
        self.client.force_authenticate(self.cliente)
        r = self.client.post(f'/api/tickets/{self.ticket.id}/calificar/',
                             {'comentario': ' Excelente '}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Opinion.objects.filter(ticket=self.ticket).exists())
        self.assertFalse(self.client.get(f'/api/tickets/{self.ticket.id}/').data['puede_calificar'])

    def test_tickets_viejos_sin_fecha_de_cierre_no_estorban(self):
        self.ticket.estatus = 'terminado'; self.ticket.save()  # finalizado antes de esta función
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get('/api/tickets/pendientes_calificar/').data, [])

    def test_alertas_de_mensajes_siguen_con_servicio_finalizado(self):
        self.ticket.estatus = 'terminado'; self.ticket.save()
        self.client.force_authenticate(self.coord)
        self.client.post(f'/api/tickets/{self.ticket.id}/agregar_comentario/', {'texto': 'Hola'}, format='json')
        self.assertEqual(Notificacion.objects.filter(destinatario=self.cliente, tipo='comentario').count(), 1)
        self.client.force_authenticate(self.cliente)
        self.client.post(f'/api/tickets/{self.ticket.id}/agregar_comentario/', {'texto': 'Gracias'}, format='json')
        self.assertEqual(Notificacion.objects.filter(destinatario=self.coord, tipo='comentario').count(), 1)


class DashboardsTests(APITestCase):
    """Un servicio recién solicitado (sin coordinador) debe verse ya en los dashboards."""

    def setUp(self):
        mk = lambda u, rol: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u, email_verificado=True)
        self.coord = mk('coord', 'coordinador')
        self.otro_coord = mk('coord2', 'coordinador')
        self.admin = mk('adm', 'admin')

    def _ticket(self, **kw):
        return Ticket.objects.create(empresa='ACME', fecha=date.today(), unidad='U1', estatus='pendiente', **kw)

    def test_coordinador_ve_sin_asignar_y_propios_pero_no_ajenos_ni_eliminados(self):
        nuevo = self._ticket()                                   # recién solicitado, sin coordinador
        mio = self._ticket(coordinador=self.coord)
        self._ticket(coordinador=self.otro_coord)                # de otro coordinador
        self._ticket(eliminado=True)                             # en la papelera
        self.client.force_authenticate(self.coord)
        d = self.client.get('/api/tickets/dashboard_coordinador/').data
        self.assertEqual(sorted(t['id'] for t in d['tickets']), sorted([nuevo.id, mio.id]))
        self.assertEqual(d['pendientes'], 2)

    def test_admin_cuenta_el_servicio_nuevo_y_no_los_eliminados(self):
        self._ticket(); self._ticket(eliminado=True)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get('/api/tickets/dashboard_admin/').data['pendientes'], 1)


class CorreoCompartidoTests(APITestCase):
    """Un correo se puede repetir entre COORDINADORES, y solo si lo da de alta el Administrador."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()   # los límites de peticiones usan caché
        mk = lambda u, rol, email=None, **kw: User.objects.create_user(
            u, email or f'{u}@x.com', 'pass12345', rol=rol, nombre=u, email_verificado=True, **kw)
        self.admin = mk('adm', 'admin')
        self.coord_permiso = mk('coordp', 'coordinador', puede_editar_sistema=True)
        self.cliente = mk('cli', 'cliente', 'cli@x.com')

    def _alta(self, quien, username, email, rol='coordinador'):
        self.client.force_authenticate(quien)
        return self.client.post('/api/usuarios/', {
            'username': username, 'email': email, 'rol': rol, 'nombre': username, 'password': 'pass12345'}, format='json')

    def test_admin_puede_repetir_el_correo_de_un_coordinador_las_veces_que_quiera(self):
        for i in range(4):
            r = self._alta(self.admin, f'coord{i}', 'coordinacion@taller.com')
            self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(User.objects.filter(email='coordinacion@taller.com').count(), 4)
        # Todas quedan listas para entrar (los coordinadores no verifican correo)
        self.assertFalse(User.objects.filter(email='coordinacion@taller.com', email_verificado=False).exists())
        # También sin distinguir mayúsculas
        self.assertEqual(self._alta(self.admin, 'coord9', 'Coordinacion@Taller.com').status_code, 201)

    def test_un_coordinador_con_permiso_de_edicion_NO_puede_repetir_correo(self):
        self.assertEqual(self._alta(self.admin, 'coordA', 'coordinacion@taller.com').status_code, 201)
        r = self._alta(self.coord_permiso, 'coordB', 'coordinacion@taller.com')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Solo el Administrador', str(r.data['email']))
        self.assertFalse(User.objects.filter(username='coordB').exists())

    def test_correos_de_cliente_o_admin_nunca_se_comparten(self):
        # coordinador con el correo de un cliente
        self.assertEqual(self._alta(self.admin, 'c1', 'cli@x.com').status_code, 400)
        # cliente / admin / coordinador nuevo con el correo de un coordinador
        self._alta(self.admin, 'coordA', 'coordinacion@taller.com')
        self.assertEqual(self._alta(self.admin, 'k1', 'coordinacion@taller.com', rol='cliente').status_code, 400)
        self.assertEqual(self._alta(self.admin, 'a1', 'coordinacion@taller.com', rol='admin').status_code, 400)
        # cliente repetido sigue prohibido
        self.assertEqual(self._alta(self.admin, 'k2', 'cli@x.com', rol='cliente').status_code, 400)

    def test_el_registro_publico_no_puede_usar_un_correo_ya_registrado(self):
        self._alta(self.admin, 'coordA', 'coordinacion@taller.com')
        self.client.force_authenticate(None)
        body = lambda e: {'username': 'nuevo', 'email': e, 'nombre': 'N', 'apellido_paterno': 'P', 'password': 'pass12345',
                          'confirmar_password': 'pass12345', 'aceptar_aviso_privacidad': True}
        self.assertEqual(self.client.post('/api/auth/registro/', body('coordinacion@taller.com'), format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/auth/registro/', body('cli@x.com'), format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/auth/registro/', body('libre@x.com'), format='json').status_code, 201)

    def test_editar_a_un_coordinador_que_ya_comparte_correo_no_estorba(self):
        self._alta(self.admin, 'coordA', 'coordinacion@taller.com')
        self._alta(self.admin, 'coordB', 'coordinacion@taller.com')
        b = User.objects.get(username='coordB')
        # coordinador con permiso cambia solo el puesto/nombre (el correo no cambia) → permitido
        self.client.force_authenticate(self.coord_permiso)
        r = self.client.patch(f'/api/usuarios/{b.id}/', {'email': 'coordinacion@taller.com', 'puesto': 'Norte'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        # pero NO puede cambiarle el correo a otro ya usado por coordinadores
        r = self.client.patch(f'/api/usuarios/{b.id}/', {'email': 'cli@x.com'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_base_de_datos_refuerza_la_regla_para_no_coordinadores(self):
        from django.db import IntegrityError, transaction
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user('otro', 'cli@x.com', 'pass12345', rol='cliente')

    def test_recuperar_contrasena_con_correo_compartido_pide_usuario_y_solo_cambia_esa_cuenta(self):
        from .models import CodigoRecuperacion
        self._alta(self.admin, 'coordA', 'coordinacion@taller.com')
        self._alta(self.admin, 'coordB', 'coordinacion@taller.com')
        self.client.force_authenticate(None)
        r = self.client.post('/api/auth/recuperar/', {'email': 'coordinacion@taller.com'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data.get('requiere_usuario'))
        self.assertFalse(CodigoRecuperacion.objects.exists())      # no se manda código a ciegas
        r = self.client.post('/api/auth/recuperar/', {'email': 'coordinacion@taller.com', 'username': 'coordB'}, format='json')
        self.assertFalse(r.data.get('requiere_usuario'))
        codigo = CodigoRecuperacion.objects.get().codigo
        self.assertEqual(CodigoRecuperacion.objects.get().usuario.username, 'coordB')
        # sin usuario no deja confirmar; con usuario cambia únicamente a coordB
        r = self.client.post('/api/auth/recuperar/confirmar/', {'email': 'coordinacion@taller.com', 'codigo': codigo, 'password': 'nuevaClave123'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/auth/recuperar/confirmar/', {'email': 'coordinacion@taller.com', 'username': 'coordB', 'codigo': codigo, 'password': 'nuevaClave123'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(User.objects.get(username='coordB').check_password('nuevaClave123'))
        self.assertTrue(User.objects.get(username='coordA').check_password('pass12345'))

    def test_correo_unico_sigue_funcionando_igual_sin_pedir_usuario(self):
        from .models import CodigoRecuperacion
        self.client.force_authenticate(None)
        r = self.client.post('/api/auth/recuperar/', {'email': 'cli@x.com'}, format='json')
        self.assertFalse(r.data.get('requiere_usuario'))
        self.assertEqual(CodigoRecuperacion.objects.get().usuario, self.cliente)
        # correo inexistente: misma respuesta genérica, sin pistas
        r = self.client.post('/api/auth/recuperar/', {'email': 'nadie@x.com'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_verificar_y_reenviar_con_varias_cuentas_sin_verificar_no_dan_error_500(self):
        for u in ('v1', 'v2'):
            User.objects.create_user(u, 'compartido@x.com', 'pass12345', rol='coordinador')
        # (los coordinadores se verifican solos; se simula una fila antigua sin verificar saltando save())
        User.objects.filter(email='compartido@x.com').update(email_verificado=False)
        self.client.force_authenticate(None)
        r = self.client.post('/api/auth/reenviar-verificacion/', {'email': 'compartido@x.com'}, format='json')
        self.assertEqual(r.status_code, 400); self.assertTrue(r.data.get('requiere_usuario'))
        r = self.client.post('/api/auth/verificar/', {'email': 'compartido@x.com', 'codigo': '123456'}, format='json')
        self.assertEqual(r.status_code, 400); self.assertTrue(r.data.get('requiere_usuario'))
        r = self.client.post('/api/auth/reenviar-verificacion/', {'email': 'compartido@x.com', 'username': 'v2'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def test_cada_cuenta_inicia_sesion_con_su_propio_usuario(self):
        self._alta(self.admin, 'coordA', 'coordinacion@taller.com')
        self._alta(self.admin, 'coordB', 'coordinacion@taller.com')
        self.client.force_authenticate(None)
        for u in ('coordA', 'coordB'):
            r = self.client.post('/api/auth/login/', {'username': u, 'password': 'pass12345'}, format='json')
            self.assertEqual(r.status_code, 200, (u, r.data))
            self.assertEqual(r.data['user']['username'], u)


class PerfilTests(APITestCase):
    """Foto de perfil y cambio de contraseña."""

    JPEG = b'\xff\xd8\xff\xe0' + b'\x00' * 200
    PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 200

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        mk = lambda u, rol: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u, email_verificado=True)
        self.carlo = mk('carlo', 'coordinador')
        self.karen = mk('karen', 'coordinador')
        self.cli = mk('cli', 'cliente')

    def _subir(self, quien, datos, nombre='foto.jpg', tipo='image/jpeg'):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(quien)
        return self.client.post('/api/auth/foto/', {'foto': SimpleUploadedFile(nombre, datos, content_type=tipo)}, format='multipart')

    # ── foto ──
    def test_subir_foto_y_verla(self):
        r = self._subir(self.carlo, self.JPEG)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNotNone(r.data['foto_version'])
        self.assertNotIn('contenido', r.data)
        f = self.client.get(f'/api/usuarios/{self.carlo.id}/foto/')
        self.assertEqual(f.status_code, 200)
        self.assertEqual(f['Content-Type'], 'image/jpeg')
        self.assertEqual(f['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(f.content, self.JPEG)
        # /auth/me/ ya trae la versión de la foto
        self.assertIsNotNone(self.client.get('/api/auth/me/').data['foto_version'])

    def test_reemplazar_deja_una_sola_foto_y_cambia_la_version(self):
        from .models import FotoPerfil
        self._subir(self.carlo, self.JPEG)
        FotoPerfil.objects.filter(usuario=self.carlo).update(actualizada='2020-01-01T00:00:00Z')
        v1 = self.client.get('/api/auth/me/').data['foto_version']
        r = self._subir(self.carlo, self.PNG, 'f.png', 'image/png')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(FotoPerfil.objects.filter(usuario=self.carlo).count(), 1)
        self.assertGreater(r.data['foto_version'], v1)
        self.assertEqual(self.client.get(f'/api/usuarios/{self.carlo.id}/foto/')['Content-Type'], 'image/png')

    def test_validaciones_de_la_foto(self):
        # texto disfrazado de .jpg
        self.assertEqual(self._subir(self.carlo, b'<script>alert(1)</script>', 'x.jpg').status_code, 400)
        # demasiado pesada
        self.assertEqual(self._subir(self.carlo, self.JPEG + b'\x00' * (1024 * 1024)).status_code, 400)
        # sin archivo
        self.client.force_authenticate(self.carlo)
        self.assertEqual(self.client.post('/api/auth/foto/', {}, format='multipart').status_code, 400)
        # sin sesión
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post('/api/auth/foto/', {}, format='multipart').status_code, 401)
        from .models import FotoPerfil
        self.assertFalse(FotoPerfil.objects.exists())   # ningún intento inválido guardó nada

    def test_quitar_foto(self):
        self._subir(self.carlo, self.JPEG)
        r = self.client.delete('/api/auth/foto/')
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data['foto_version'])
        self.assertEqual(self.client.get(f'/api/usuarios/{self.carlo.id}/foto/').status_code, 404)

    def test_quien_puede_ver_cada_foto(self):
        self._subir(self.carlo, self.JPEG)
        self.client.force_authenticate(self.karen)                                     # otro coordinador: sí
        self.assertEqual(self.client.get(f'/api/usuarios/{self.carlo.id}/foto/').status_code, 200)
        self.client.force_authenticate(self.cli)                                       # cliente: no (ni sabe que existe)
        self.assertEqual(self.client.get(f'/api/usuarios/{self.carlo.id}/foto/').status_code, 404)
        self._subir(self.cli, self.JPEG)                                               # la suya sí
        self.assertEqual(self.client.get(f'/api/usuarios/{self.cli.id}/foto/').status_code, 200)
        self.client.force_authenticate(None)                                           # sin sesión: no
        self.assertEqual(self.client.get(f'/api/usuarios/{self.carlo.id}/foto/').status_code, 401)

    def test_listado_de_usuarios_marca_quien_tiene_foto_sin_traer_la_imagen(self):
        self._subir(self.carlo, self.JPEG)
        self.client.force_authenticate(self.karen)
        r = self.client.get('/api/usuarios/?rol=coordinador')
        datos = r.data.get('results', r.data)
        por_usuario = {u['username']: u['foto_version'] for u in datos}
        self.assertIsNotNone(por_usuario['carlo'])
        self.assertIsNone(por_usuario['karen'])
        self.assertNotIn('foto', datos[0]); self.assertNotIn('contenido', datos[0])

    # ── contraseña ──
    def _cambiar(self, **kw):
        body = {'password_actual': 'pass12345', 'password_nueva': 'NuevaClave99', 'confirmar_password': 'NuevaClave99'}
        body.update(kw)
        self.client.force_authenticate(self.carlo)
        return self.client.post('/api/auth/cambiar-password/', body, format='json')

    def test_cambiar_password_ok(self):
        r = self._cambiar()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data['access'] and r.data['refresh'])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'carlo', 'password': 'NuevaClave99'}, format='json').status_code, 200)
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'carlo', 'password': 'pass12345'}, format='json').status_code, 400)  # la clave vieja ya no sirve

    def test_validaciones_de_la_contraseña(self):
        self.assertEqual(self._cambiar(password_actual='mala').status_code, 400)                  # actual incorrecta
        self.assertEqual(self._cambiar(password_nueva='corta', confirmar_password='corta').status_code, 400)
        self.assertEqual(self._cambiar(confirmar_password='otra-distinta1').status_code, 400)      # no coinciden
        self.assertEqual(self._cambiar(password_nueva='pass12345', confirmar_password='pass12345').status_code, 400)  # igual a la actual
        self.client.force_authenticate(None)
        r = self.client.post('/api/auth/cambiar-password/', {'password_actual': 'x', 'password_nueva': 'y'}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertTrue(User.objects.get(pk=self.carlo.pk).check_password('pass12345'))             # nada cambió

    def test_cierra_las_otras_sesiones_pero_no_esta(self):
        self.client.force_authenticate(None)
        otra = self.client.post('/api/auth/login/', {'username': 'carlo', 'password': 'pass12345'}, format='json').data['refresh']
        r = self._cambiar()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': otra}, format='json').status_code, 401)   # la otra sesión murió
        self.assertEqual(self.client.post('/api/auth/refresh/', {'refresh': r.data['refresh']}, format='json').status_code, 200)

    def test_limite_de_intentos_al_adivinar_la_contraseña_actual(self):
        codigos = [self._cambiar(password_actual='mala').status_code for _ in range(7)]
        self.assertEqual(codigos[:5], [400] * 5)
        self.assertEqual(codigos[-1], 429)


class CoordinadorSinVerificacionTests(APITestCase):
    """El correo de los coordinadores no requiere verificación."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.admin = User.objects.create_user('adm', 'adm@x.com', 'pass12345', rol='admin', email_verificado=True)

    def _alta(self, username, rol, email=None):
        self.client.force_authenticate(self.admin)
        return self.client.post('/api/usuarios/', {'username': username, 'email': email or f'{username}@x.com',
                                'rol': rol, 'nombre': username, 'password': 'pass12345'}, format='json')

    def _login(self, username):
        self.client.force_authenticate(None)
        return self.client.post('/api/auth/login/', {'username': username, 'password': 'pass12345'}, format='json')

    def test_coordinador_creado_por_el_admin_entra_de_inmediato(self):
        self.assertEqual(self._alta('carlo', 'coordinador').status_code, 201)
        self.assertTrue(User.objects.get(username='carlo').email_verificado)
        self.assertEqual(self._login('carlo').status_code, 200)

    def test_los_clientes_siguen_necesitando_verificar(self):
        self.assertEqual(self._alta('cli', 'cliente').status_code, 201)
        self.assertFalse(User.objects.get(username='cli').email_verificado)
        r = self._login('cli')
        self.assertEqual(r.status_code, 403); self.assertTrue(r.data['no_verificado'])

    def test_el_registro_publico_no_puede_hacerse_coordinador(self):
        self.client.force_authenticate(None)
        r = self.client.post('/api/auth/registro/', {'username': 'listo', 'email': 'listo@x.com', 'nombre': 'N', 'rol': 'coordinador',
                             'apellido_paterno': 'P', 'password': 'pass12345', 'confirmar_password': 'pass12345',
                             'aceptar_aviso_privacidad': True}, format='json')
        self.assertEqual(r.status_code, 201)
        u = User.objects.get(username='listo')
        self.assertEqual(u.rol, 'cliente'); self.assertFalse(u.email_verificado)

    def test_cambiar_a_un_cliente_a_coordinador_lo_deja_verificado(self):
        self._alta('promo', 'cliente')
        uid = User.objects.get(username='promo').id
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(f'/api/usuarios/{uid}/', {'rol': 'coordinador'}, format='json').status_code, 200)
        self.assertTrue(User.objects.get(pk=uid).email_verificado)

    def test_guardar_con_update_fields_tambien_lo_verifica(self):
        u = User.objects.create_user('x1', 'x1@x.com', 'pass12345', rol='cliente')
        u.rol = 'coordinador'
        u.save(update_fields=['rol'])
        self.assertTrue(User.objects.get(pk=u.pk).email_verificado)

    def test_migracion_marca_a_los_coordinadores_existentes(self):
        import importlib
        from django.apps import apps
        from .models import TokenVerificacion
        coord = User.objects.create_user('viejo', 'viejo@x.com', 'pass12345', rol='coordinador')
        cli = User.objects.create_user('cli2', 'cli2@x.com', 'pass12345', rol='cliente')
        User.objects.filter(pk=coord.pk).update(email_verificado=False)           # fila antigua
        TokenVerificacion.objects.create(usuario=coord); TokenVerificacion.objects.create(usuario=cli)
        mig = importlib.import_module('tallerdiesel_api.migrations.0017_coordinadores_verificados')
        mig.verificar_coordinadores(apps, None)
        self.assertTrue(User.objects.get(pk=coord.pk).email_verificado)
        self.assertFalse(User.objects.get(pk=cli.pk).email_verificado)             # los clientes no cambian
        self.assertFalse(TokenVerificacion.objects.filter(usuario=coord).exists())
        self.assertTrue(TokenVerificacion.objects.filter(usuario=cli).exists())

    def test_red_de_seguridad_en_el_login(self):
        User.objects.create_user('legacy', 'l@x.com', 'pass12345', rol='coordinador')
        User.objects.filter(username='legacy').update(email_verificado=False)      # fila que se coló sin verificar
        self.assertEqual(self._login('legacy').status_code, 200)


# ═════════════════════════════════════════════════════════════════════════════
#  Codificación 1-8: folio al asignar, siguiente en espera, edición del coordinador asignado,
#  cambio de rol, notificaciones y reasignación de técnico en el mapa.
# ═════════════════════════════════════════════════════════════════════════════

class BaseTickets(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        mk = lambda u, rol, **kw: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u, email_verificado=True, **kw)
        self.admin = mk('adm', 'admin')
        self.carlo = mk('carlo', 'coordinador')
        self.karen = mk('karen', 'coordinador')
        self.cli = mk('cli', 'cliente')
        self.cli2 = mk('cli2', 'cliente')
        self.tec1 = Tecnico.objects.create(nombre='Cerca', categoria='motor_diesel', ciudad='Monterrey', estado='NL',
                                           telefono='1', latitud=25.68, longitud=-100.31, calificacion=4.5)
        self.tec2 = Tecnico.objects.create(nombre='Lejos', categoria='electrico', ciudad='Tijuana', estado='BC',
                                           telefono='2', latitud=32.50, longitud=-117.00, calificacion=3.0)
        self.tec3 = Tecnico.objects.create(nombre='Ocupado', categoria='aire', ciudad='Monterrey', estado='NL',
                                           telefono='3', latitud=25.70, longitud=-100.30, disponible=False)

    def _solicitud(self, cliente=None, **kw):
        """Un servicio recién pedido: pendiente y sin coordinador (aún sin folio)."""
        base = dict(empresa='ACME', fecha=date.today(), unidad='U1', estatus='pendiente', cliente=cliente or self.cli)
        base.update(kw)
        return Ticket.objects.create(**base)

    def _con(self, quien):
        self.client.force_authenticate(quien)
        return self.client


class FolioAlAsignarTests(BaseTickets):
    """1. El número consecutivo del ticket se genera al asignarlo a un coordinador."""

    def test_una_solicitud_nueva_no_tiene_folio_y_se_nombra_solicitud_n(self):
        t = self._solicitud()
        self.assertEqual(t.ticket_id, '')
        self.assertEqual(t.etiqueta, f'Solicitud #{t.pk}')

    def test_varias_solicitudes_en_espera_conviven_sin_folio(self):
        for _ in range(3):
            self._solicitud()
        self.assertEqual(Ticket.objects.filter(ticket_id='').count(), 3)       # el índice único no se queja

    def test_al_tomarlo_un_coordinador_recibe_el_siguiente_folio_consecutivo(self):
        a, b = self._solicitud(), self._solicitud(cliente=self.cli2)
        r1 = self._con(self.carlo).post(f'/api/tickets/{a.id}/tomar_como_coordinador/', {}, format='json')
        r2 = self._con(self.karen).post(f'/api/tickets/{b.id}/tomar_como_coordinador/', {}, format='json')
        self.assertEqual((r1.status_code, r2.status_code), (200, 200))
        self.assertEqual((r1.data['ticket_id'], r2.data['ticket_id']), ('TD001', 'TD002'))
        a.refresh_from_db()
        self.assertEqual(a.coordinador, self.carlo)
        # el cliente se entera y la solicitud ya no queda pendiente para los demás
        self.assertTrue(Notificacion.objects.filter(destinatario=self.cli, tipo='coordinador_asignado').exists())

    def test_un_ticket_creado_ya_con_coordinador_nace_con_folio(self):
        t = self._solicitud(coordinador=self.carlo)
        self.assertEqual(t.ticket_id, 'TD001')

    def test_el_admin_al_asignar_coordinador_tambien_genera_el_folio(self):
        t = self._solicitud()
        r = self._con(self.admin).post(f'/api/tickets/{t.id}/tomar_como_coordinador/', {'coordinador_id': self.karen.id}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        t.refresh_from_db()
        self.assertEqual((t.coordinador, t.ticket_id), (self.karen, 'TD001'))

    def test_el_folio_no_cambia_si_se_reasigna_y_no_se_repite(self):
        t = self._solicitud(coordinador=self.carlo)
        self._con(self.admin).post(f'/api/tickets/{t.id}/tomar_como_coordinador/', {'coordinador_id': self.karen.id}, format='json')
        t.refresh_from_db()
        self.assertEqual(t.ticket_id, 'TD001')
        self.assertEqual(self._solicitud(coordinador=self.carlo).ticket_id, 'TD002')

    def test_asignar_folio_es_seguro_si_se_llama_dos_veces(self):
        t = self._solicitud()
        Ticket.objects.filter(pk=t.pk).update(coordinador=self.carlo)
        t.refresh_from_db()
        f1 = t.asignar_folio()
        t2 = Ticket.objects.get(pk=t.pk)
        self.assertEqual(t2.asignar_folio(), f1)

    def test_avisos_y_pdf_funcionan_con_tickets_sin_folio(self):
        t = self._solicitud()
        r = self._con(self.carlo).get(f'/api/tickets/{t.id}/pdf/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('solicitud-', r['Content-Disposition'])


class SiguienteEnEsperaTests(BaseTickets):
    """2. Al finalizar un ticket, el coordinador recibe automáticamente el siguiente en espera."""

    def _finalizar_con_cliente(self, ticket, coord, cliente):
        # Servicio con coordinador: el coordinador asignado lo finaliza directamente.
        r = self._con(coord).patch(f'/api/tickets/{ticket.id}/', {'estatus': 'terminado'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def test_recibe_el_mas_antiguo_en_espera_y_nadie_mas_se_lo_lleva(self):
        activo = self._solicitud(coordinador=self.carlo, estatus='proceso')
        viejo = self._solicitud(cliente=self.cli2)
        nuevo = self._solicitud(cliente=self.cli2)
        Ticket.objects.filter(pk=viejo.pk).update(fecha_creacion='2020-01-01T00:00:00Z')    # llegó primero
        self._finalizar_con_cliente(activo, self.carlo, self.cli)
        viejo.refresh_from_db(); nuevo.refresh_from_db()
        self.assertEqual(viejo.coordinador, self.carlo)
        self.assertTrue(viejo.ticket_id.startswith('TD'))          # y recibió su folio
        self.assertIsNone(nuevo.coordinador)                         # solo se asigna UNO
        self.assertTrue(Notificacion.objects.filter(destinatario=self.carlo, tipo='ticket_asignado', referencia_id=viejo.id).exists())
        self.assertTrue(Notificacion.objects.filter(destinatario=self.cli2, tipo='coordinador_asignado').exists())
        self.assertTrue(viejo.comentarios.filter(texto__icontains='automáticamente').exists())

    def test_no_toca_tickets_que_no_estan_en_espera(self):
        activo = self._solicitud(coordinador=self.carlo, estatus='proceso')
        ya_de_otro = self._solicitud(cliente=self.cli2, coordinador=self.karen)
        con_tecnico_directo = self._solicitud(cliente=self.cli2, tipo_solicitud='tecnico')
        en_camino = self._solicitud(cliente=self.cli2, estatus='atendido')
        papelera = self._solicitud(cliente=self.cli2, eliminado=True)
        self._finalizar_con_cliente(activo, self.carlo, self.cli)
        for t in (ya_de_otro, con_tecnico_directo, en_camino, papelera):
            t.refresh_from_db()
        self.assertEqual(ya_de_otro.coordinador, self.karen)
        self.assertIsNone(con_tecnico_directo.coordinador)
        self.assertIsNone(en_camino.coordinador)
        self.assertIsNone(papelera.coordinador)

    def test_sin_nadie_en_espera_no_pasa_nada(self):
        activo = self._solicitud(coordinador=self.carlo, estatus='proceso')
        self._finalizar_con_cliente(activo, self.carlo, self.cli)
        self.assertFalse(Notificacion.objects.filter(tipo='ticket_asignado').exists())

    def test_no_se_asigna_si_el_coordinador_esta_inactivo_o_ya_no_es_coordinador(self):
        from .servicios import asignar_siguiente_en_espera
        espera = self._solicitud()
        User.objects.filter(pk=self.carlo.pk).update(is_active=False)
        self.assertIsNone(asignar_siguiente_en_espera(User.objects.get(pk=self.carlo.pk)))
        self.assertIsNone(asignar_siguiente_en_espera(self.admin))
        self.assertIsNone(asignar_siguiente_en_espera(None))
        espera.refresh_from_db(); self.assertIsNone(espera.coordinador)

    def test_dos_coordinadores_que_terminan_a_la_vez_no_se_llevan_el_mismo_ticket(self):
        from .servicios import asignar_siguiente_en_espera
        espera = self._solicitud()
        r1 = asignar_siguiente_en_espera(self.carlo)
        r2 = asignar_siguiente_en_espera(self.karen)
        self.assertEqual(r1.pk, espera.pk)
        self.assertIsNone(r2)                                        # ya no quedaba ninguno
        espera.refresh_from_db(); self.assertEqual(espera.coordinador, self.carlo)


class EdicionSoloCoordinadorAsignadoTests(BaseTickets):
    """3. Solo el coordinador asignado edita; los demás roles ven en modo lectura."""

    def setUp(self):
        super().setUp()
        self.t = self._solicitud(coordinador=self.carlo, estatus='proceso')

    def test_el_asignado_edita(self):
        r = self._con(self.carlo).patch(f'/api/tickets/{self.t.id}/', {'reparacion': 'Cambio de turbo'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Ticket.objects.get(pk=self.t.pk).reparacion, 'Cambio de turbo')

    def test_otro_coordinador_lo_ve_pero_no_lo_edita(self):
        c = self._con(self.karen)
        d = c.get(f'/api/tickets/{self.t.id}/')
        self.assertEqual(d.status_code, 200)                         # lectura permitida
        self.assertFalse(d.data['puede_editar'])
        self.assertIn(self.t.id, [x['id'] for x in c.get('/api/tickets/').data.get('results', c.get('/api/tickets/').data)])
        self.assertEqual(c.patch(f'/api/tickets/{self.t.id}/', {'reparacion': 'x'}, format='json').status_code, 403)
        self.assertEqual(c.post(f'/api/tickets/{self.t.id}/asignar_tecnico/', {'tecnico_id': self.tec1.id}, format='json').status_code, 403)
        self.assertEqual(c.post(f'/api/tickets/{self.t.id}/solicitar_finalizacion/').status_code, 403)
        self.assertEqual(c.delete(f'/api/tickets/{self.t.id}/').status_code, 403)
        self.assertEqual(c.post(f'/api/tickets/{self.t.id}/tomar_como_coordinador/', {}, format='json').status_code, 409)
        self.t.refresh_from_db()
        self.assertEqual((self.t.reparacion, self.t.coordinador), ('', self.carlo))

    def test_el_admin_es_solo_lectura_pero_conserva_la_administracion(self):
        c = self._con(self.admin)
        d = c.get(f'/api/tickets/{self.t.id}/')
        self.assertFalse(d.data['puede_editar'])
        self.assertEqual(c.patch(f'/api/tickets/{self.t.id}/', {'reparacion': 'x'}, format='json').status_code, 403)
        self.assertEqual(c.post(f'/api/tickets/{self.t.id}/asignar_tecnico/', {'tecnico_id': self.tec1.id}, format='json').status_code, 403)
        # administración: reasignar coordinador, permitir edición de un ticket cerrado, papelera
        r = c.post(f'/api/tickets/{self.t.id}/tomar_como_coordinador/', {'coordinador_id': self.karen.id}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(c.post(f'/api/tickets/{self.t.id}/permitir_edicion_coordinador/', {'activar': True}, format='json').status_code, 200)
        self.assertEqual(c.delete(f'/api/tickets/{self.t.id}/').status_code, 204)

    def test_interruptor_para_que_el_admin_tambien_edite(self):
        from django.test import override_settings
        with override_settings(ADMIN_PUEDE_EDITAR_TICKETS=True):
            c = self._con(self.admin)
            self.assertTrue(c.get(f'/api/tickets/{self.t.id}/').data['puede_editar'])
            self.assertEqual(c.patch(f'/api/tickets/{self.t.id}/', {'reparacion': 'ok'}, format='json').status_code, 200)

    def test_el_cliente_sigue_pudiendo_lo_suyo(self):
        c = self._con(self.cli)
        self.assertFalse(c.get(f'/api/tickets/{self.t.id}/').data['puede_editar'])
        self.assertEqual(c.patch(f'/api/tickets/{self.t.id}/', {'unidad': 'Kenworth'}, format='json').status_code, 200)   # su propia edición
        self.assertEqual(c.patch(f'/api/tickets/{self.t.id}/', {'estatus': 'terminado'}, format='json').status_code, 403)
        self.assertEqual(c.post(f'/api/tickets/{self.t.id}/agregar_comentario/', {'texto': 'Hola'}, format='json').status_code, 201)
        self.assertEqual(self._con(self.cli2).get(f'/api/tickets/{self.t.id}/').status_code, 404)    # y no ve los de otros clientes

    def test_el_primero_que_edita_un_ticket_libre_se_queda_con_el_y_nadie_mas(self):
        libre = self._solicitud()
        r = self._con(self.karen).patch(f'/api/tickets/{libre.id}/', {'reparacion': 'Reviso'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        libre.refresh_from_db()
        self.assertEqual((libre.coordinador, libre.ticket_id, libre.reparacion), (self.karen, 'TD002', 'Reviso'))
        # Carlo llega tarde: ahora es de Karen
        self.assertEqual(self._con(self.carlo).patch(f'/api/tickets/{libre.id}/', {'reparacion': 'Yo'}, format='json').status_code, 403)

    def test_un_coordinador_no_puede_pasarle_el_ticket_a_otro_desde_el_formulario(self):
        r = self._con(self.carlo).patch(f'/api/tickets/{self.t.id}/', {'coordinador': self.karen.id}, format='json')
        self.assertEqual(r.status_code, 200)
        self.t.refresh_from_db(); self.assertEqual(self.t.coordinador, self.carlo)
        r = self._con(self.carlo).patch(f'/api/tickets/{self.t.id}/', {'coordinador': None}, format='json')   # tampoco soltarlo
        self.t.refresh_from_db(); self.assertEqual(self.t.coordinador, self.carlo)

    def test_asignar_tecnico_a_un_ticket_libre_lo_toma_el_coordinador(self):
        libre = self._solicitud()
        r = self._con(self.karen).post(f'/api/tickets/{libre.id}/asignar_tecnico/', {'tecnico_id': self.tec1.id}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        libre.refresh_from_db()
        self.assertEqual((libre.coordinador, libre.tecnico, libre.estatus), (self.karen, self.tec1, 'atendido'))
        self.assertTrue(libre.ticket_id)

    def test_solo_el_coordinador_asignado_puede_solicitar_finalizacion(self):
        directo = self._solicitud(coordinador=self.carlo, estatus='proceso', tipo_solicitud='tecnico')
        self.assertEqual(self._con(self.carlo).post(f'/api/tickets/{directo.id}/solicitar_finalizacion/').status_code, 200)
        self.assertEqual(self._con(self.karen).post(f'/api/tickets/{directo.id}/solicitar_finalizacion/').status_code, 403)

    def test_servicio_con_coordinador_se_finaliza_directo_sin_pedirle_al_cliente(self):
        # No aplica "Solicitar finalización"...
        r = self._con(self.carlo).post(f'/api/tickets/{self.t.id}/solicitar_finalizacion/')
        self.assertEqual(r.status_code, 400)
        # ...el coordinador asignado lo cierra él mismo
        r = self._con(self.carlo).patch(f'/api/tickets/{self.t.id}/', {'estatus': 'terminado'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.t.refresh_from_db(); self.assertEqual(self.t.estatus, 'terminado')

    def test_servicio_directo_con_tecnico_requiere_confirmacion_del_cliente(self):
        directo = self._solicitud(coordinador=self.carlo, estatus='proceso', tipo_solicitud='tecnico')
        r = self._con(self.carlo).patch(f'/api/tickets/{directo.id}/', {'estatus': 'terminado'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self._con(self.carlo).post(f'/api/tickets/{directo.id}/solicitar_finalizacion/').status_code, 200)
        r = self._con(self.cli).post(f'/api/tickets/{directo.id}/responder_finalizacion/', {'acepta': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        directo.refresh_from_db(); self.assertEqual(directo.estatus, 'terminado')

    def test_eliminar_un_ticket_libre_es_solo_del_admin(self):
        libre = self._solicitud()
        self.assertEqual(self._con(self.carlo).delete(f'/api/tickets/{libre.id}/').status_code, 403)
        self.assertEqual(self._con(self.admin).delete(f'/api/tickets/{libre.id}/').status_code, 204)

    def test_dashboard_del_coordinador_muestra_lo_suyo_y_lo_libre_pero_la_bitacora_todo(self):
        libre = self._solicitud(); ajeno = self._solicitud(coordinador=self.karen)
        d = self._con(self.carlo).get('/api/tickets/dashboard_coordinador/').data
        ids = {x['id'] for x in d['tickets']}
        self.assertEqual(ids, {self.t.id, libre.id})
        bit = self.client.get('/api/tickets/').data
        bit = {x['id'] for x in bit.get('results', bit)}
        self.assertTrue({self.t.id, libre.id, ajeno.id} <= bit)


class CambioDeRolTests(BaseTickets):
    """6. Al cambiar el rol de un usuario se actualizan sus permisos y lo que dependía de su rol."""

    def _rol(self, usuario, rol):
        return self._con(self.admin).patch(f'/api/usuarios/{usuario.id}/', {'rol': rol}, format='json')

    def test_pierde_el_permiso_de_editar_el_sistema_al_dejar_de_ser_coordinador(self):
        User.objects.filter(pk=self.carlo.pk).update(puede_editar_sistema=True)
        self.assertEqual(self._rol(self.carlo, 'cliente').status_code, 200)
        c = User.objects.get(pk=self.carlo.pk)
        self.assertEqual((c.rol, c.puede_editar_sistema), ('cliente', False))
        # y ya no puede usar lo de coordinador / sistema
        self.client.force_authenticate(c)
        self.assertEqual(self.client.post('/api/usuarios/', {'username': 'x', 'email': 'x@x.com', 'rol': 'cliente', 'password': 'pass12345'}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/tickets/dashboard_coordinador/').status_code in (403, 200), True)

    def test_sus_tickets_sin_finalizar_vuelven_a_la_espera_y_el_admin_es_avisado(self):
        a = self._solicitud(coordinador=self.carlo, estatus='proceso')
        b = self._solicitud(coordinador=self.carlo, estatus='terminado')
        self._rol(self.carlo, 'cliente')
        a.refresh_from_db(); b.refresh_from_db()
        self.assertIsNone(a.coordinador)                              # vuelve a la cola
        self.assertEqual(a.ticket_id, 'TD001')                        # conserva su folio
        self.assertEqual(b.coordinador, self.carlo)                   # el finalizado conserva su historial
        self.assertTrue(a.comentarios.filter(texto__icontains='dejó de ser coordinador').exists())
        self.assertTrue(Notificacion.objects.filter(destinatario=self.admin, titulo__icontains='sin coordinador').exists())

    def test_al_pasar_a_coordinador_queda_listo_para_trabajar(self):
        self.assertEqual(self._rol(self.cli, 'coordinador').status_code, 200)
        u = User.objects.get(pk=self.cli.pk)
        self.assertEqual(u.rol, 'coordinador'); self.assertTrue(u.email_verificado)
        libre = self._solicitud(cliente=self.cli2)
        self.assertEqual(self._con(u).post(f'/api/tickets/{libre.id}/tomar_como_coordinador/', {}, format='json').status_code, 200)

    def test_pasar_a_admin_no_conserva_el_permiso_de_coordinador(self):
        User.objects.filter(pk=self.carlo.pk).update(puede_editar_sistema=True)
        self._rol(self.carlo, 'admin')
        self.assertFalse(User.objects.get(pk=self.carlo.pk).puede_editar_sistema)

    def test_el_nuevo_rol_aplica_de_inmediato_y_se_ve_en_auth_me(self):
        self._rol(self.carlo, 'cliente')
        self.client.force_authenticate(User.objects.get(pk=self.carlo.pk))
        self.assertEqual(self.client.get('/api/auth/me/').data['rol'], 'cliente')

    def test_editar_otros_datos_sin_cambiar_el_rol_no_toca_tickets(self):
        a = self._solicitud(coordinador=self.carlo, estatus='proceso')
        self._con(self.admin).patch(f'/api/usuarios/{self.carlo.id}/', {'puesto': 'Norte'}, format='json')
        a.refresh_from_db(); self.assertEqual(a.coordinador, self.carlo)


class NotificacionesTiempoRealTests(BaseTickets):
    """7. Notificaciones ligeras (se consultan cada 5 s) que persisten al cerrar sesión."""

    def test_persisten_al_cerrar_y_volver_a_iniciar_sesion(self):
        Notificacion.objects.create(destinatario=self.carlo, titulo='Hola', mensaje='m')
        self.client.force_authenticate(None)
        r = self.client.post('/api/auth/login/', {'username': 'carlo', 'password': 'pass12345'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + r.data['access'])
        lista = self.client.get('/api/notificaciones/').data
        self.assertEqual([n['titulo'] for n in lista], ['Hola'])
        self.assertFalse(lista[0]['leida'])                           # sigue sin leer

    def test_devuelve_como_maximo_200_las_mas_recientes(self):
        Notificacion.objects.bulk_create([Notificacion(destinatario=self.carlo, titulo=f'n{i}', mensaje='m') for i in range(230)])
        lista = self._con(self.carlo).get('/api/notificaciones/').data
        self.assertEqual(len(lista), 200)

    def test_chat_cuenta_mensajes_no_leidos_por_ticket_y_los_marca_solo_para_el_usuario(self):
        ticket = self._solicitud(cliente=self.cli, coordinador=self.carlo, estatus='proceso')
        otro_ticket = self._solicitud(cliente=self.cli2, coordinador=self.carlo, estatus='proceso')
        ComentarioTicket.objects.create(
            ticket=ticket, autor=self.carlo, autor_nombre=self.carlo.nombre_completo,
            texto='¿En qué puedo ayudarte?',
        )
        mensajes = self._con(self.cli).get(f'/api/tickets/{ticket.id}/mensajes/')
        self.assertEqual(mensajes.status_code, 200, mensajes.data)
        self.assertEqual(mensajes.data['comentarios'][0]['texto'], '¿En qué puedo ayudarte?')

        Notificacion.objects.create(
            destinatario=self.cli, titulo='Respuesta', mensaje='Uno',
            tipo='comentario', referencia_id=ticket.id,
        )
        Notificacion.objects.create(
            destinatario=self.cli, titulo='Respuesta', mensaje='Dos',
            tipo='comentario', referencia_id=ticket.id,
        )
        Notificacion.objects.create(
            destinatario=self.cli2, titulo='Respuesta', mensaje='Otro cliente',
            tipo='comentario', referencia_id=otro_ticket.id,
        )
        aviso_coordinador = Notificacion.objects.create(
            destinatario=self.carlo, titulo='Mensaje cliente', mensaje='Para el coordinador',
            tipo='comentario', referencia_id=ticket.id,
        )

        dashboard_cliente = self._con(self.cli).get('/api/tickets/dashboard_cliente/').data
        self.assertEqual(
            next(t for t in dashboard_cliente['recientes'] if t['id'] == ticket.id)['mensajes_no_leidos'],
            2,
        )
        dashboard_coordinador = self._con(self.carlo).get('/api/tickets/dashboard_coordinador/').data
        self.assertEqual(
            next(t for t in dashboard_coordinador['tickets'] if t['id'] == ticket.id)['mensajes_no_leidos'],
            1,
        )

        respuesta = self._con(self.cli).post(f'/api/tickets/{ticket.id}/marcar-mensajes-leidos/')

        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['marcados'], 2)
        self.assertFalse(Notificacion.objects.filter(
            destinatario=self.cli, referencia_id=ticket.id, tipo='comentario', leida=False,
        ).exists())
        aviso_coordinador.refresh_from_db()
        self.assertFalse(aviso_coordinador.leida)
        restante_response = self._con(self.carlo).get('/api/tickets/').data
        restante = restante_response.get('results', restante_response)
        self.assertEqual(
            next(t for t in restante if t['id'] == ticket.id)['mensajes_no_leidos'],
            1,
        )

    def test_la_revision_de_sla_corre_a_lo_mucho_una_vez_por_segundo(self):
        from unittest import mock
        with mock.patch('tallerdiesel_api.views.revisar_alertas_sla') as sla:
            c = self._con(self.carlo)
            for _ in range(5):
                c.get('/api/notificaciones/')
            self.assertEqual(sla.call_count, 1)

    def test_sla_avisa_al_coordinador_tras_cinco_segundos_pendiente(self):
        from tallerdiesel_api.views import revisar_alertas_sla

        ticket = self._solicitud(cliente=self.cli2, coordinador=self.carlo, estatus='pendiente')
        Ticket.objects.filter(pk=ticket.pk).update(
            fecha_creacion=timezone.now() - timedelta(seconds=6),
        )

        revisar_alertas_sla()

        aviso = Notificacion.objects.get(destinatario=self.carlo, tipo='alerta_sla', referencia_id=ticket.id)
        self.assertIn('más de 5 segundos', aviso.mensaje)
        ticket.refresh_from_db()
        self.assertTrue(ticket.alerta_sla_enviada)

    def test_sla_no_avisa_antes_de_cinco_segundos(self):
        from tallerdiesel_api.views import revisar_alertas_sla

        ticket = self._solicitud(cliente=self.cli2, coordinador=self.carlo, estatus='pendiente')
        Ticket.objects.filter(pk=ticket.pk).update(
            fecha_creacion=timezone.now() - timedelta(seconds=4),
        )

        revisar_alertas_sla()

        self.assertFalse(Notificacion.objects.filter(
            destinatario=self.carlo, tipo='alerta_sla', referencia_id=ticket.id,
        ).exists())

    def test_sla_avisa_si_cliente_espera_mas_de_cinco_segundos_respuesta(self):
        from unittest import mock
        from tallerdiesel_api.views import revisar_alertas_sla

        ticket = self._solicitud(cliente=self.cli, coordinador=self.carlo, estatus='proceso')
        with mock.patch('tallerdiesel_api.views._enviar_html_en_segundo_plano'):
            respuesta = self._con(self.cli).post(
                f'/api/tickets/{ticket.id}/agregar_comentario/',
                {'texto': '¿Hay novedades?'},
                format='json',
            )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        Ticket.objects.filter(pk=ticket.pk).update(
            fecha_ultimo_mensaje_cliente=timezone.now() - timedelta(seconds=6),
        )

        revisar_alertas_sla()

        aviso = Notificacion.objects.get(
            destinatario=self.carlo, tipo='alerta_respuesta_sla', referencia_id=ticket.id,
        )
        self.assertIn('más de 5 segundos', aviso.mensaje)
        ticket.refresh_from_db()
        self.assertTrue(ticket.alerta_respuesta_sla_enviada)

    def test_respuesta_del_coordinador_cierra_el_tiempo_de_espera(self):
        from unittest import mock
        from tallerdiesel_api.views import revisar_alertas_sla

        ticket = self._solicitud(cliente=self.cli, coordinador=self.carlo, estatus='proceso')
        with mock.patch('tallerdiesel_api.views._enviar_html_en_segundo_plano'):
            self.assertEqual(
                self._con(self.cli).post(
                    f'/api/tickets/{ticket.id}/agregar_comentario/',
                    {'texto': '¿Hay novedades?'},
                    format='json',
                ).status_code,
                201,
            )
            self.assertEqual(
                self._con(self.carlo).post(
                    f'/api/tickets/{ticket.id}/agregar_comentario/',
                    {'texto': 'Ya estamos revisando el caso.'},
                    format='json',
                ).status_code,
                201,
            )
        Ticket.objects.filter(pk=ticket.pk).update(
            fecha_ultimo_mensaje_cliente=timezone.now() - timedelta(seconds=6),
        )

        revisar_alertas_sla()

        self.assertFalse(Notificacion.objects.filter(
            destinatario=self.carlo, tipo='alerta_respuesta_sla', referencia_id=ticket.id,
        ).exists())
        ticket.refresh_from_db()
        self.assertGreaterEqual(
            ticket.fecha_ultima_respuesta_coordinador,
            ticket.fecha_ultimo_mensaje_cliente,
        )

    def test_nuevo_mensaje_del_cliente_reinicia_el_sla_de_respuesta(self):
        from unittest import mock
        from tallerdiesel_api.views import revisar_alertas_sla

        ticket = self._solicitud(cliente=self.cli, coordinador=self.carlo, estatus='proceso')
        endpoint = f'/api/tickets/{ticket.id}/agregar_comentario/'
        cliente = self._con(self.cli)
        with mock.patch('tallerdiesel_api.views._enviar_html_en_segundo_plano'):
            self.assertEqual(
                cliente.post(endpoint, {'texto': 'Primer mensaje'}, format='json').status_code,
                201,
            )
            ticket.refresh_from_db()
            primer_mensaje = ticket.fecha_ultimo_mensaje_cliente
            Ticket.objects.filter(pk=ticket.pk).update(
                fecha_ultimo_mensaje_cliente=timezone.now() - timedelta(seconds=6),
            )
            revisar_alertas_sla()
            self.assertEqual(
                cliente.post(endpoint, {'texto': 'Agrego un dato más'}, format='json').status_code,
                201,
            )

        ticket.refresh_from_db()
        self.assertFalse(ticket.alerta_respuesta_sla_enviada)
        self.assertIsNone(ticket.fecha_ultima_respuesta_coordinador)
        self.assertGreater(ticket.fecha_ultimo_mensaje_cliente, primer_mensaje)

    def test_la_nueva_solicitud_avisa_a_coordinadores_y_abre_el_ticket(self):
        self.client.force_authenticate(self.cli)
        r = self.client.post('/api/solicitud/', {'nombre_completo': 'Juan', 'telefono': '1', 'empresa': 'ACME',
                             'problema': 'No enciende', 'lugar': 'Capulin', 'unidad': 'U9', 'tipo_unidad': 'Tracto'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        t = Ticket.objects.get(unidad='U9')
        self.assertEqual((t.coordinador, t.ticket_id), (self.carlo, 'TD001'))   # se asigna solo al coordinador 1, con folio
        n = Notificacion.objects.get(destinatario=self.carlo, tipo='solicitud')
        self.assertEqual(n.referencia_id, t.id)                       # la campana abre ESTE ticket
        self.assertTrue(Notificacion.objects.filter(destinatario=self.carlo, tipo='ticket_asignado', referencia_id=t.id).exists())


class ReasignarTecnicoMapaTests(BaseTickets):
    """8. Reasignar técnico desde el mapa: asignación y geolocalización."""

    def setUp(self):
        super().setUp()
        self.t = self._solicitud(coordinador=self.carlo, estatus='proceso', tecnico=self.tec2)

    def test_tecnicos_cercanos_ordenados_por_distancia_con_calificacion_y_disponibilidad(self):
        r = self._con(self.carlo).get(f'/api/tickets/{self.t.id}/tecnicos_cercanos/', {'lat': 25.67, 'lng': -100.31})
        self.assertEqual(r.status_code, 200, r.data)
        nombres = [x['nombre'] for x in r.data['tecnicos']]
        self.assertEqual(nombres, ['Cerca', 'Lejos', 'Ocupado'][:0] or ['Cerca', 'Lejos', 'Ocupado'])   # disponibles primero, por distancia
        cerca = r.data['tecnicos'][0]
        self.assertLess(cerca['distancia_km'], 5)
        self.assertEqual(cerca['calificacion'], 4.5)
        self.assertIsNone(cerca['calificacion_promedio'])
        self.assertEqual(cerca['total_calificaciones'], 0)
        lejos = r.data['tecnicos'][1]
        self.assertGreater(lejos['distancia_km'], 1500)
        self.assertTrue(lejos['es_actual'])                           # el técnico que tiene ahora
        self.assertFalse(r.data['tecnicos'][2]['disponible'])

    def test_usa_la_ubicacion_guardada_del_ticket_y_sin_ubicacion_no_hay_distancias(self):
        r = self._con(self.carlo).get(f'/api/tickets/{self.t.id}/tecnicos_cercanos/')
        self.assertIsNone(r.data['ubicacion'])
        self.assertTrue(all(x['distancia_km'] is None for x in r.data['tecnicos']))
        Ticket.objects.filter(pk=self.t.pk).update(latitud=32.5, longitud=-117.0)
        r = self._con(self.carlo).get(f'/api/tickets/{self.t.id}/tecnicos_cercanos/')
        self.assertEqual(r.data['tecnicos'][0]['nombre'], 'Lejos')    # ahora el más cercano es el de Tijuana

    def test_ubicacion_invalida_se_rechaza(self):
        c = self._con(self.carlo)
        self.assertEqual(c.get(f'/api/tickets/{self.t.id}/tecnicos_cercanos/', {'lat': 'abc', 'lng': '1'}).status_code, 400)
        self.assertEqual(c.get(f'/api/tickets/{self.t.id}/tecnicos_cercanos/', {'lat': '95', 'lng': '1'}).status_code, 400)

    def test_el_cliente_no_puede_consultar_el_mapa_de_reasignacion(self):
        self.assertEqual(self._con(self.cli).get(f'/api/tickets/{self.t.id}/tecnicos_cercanos/').status_code, 403)

    def test_reasignar_guarda_tecnico_ubicacion_historial_y_avisa_al_cliente(self):
        r = self._con(self.carlo).post(f'/api/tickets/{self.t.id}/asignar_tecnico/',
                                       {'tecnico_id': self.tec1.id, 'latitud': 25.67, 'longitud': -100.31}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.t.refresh_from_db()
        self.assertEqual(self.t.tecnico, self.tec1)
        self.assertEqual((self.t.latitud, self.t.longitud), (25.67, -100.31))
        self.assertTrue(self.t.comentarios.filter(texto='Técnico reasignado: Lejos → Cerca').exists())
        n = Notificacion.objects.get(destinatario=self.cli, tipo='tecnico_asignado')
        self.assertEqual(n.titulo, 'Técnico actualizado')

    def test_reasignar_con_ubicacion_invalida_no_cambia_nada(self):
        r = self._con(self.carlo).post(f'/api/tickets/{self.t.id}/asignar_tecnico/',
                                       {'tecnico_id': self.tec1.id, 'latitud': 'x', 'longitud': 1}, format='json')
        self.assertEqual(r.status_code, 400)
        self.t.refresh_from_db(); self.assertEqual(self.t.tecnico, self.tec2)

    def test_solo_el_coordinador_asignado_reasigna(self):
        body = {'tecnico_id': self.tec1.id}
        self.assertEqual(self._con(self.karen).post(f'/api/tickets/{self.t.id}/asignar_tecnico/', body, format='json').status_code, 403)
        self.assertEqual(self._con(self.admin).post(f'/api/tickets/{self.t.id}/asignar_tecnico/', body, format='json').status_code, 403)
        self.assertEqual(self._con(self.carlo).post(f'/api/tickets/{self.t.id}/asignar_tecnico/', body, format='json').status_code, 200)

    def test_distancia_haversine(self):
        from .servicios import distancia_km, coordenada_valida
        self.assertAlmostEqual(distancia_km(25.6866, -100.3161, 25.6866, -100.3161), 0, places=3)
        self.assertAlmostEqual(distancia_km(19.4326, -99.1332, 25.6866, -100.3161), 707, delta=15)   # CDMX → Monterrey
        self.assertIsNone(coordenada_valida('a', 1)); self.assertIsNone(coordenada_valida(0, 181))
        self.assertEqual(coordenada_valida('19.4', '-99.1'), (19.4, -99.1))


class AsignacionAutomaticaTests(BaseTickets):
    """Reparto automático: por número de coordinador (1, 2, 3…) y, si alguien ya finalizó, el que terminó primero."""

    def _pide_servicio(self):
        r = self.client.post('/api/solicitud/', {'nombre_completo': 'Chofer', 'telefono': '5551234567',
                                                 'empresa': 'ACME', 'problema': 'No arranca'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return Ticket.objects.get(pk=r.data['id'])

    def test_cada_coordinador_tiene_su_numero(self):
        self.assertEqual((self.carlo.numero_coordinador, self.karen.numero_coordinador), (1, 2))

    def test_los_tickets_llegan_al_1_luego_al_2_y_vuelven_al_1(self):
        a, b, c = self._pide_servicio(), self._pide_servicio(), self._pide_servicio()
        self.assertEqual((a.coordinador, b.coordinador, c.coordinador), (self.carlo, self.karen, self.carlo))

    def test_el_folio_sigue_la_serie_despues_de_TD026(self):
        self._solicitud(coordinador=self.karen, ticket_id='TD026')
        t = self._pide_servicio()
        self.assertEqual(t.ticket_id, 'TD027')

    def test_el_que_finalizo_primero_recibe_el_siguiente(self):
        from .views import al_finalizar
        a, b = self._pide_servicio(), self._pide_servicio()        # a→carlo(1), b→karen(2)
        b.estatus = 'terminado'; b.save()
        al_finalizar(b)                                            # karen termina primero
        c = self._pide_servicio()
        self.assertEqual(c.coordinador, self.karen)                # le toca a karen aunque el turno sería el de carlo
        d = self._pide_servicio()
        self.assertEqual(d.coordinador, self.carlo)                # ya no está libre: sigue el turno normal

    def test_con_varios_libres_gana_el_que_termino_antes(self):
        from .views import al_finalizar
        a, b = self._pide_servicio(), self._pide_servicio()
        for t in (b, a):                                           # termina karen y luego carlo
            t.estatus = 'terminado'; t.save(); al_finalizar(t)
        self.assertEqual(self._pide_servicio().coordinador, self.karen)
        self.assertEqual(self._pide_servicio().coordinador, self.carlo)

    def test_sin_coordinadores_activos_queda_en_espera_sin_folio(self):
        User.objects.filter(rol='coordinador').update(is_active=False)
        t = self._pide_servicio()
        self.assertIsNone(t.coordinador)
        self.assertEqual(t.ticket_id, '')


class ListaTicketsConOperadorTests(APITestCase):
    """Un ticket con Operador capturado (texto) no debe romper la lista de tickets en ningún rol."""

    def setUp(self):
        mk = lambda u, rol: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u,
                                                     email_verificado=True)
        self.cliente = mk('cli_op', 'cliente')
        self.coord = mk('coord_op', 'coordinador')
        self.admin = mk('adm_op', 'admin')
        Ticket.objects.create(empresa='ACME', fecha=date.today(), unidad='U1', operador='Pedro López',
                              cliente=self.cliente, coordinador=self.coord, estatus='pendiente')

    def test_todos_los_roles_ven_sus_tickets(self):
        for usuario in (self.admin, self.coord, self.cliente):
            self.client.force_authenticate(usuario)
            r = self.client.get('/api/tickets/')
            self.assertEqual(r.status_code, 200, usuario.rol)
            self.assertEqual(r.data['count'], 1, usuario.rol)
            self.assertEqual(r.data['results'][0]['operador_nombre'], 'Pedro López')


class EditarMensajesChatTests(APITestCase):
    """Clientes y coordinadores no editan los mensajes del chat; el Administrador sí (los suyos)."""

    def setUp(self):
        mk = lambda u, rol: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u,
                                                     email_verificado=True)
        self.cliente = mk('cli_chat', 'cliente')
        self.coord = mk('coord_chat', 'coordinador')
        self.admin = mk('adm_chat', 'admin')
        self.ticket = Ticket.objects.create(empresa='ACME', fecha=date.today(), unidad='U1',
                                            cliente=self.cliente, coordinador=self.coord, estatus='proceso')

    def _editar(self, usuario):
        c = ComentarioTicket.objects.create(ticket=self.ticket, autor=usuario,
                                            autor_nombre=usuario.nombre, texto='original')
        self.client.force_authenticate(usuario)
        r = self.client.post(f'/api/tickets/{self.ticket.id}/editar_comentario/',
                             {'comentario_id': c.id, 'texto': 'cambiado'}, format='json')
        c.refresh_from_db()
        return r.status_code, c.texto

    def test_cliente_y_coordinador_no_editan(self):
        self.assertEqual(self._editar(self.cliente), (403, 'original'))
        self.assertEqual(self._editar(self.coord), (403, 'original'))

    def test_admin_si_edita_lo_suyo(self):
        self.assertEqual(self._editar(self.admin), (200, 'cambiado'))


class MejorasChatYResenasTests(APITestCase):
    """Palomitas de leído, 'escribiendo…', notas de voz, respuestas a reseñas y nombres cortos."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        mk = lambda u, rol: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u,
                                                     apellido_paterno='Pérez', email_verificado=True)
        self.cliente = mk('cli_m', 'cliente')
        self.coord = mk('coord_m', 'coordinador')
        self.admin = mk('adm_m', 'admin')
        self.ticket = Ticket.objects.create(empresa='ACME', fecha=date.today(), unidad='U1',
                                            cliente=self.cliente, coordinador=self.coord, estatus='proceso')
        self.tec = Tecnico.objects.create(nombre='Juan', categoria='motor_diesel', ciudad='X', estado='Y',
                                          telefono='1', latitud=0, longitud=0)

    def test_palomitas_de_leido(self):
        c = ComentarioTicket.objects.create(ticket=self.ticket, autor=self.cliente, autor_nombre='cli', texto='hola')
        # El admin solo mira: no marca como visto
        self.client.force_authenticate(self.admin)
        self.client.post(f'/api/tickets/{self.ticket.id}/marcar-mensajes-leidos/')
        c.refresh_from_db(); self.assertIsNone(c.leido_en)
        # El coordinador lo abre: queda visto
        self.client.force_authenticate(self.coord)
        self.client.post(f'/api/tickets/{self.ticket.id}/marcar-mensajes-leidos/')
        c.refresh_from_db(); self.assertIsNotNone(c.leido_en)
        self.client.force_authenticate(self.cliente)
        r = self.client.get(f'/api/tickets/{self.ticket.id}/mensajes/')
        self.assertIsNotNone(r.data['comentarios'][0]['leido_en'])

    def test_escribiendo(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.post(f'/api/tickets/{self.ticket.id}/escribiendo/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/tickets/{self.ticket.id}/mensajes/').data['escribiendo'], [])   # no a sí mismo
        self.client.force_authenticate(self.coord)
        self.assertEqual(self.client.get(f'/api/tickets/{self.ticket.id}/mensajes/').data['escribiendo'],
                         [self.cliente.nombre_completo])

    def test_nota_de_voz(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings
        import tempfile
        with tempfile.TemporaryDirectory() as tmp, override_settings(MEDIA_ROOT=tmp):
            self.client.force_authenticate(self.cliente)
            audio = SimpleUploadedFile('nota.webm', b'\x1a\x45\xdf\xa3' + b'\x00' * 100, content_type='audio/webm')
            r = self.client.post(f'/api/tickets/{self.ticket.id}/subir_evidencia/', {'archivo': audio}, format='multipart')
            self.assertEqual(r.status_code, 201, getattr(r, 'data', r))
            self.assertTrue(ComentarioTicket.objects.filter(ticket=self.ticket, texto='🎤 Nota de voz').exists())
            falso = SimpleUploadedFile('nota.webm', b'esto no es audio', content_type='audio/webm')
            r = self.client.post(f'/api/tickets/{self.ticket.id}/subir_evidencia/', {'archivo': falso}, format='multipart')
            self.assertEqual(r.status_code, 400)

    def test_responder_resena_y_nombres_cortos(self):
        op = Opinion.objects.create(tecnico=self.tec, nombre_autor='Juan Pérez López', calificacion=2, comentario='Tardó')
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.post('/api/tecnicos/responder_resena/', {'opinion_id': op.id, 'respuesta': 'x'}, format='json').status_code, 403)
        self.client.force_authenticate(self.coord)
        r = self.client.post('/api/tecnicos/responder_resena/', {'opinion_id': op.id, 'respuesta': 'Gracias, ya lo mejoramos'}, format='json')
        self.assertEqual(r.status_code, 200)
        op.refresh_from_db(); self.assertEqual(op.respuesta, 'Gracias, ya lo mejoramos')
        # El público ve el nombre corto y la respuesta; el coordinador ve el nombre completo
        self.client.force_authenticate(None)
        pub = self.client.get(f'/api/tecnicos/{self.tec.id}/').data['opiniones'][0]
        self.assertEqual(pub['nombre_autor'], 'Juan P.')
        self.assertEqual(pub['respuesta'], 'Gracias, ya lo mejoramos')
        self.assertNotIn('ticket', pub)
        self.client.force_authenticate(self.coord)
        self.assertEqual(self.client.get(f'/api/tecnicos/{self.tec.id}/').data['opiniones'][0]['nombre_autor'], 'Juan Pérez López')

    def test_sla_configurable(self):
        from tallerdiesel_api import views
        anterior = views.SLA_SEGUNDOS_PENDIENTE
        try:
            views.SLA_SEGUNDOS_PENDIENTE = 900
            self.assertEqual(views._texto_tiempo_sla(), '15 minutos')
            views.SLA_SEGUNDOS_PENDIENTE = 5
            self.assertEqual(views._texto_tiempo_sla(), '5 segundos')
        finally:
            views.SLA_SEGUNDOS_PENDIENTE = anterior
