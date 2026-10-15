"""
Borra TODOS los tickets (servicios) de la base de datos para que el siguiente folio sea TD001.

Se borra: tickets (incluidos los de la papelera), comentarios/chat, evidencias (y sus archivos),
solicitudes de servicio y las notificaciones de servicios.
NO se borra: usuarios, clientes, técnicos, empresas, unidades ni las calificaciones de los técnicos
(estas se conservan en el perfil del técnico, solo pierden el enlace al ticket). Para borrarlas también
usa --con-calificaciones.

Uso (en Railway → servicio backend → Shell):
    python manage.py reiniciar_tickets                    # solo muestra lo que se borraría
    python manage.py reiniciar_tickets --confirmar        # borra de verdad
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from tallerdiesel_api.models import (
    ComentarioTicket, EvidenciaTicket, Notificacion, Opinion, SolicitudServicio, Ticket,
)

TIPOS_QUE_SE_CONSERVAN = ['cuenta']   # avisos de la cuenta (ej. contraseña restablecida)


class Command(BaseCommand):
    help = 'Borra todos los tickets para que la numeración vuelva a empezar en TD001.'

    def add_arguments(self, parser):
        parser.add_argument('--confirmar', action='store_true', help='Borra de verdad (sin esto solo muestra el conteo).')
        parser.add_argument('--con-calificaciones', action='store_true', help='También borra las calificaciones de los técnicos.')

    def handle(self, *args, confirmar=False, con_calificaciones=False, **opts):
        conteo = {
            'Tickets': Ticket.objects.count(),
            'Comentarios / chat': ComentarioTicket.objects.count(),
            'Evidencias': EvidenciaTicket.objects.count(),
            'Solicitudes de servicio': SolicitudServicio.objects.count(),
            'Notificaciones de servicios': Notificacion.objects.exclude(tipo__in=TIPOS_QUE_SE_CONSERVAN).count(),
        }
        if con_calificaciones:
            conteo['Calificaciones de técnicos'] = Opinion.objects.count()
        for nombre, n in conteo.items():
            self.stdout.write(f'  {nombre}: {n}')

        if not confirmar:
            self.stdout.write(self.style.WARNING(
                '\nNo se borró nada. Para borrar de verdad ejecuta:\n  python manage.py reiniciar_tickets --confirmar'))
            return

        # Archivos de evidencias (S3/R2 o base de datos) — se borran antes que los registros
        archivos = 0
        for ev in EvidenciaTicket.objects.all().only('id', 'archivo'):
            try:
                if ev.archivo:
                    ev.archivo.delete(save=False)
                    archivos += 1
            except Exception:   # un archivo que ya no existe no debe detener el reinicio
                pass

        with transaction.atomic():
            ComentarioTicket.objects.all().delete()
            EvidenciaTicket.objects.all().delete()
            SolicitudServicio.objects.all().delete()
            Notificacion.objects.exclude(tipo__in=TIPOS_QUE_SE_CONSERVAN).delete()
            if con_calificaciones:
                Opinion.objects.all().delete()
            Ticket.objects.all().delete()

        self.stdout.write(self.style.SUCCESS(
            f'\nListo: se borraron todos los tickets ({archivos} archivos de evidencia). '
            f'El siguiente ticket será {Ticket._siguiente_folio()}.'))
