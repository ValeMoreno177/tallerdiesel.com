# Generado a mano para incorporar los requerimientos del documento de
# administración / módulo del cliente / tickets / técnicos / bitácora.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrar_estatus_detenido(apps, schema_editor):
    """El estatus 'detenido' ya no existe en el nuevo flujo
    (Pendiente → Atendido → En proceso → Finalizado). Los tickets que
    estaban 'detenido' pasan a 'pendiente' para que vuelvan a ser
    atendidos por un coordinador."""
    Ticket = apps.get_model('tallerdiesel_api', 'Ticket')
    Ticket.objects.filter(estatus='detenido').update(estatus='pendiente')


def revertir_estatus_detenido(apps, schema_editor):
    # No es posible distinguir cuáles 'pendiente' eran originalmente
    # 'detenido', así que no se revierte el dato (solo el esquema).
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tallerdiesel_api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='puede_editar_sistema',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='usuario',
            name='aviso_privacidad_aceptado',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='ConfiguracionEmpresa',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre_empresa', models.CharField(default='TallerDiesel', max_length=200)),
                ('rfc', models.CharField(blank=True, max_length=20)),
                ('direccion', models.CharField(blank=True, max_length=300)),
                ('telefono', models.CharField(blank=True, max_length=20)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('sitio_web', models.CharField(blank=True, max_length=200)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('actualizado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Configuración de la empresa',
                'verbose_name_plural': 'Configuración de la empresa',
            },
        ),
        migrations.AddField(
            model_name='solicitudservicio',
            name='lugar',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='solicitudservicio',
            name='unidad',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='solicitudservicio',
            name='ticket',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='solicitud_origen', to='tallerdiesel_api.ticket'),
        ),
        migrations.AddField(
            model_name='ticket',
            name='tecnico',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tickets_asignados', to='tallerdiesel_api.tecnico'),
        ),
        migrations.RunPython(migrar_estatus_detenido, revertir_estatus_detenido),
        migrations.AlterField(
            model_name='ticket',
            name='estatus',
            field=models.CharField(choices=[('pendiente', 'Pendiente'), ('atendido', 'Atendido'), ('proceso', 'En proceso'), ('terminado', 'Finalizado')], default='pendiente', max_length=20),
        ),
    ]
