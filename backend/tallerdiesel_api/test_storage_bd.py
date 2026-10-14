import io
from datetime import date
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase
from .models import Ticket, ArchivoAlmacenado

User = get_user_model()
STORAGE_BD = {'default': {'BACKEND': 'tallerdiesel_api.storage.AlmacenamientoBD'},
              'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}}


@override_settings(STORAGES=STORAGE_BD)
class AlmacenamientoBDTests(APITestCase):
    def test_cliente_sube_foto_y_se_descarga(self):
        mk = lambda u, rol: User.objects.create_user(u, f'{u}@x.com', 'pass12345', rol=rol, nombre=u, email_verificado=True)
        cli, coord = mk('cli', 'cliente'), mk('coord', 'coordinador')
        t = Ticket.objects.create(empresa='ACME', fecha=date.today(), unidad='U1', cliente=cli, coordinador=coord, estatus='proceso')
        buf = io.BytesIO(); Image.new('RGB', (80, 60), 'red').save(buf, 'JPEG')
        self.client.force_authenticate(cli)
        r = self.client.post(f'/api/tickets/{t.id}/subir_evidencia/',
                             {'archivo': SimpleUploadedFile('foto.jpg', buf.getvalue(), 'image/jpeg')}, format='multipart')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(ArchivoAlmacenado.objects.count(), 1)           # quedó en la base de datos
        eid = r.data['evidencias'][0]['id']
        d = self.client.get(f'/api/tickets/{t.id}/evidencia/{eid}/')
        self.assertEqual(d.status_code, 200)
        self.assertEqual(b''.join(d.streaming_content), buf.getvalue())  # se descarga idéntica
        self.client.force_authenticate(coord)                            # el coordinador también la ve
        self.assertEqual(self.client.get(f'/api/tickets/{t.id}/evidencia/{eid}/').status_code, 200)
