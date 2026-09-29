# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0008_ticket_papelera'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='finalizacion_solicitada',
            field=models.BooleanField(default=False),
        ),
    ]
