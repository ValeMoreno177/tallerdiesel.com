from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0002_requerimientos_gatito'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='puede_editar_coordinador',
            field=models.BooleanField(default=False),
        ),
    ]
