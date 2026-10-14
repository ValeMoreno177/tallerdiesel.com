from django.db import migrations, models


def archivar_tickets_finalizados(apps, schema_editor):
    Ticket = apps.get_model('tallerdiesel_api', 'Ticket')
    Notificacion = apps.get_model('tallerdiesel_api', 'Notificacion')
    ids_finalizados = Ticket.objects.filter(estatus='terminado').values_list('id', flat=True)
    Notificacion.objects.filter(referencia_id__in=ids_finalizados).exclude(
        tipo='calificar_servicio', leida=False,
    ).update(archivada=True)


class Migration(migrations.Migration):

    dependencies = [('tallerdiesel_api', '0020_ticket_sla_respuesta')]

    operations = [
        migrations.AddField(
            model_name='notificacion',
            name='archivada',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(archivar_tickets_finalizados, migrations.RunPython.noop),
    ]
