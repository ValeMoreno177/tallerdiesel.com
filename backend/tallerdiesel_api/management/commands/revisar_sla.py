from django.core.management.base import BaseCommand
from tallerdiesel_api.views import revisar_alertas_sla


class Command(BaseCommand):
    help = ('Revisa tickets "Pendiente" que llevan demasiado tiempo sin atenderse y crea '
            'notificaciones de alerta SLA para el coordinador asignado (o todos los admins). '
            'Pensado para ejecutarse periódicamente vía cron, ej. cada 5 minutos:\n'
            '  */5 * * * * cd /ruta/backend && python manage.py revisar_sla')

    def handle(self, *args, **options):
        revisar_alertas_sla()
        self.stdout.write(self.style.SUCCESS('Revisión de SLA completada.'))
