from django.core.management.base import BaseCommand
from tallerdiesel_api.views import revisar_alertas_sla


class Command(BaseCommand):
    help = ('Revisa tickets sin atender y mensajes de cliente sin respuesta por más de 5 segundos; '
            'crea alertas SLA para el coordinador asignado (o todos los admins). '
            'El endpoint de notificaciones ejecuta esta revisión automáticamente.')

    def handle(self, *args, **options):
        revisar_alertas_sla()
        self.stdout.write(self.style.SUCCESS('Revisión de SLA completada.'))
