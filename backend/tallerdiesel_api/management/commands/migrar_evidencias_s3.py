from django.conf import settings
from django.core.files.storage import default_storage, FileSystemStorage
from django.core.management.base import BaseCommand, CommandError

from tallerdiesel_api.models import EvidenciaTicket


class Command(BaseCommand):
    help = 'Copia evidencias del MEDIA_ROOT local al almacenamiento persistente configurado.'

    def handle(self, *args, **options):
        if not settings.AWS_STORAGE_BUCKET_NAME:
            raise CommandError('Configura AWS_STORAGE_BUCKET_NAME y las credenciales del bucket antes de ejecutar este comando.')

        origen = FileSystemStorage(location=settings.MEDIA_ROOT)
        copiadas = 0
        existentes = 0
        faltantes = []

        for evidencia in EvidenciaTicket.objects.only('id', 'archivo').iterator():
            nombre = evidencia.archivo.name
            if default_storage.exists(nombre):
                existentes += 1
                continue
            try:
                with origen.open(nombre, 'rb') as archivo:
                    default_storage.save(nombre, archivo)
                copiadas += 1
            except FileNotFoundError:
                faltantes.append(nombre)

        self.stdout.write(self.style.SUCCESS(f'Evidencias copiadas: {copiadas}; ya estaban en el bucket: {existentes}.'))
        if faltantes:
            self.stdout.write(self.style.WARNING(f'No se encontraron {len(faltantes)} archivos locales:'))
            for nombre in faltantes:
                self.stdout.write(f'  - {nombre}')
