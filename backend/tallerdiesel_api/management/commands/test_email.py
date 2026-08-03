from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail
from django.conf import settings
from tallerdiesel_api.emails import enviar_html, email_codigo_verificacion


class Command(BaseCommand):
    help = 'Envía un correo de prueba (con el diseño real de la marca) para diagnosticar problemas de envío.'

    def add_arguments(self, parser):
        parser.add_argument('destino', type=str, help='Correo al que se enviará la prueba')

    def handle(self, *args, **options):
        destino = options['destino']

        self.stdout.write(self.style.WARNING('── Configuración actual ──'))
        self.stdout.write(f'EMAIL_BACKEND:       {settings.EMAIL_BACKEND}')
        self.stdout.write(f'EMAIL_HOST:          {getattr(settings, "EMAIL_HOST", "—")}')
        self.stdout.write(f'EMAIL_PORT:          {getattr(settings, "EMAIL_PORT", "—")}')
        self.stdout.write(f'EMAIL_USE_TLS:       {getattr(settings, "EMAIL_USE_TLS", "—")}')
        self.stdout.write(f'EMAIL_HOST_USER:     {getattr(settings, "EMAIL_HOST_USER", "—")}')
        self.stdout.write(f'DEFAULT_FROM_EMAIL:  {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'Enviando prueba a:   {destino}\n')

        try:
            ok = enviar_html(
                asunto='TallerDiesel — Correo de prueba (diseño real)',
                destinatarios=[destino],
                html_body=email_codigo_verificacion('Prueba', '123456', 15),
                text_body='Si recibiste este correo, la configuración SMTP funciona correctamente.',
                fail_silently=False,
            )
            if ok:
                self.stdout.write(self.style.SUCCESS('✅ Correo enviado sin errores. Revisa la bandeja de entrada (y spam) de ' + destino))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Falló el envío: {type(e).__name__}: {e}'))
            raise CommandError('El envío de correo falló. Revisa el mensaje de error de arriba.')
