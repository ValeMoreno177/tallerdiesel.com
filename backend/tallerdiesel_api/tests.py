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

    def test_el_admin_edita_todos_los_tickets(self):
        # El Administrador puede editar cualquier ticket (también finalizarlo)
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f'/api/tickets/{self.ticket.id}/', {'estatus': 'terminado'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.estatus, 'terminado')

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

    def test_el_correo_de_una_cuenta_desactivada_se_puede_volver_a_usar(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(f'/api/usuarios/{self.cliente.id}/', {'is_active': False},
                                           format='json').status_code, 200)
        # el Administrador da de alta otra cuenta con ese correo
        r = self._alta(self.admin, 'cli_nuevo', 'cli@x.com', rol='cliente')
        self.assertEqual(r.status_code, 201, r.data)
        # y el registro público también lo acepta si la cuenta anterior está desactivada
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/usuarios/{r.data["id"]}/', {'is_active': False}, format='json')
        self.client.force_authenticate(None)
        body = {'username': 'nuevo2', 'email': 'CLI@x.com', 'nombre': 'N', 'apellido_paterno': 'P',
                'password': 'pass12345', 'confirmar_password': 'pass12345', 'aceptar_aviso_privacidad': True}
        self.assertEqual(self.client.post('/api/auth/registro/', body, format='json').status_code, 201)

    def test_no_se_reactiva_si_su_correo_ya_lo_usa_otra_cuenta_activa(self):
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/usuarios/{self.cliente.id}/', {'is_active': False}, format='json')
        self.assertEqual(self._alta(self.admin, 'cli_nuevo', 'cli@x.com', rol='cliente').status_code, 201)
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f'/api/usuarios/{self.cliente.id}/', {'is_active': True}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('No se puede reactivar', str(r.data['email']))
        # con otro correo sí se puede reactivar
        r = self.client.patch(f'/api/usuarios/{self.cliente.id}/', {'is_active': True, 'email': 'otro@x.com'},
                              format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def test_reactivar_sin_conflicto_funciona(self):
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/usuarios/{self.cliente.id}/', {'is_active': False}, format='json')
        r = self.client.patch(f'/api/usuarios/{self.cliente.id}/', {'is_active': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

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
        # (los coordinadores se verifican solos; se simula una fila antigua sin verificar saltando 
