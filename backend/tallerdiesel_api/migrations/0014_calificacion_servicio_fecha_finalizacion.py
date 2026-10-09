# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0013_comentarioticket_evidencia'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='fecha_finalizacion',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='opinion',
            name='calificacion_servicio',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='opinion',
            name='calificacion',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='opinion',
            name='comentario',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='opinion',
            name='tecnico',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='opiniones', to='tallerdiesel_api.tecnico'),
        ),
    ]