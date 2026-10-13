# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models


def numerar_coordinadores(apps, schema_editor):
    """Los coordinadores que ya existen reciben su número de turno (1, 2, 3…) en el orden en que se dieron de alta."""
    Usuario = apps.get_model('tallerdiesel_api', 'Usuario')
    for n, u in enumerate(Usuario.objects.filter(rol='coordinador').order_by('id'), start=1):
        Usuario.objects.filter(pk=u.pk).update(numero_coordinador=n)


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0018_folio_al_asignar_ubicacion_ticket'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='numero_coordinador',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='libre_desde',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='configuracionempresa',
            name='ultimo_turno',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(numerar_coordinadores, migrations.RunPython.noop),
    ]
