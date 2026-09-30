# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0011_usuario_tour_completado'),
    ]

    operations = [
        migrations.AddField(
            model_name='comentarioticket',
            name='editado',
            field=models.BooleanField(default=False),
        ),
    ]
