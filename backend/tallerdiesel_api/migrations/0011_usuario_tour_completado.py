# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models


def usuarios_existentes_sin_tour(apps, schema_editor):
    # Solo los usuarios NUEVOS ven el recorrido: los que ya existen lo marcan como visto.
    Usuario = apps.get_model('tallerdiesel_api', 'Usuario')
    Usuario.objects.all().update(tour_completado=True)


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0010_evidenciaticket'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='tour_completado',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(usuarios_existentes_sin_tour, migrations.RunPython.noop),
    ]
