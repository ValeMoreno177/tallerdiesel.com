# Los coordinadores ya no requieren verificar su correo: se marcan como verificados los que ya existen.

from django.db import migrations


def verificar_coordinadores(apps, schema_editor):
    Usuario = apps.get_model('tallerdiesel_api', 'Usuario')
    TokenVerificacion = apps.get_model('tallerdiesel_api', 'TokenVerificacion')
    Usuario.objects.filter(rol='coordinador', email_verificado=False).update(email_verificado=True)
    # Ya no hay nada que verificar: se descartan los códigos pendientes de esos usuarios
    TokenVerificacion.objects.filter(usuario__rol='coordinador').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0016_fotoperfil'),
    ]

    operations = [
        migrations.RunPython(verificar_coordinadores, migrations.RunPython.noop),
    ]