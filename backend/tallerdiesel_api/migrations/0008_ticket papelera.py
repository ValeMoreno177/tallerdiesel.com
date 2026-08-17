# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0007_codigorecuperacion_intentos_opinion_ticket_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='eliminado',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='ticket',
            name='eliminado_en',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ticket',
            name='eliminado_por',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                     related_name='tickets_eliminados', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='ticket',
            name='ticket_id',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddConstraint(
            model_name='ticket',
            constraint=models.UniqueConstraint(condition=models.Q(('eliminado', False)),
                                                fields=('ticket_id',), name='ticket_id_unico_entre_activos'),
        ),
    ]
