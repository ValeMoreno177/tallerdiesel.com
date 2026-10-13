# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0017_coordinadores_verificados'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='latitud',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='ticket',
            name='longitud',
            field=models.FloatField(blank=True, null=True),
        ),
        # Varios tickets en espera pueden tener el folio vacío a la vez: la regla de único aplica solo a los que ya tienen folio.
        migrations.RemoveConstraint(
            model_name='ticket',
            name='ticket_id_unico_entre_activos',
        ),
        migrations.AddConstraint(
            model_name='ticket',
            constraint=models.UniqueConstraint(
                condition=models.Q(('eliminado', False), models.Q(('ticket_id', ''), _negated=True)),
                fields=('ticket_id',), name='ticket_id_unico_entre_activos'),
        ),
    ]
