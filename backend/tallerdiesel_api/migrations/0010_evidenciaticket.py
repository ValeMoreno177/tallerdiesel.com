# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import tallerdiesel_api.models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0009_ticket_finalizacion_solicitada'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EvidenciaTicket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('archivo', models.FileField(upload_to=tallerdiesel_api.models.ruta_evidencia)),
                ('nombre_original', models.CharField(max_length=255)),
                ('subido_por_nombre', models.CharField(blank=True, max_length=200)),
                ('fecha', models.DateTimeField(auto_now_add=True)),
                ('subido_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='evidencias', to='tallerdiesel_api.ticket')),
            ],
            options={'ordering': ['fecha']},
        ),
    ]
