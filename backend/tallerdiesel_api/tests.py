from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Notificacion, Opinion, Tecnico, Ticket

User = get_user_model()


class CalificacionServicioTests(APITestCase):
    """Al finalizar un servicio se pide al cliente calificar al técnico y al servicio."""

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
                                            tecnico=self.tec, estatus='proceso')

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

    def test_finalizar_por_admin_tambien_pide_calificar(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f'/api/tickets/{self.ticket.id}/', {'estatus': 'terminado'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Notificacion.objects.filter(destinatario=self.cliente, tipo='calificar_servicio').count(), 1)

    def test_calificar_ok_y_no_se_repite(self):
        self._finalizar_con_cliente()
        url = f'/api/tickets/{self.ticket.id}/calificar/'
        # faltan estrellas
        self.assertEqual(self.client.post(url, {'calificacion_servicio': 5}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'calificacion_servicio': 6, 'calificacion_tecnico': 4}, format='json').status_code, 400)
        # comentario opcional
        r = self.client.post(url, {'calificacion_servicio': 4, 'calificacion_tecnico': 2}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.post(url, {'calificacion_servicio': 5, 'calificacion_tecnico': 5}, format='json').status_code, 400)
        self.tec.refresh_from_db()
        self.assertEqual(self.tec.calificacion, 2)
        op = Opinion.objects.get(ticket=self.ticket)
        self.assertEqual((op.calificacion, op.calificacion_servicio, op.comentario), (2, 4, ''))
        # ya no está pendiente y el aviso de la campana queda leído
        self.assertEqual(self.client.get('/api/tickets/pendientes_calificar/').data, [])
        self.assertFalse(Notificacion.objects.filter(tipo='calificar_servicio', leida=False).exists())
        d = self.client.get(f'/api/tickets/{self.ticket.id}/').data
        self.assertTrue(d['calificado'])
        self.assertFalse(d['puede_calificar'])
        self.assertEqual(d['calificacion_detalle']['calificacion_servicio'], 4)

    def test_no_se_califica_si_no_esta_finalizado_ni_ajeno_ni_staff(self):
        url = f'/api/tickets/{self.ticket.id}/calificar/'
        body = {'calificacion_servicio': 5, 'calificacion_tecnico': 5}
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.post(url, body, format='json').status_code, 403)  # no finalizado (permiso)
        self.ticket.estatus = 'terminado'; self.ticket.save()
        self.client.force_authenticate(self.otro)
        self.assertEqual(self.client.post(url, body, format='json').status_code, 404)  # ticket de otro cliente
        self.client.force_authenticate(self.coord)
        self.assertEqual(self.client.post(url, body, format='json').status_code, 403)  # staff no califica

    def test_sin_tecnico_solo_califica_el_servicio(self):
        self.ticket.tecnico = None; self.ticket.estatus = 'terminado'; self.ticket.save()
        self.client.force_authenticate(self.cliente)
        r = self.client.post(f'/api/tickets/{self.ticket.id}/calificar/',
                             {'calificacion_servicio': 5, 'comentario': ' Excelente '}, format='json')
        self.assertEqual(r.status_code, 201)
        op = Opinion.objects.get(ticket=self.ticket)
        self.assertIsNone(op.tecnico); self.assertEqual(op.comentario, 'Excelente')

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