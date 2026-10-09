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