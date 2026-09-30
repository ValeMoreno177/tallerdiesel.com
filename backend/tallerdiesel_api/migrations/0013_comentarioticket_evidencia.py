# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0012_comentarioticket_editado'),
    ]

    operations = [
        migrations.AddField(
            model_name='comentarioticket',
            name='evidencia',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='tallerdiesel_api.evidenciaticket'),
        ),
    ]
