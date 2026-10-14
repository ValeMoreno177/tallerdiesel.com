from django.core.files.base import ContentFile
from django.core.files.storage import Storage


class AlmacenamientoBD(Storage):
    """Guarda los archivos (evidencias) en la base de datos de Postgres.

    Se usa en producción cuando NO hay un bucket S3/R2 configurado: el disco de Railway se borra
    en cada despliegue, pero la base de datos no, así las fotos y PDF no se pierden.
    (Igual que ya se hace con las fotos de perfil.) Las fotos llegan ya comprimidas desde el
    navegador, por lo que pesan poco.
    """

    def _modelo(self):
        from .models import ArchivoAlmacenado
        return ArchivoAlmacenado

    def _open(self, name, mode='rb'):
        try:
            obj = self._modelo().objects.get(nombre=name)
        except self._modelo().DoesNotExist:
            raise FileNotFoundError(name)
        return ContentFile(bytes(obj.contenido), name=name)

    def _save(self, name, content):
        datos = content.read()
        if hasattr(datos, 'encode'):
            datos = datos.encode()
        self._modelo().objects.update_or_create(
            nombre=name, defaults={'contenido': datos, 'tamano': len(datos)},
        )
        return name

    def exists(self, name):
        return self._modelo().objects.filter(nombre=name).exists()

    def delete(self, name):
        self._modelo().objects.filter(nombre=name).delete()

    def size(self, name):
        return self._modelo().objects.filter(nombre=name).values_list('tamano', flat=True).first() or 0

    def url(self, name):
        raise NotImplementedError('Los archivos se descargan por el endpoint con permisos, no por URL directa.')
