# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0015_correo_compartido_coordinadores'),
    ]

    operations = [
        migrations.CreateModel(
            name='FotoPerfil',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('contenido', models.BinaryField()),
                ('tipo', models.CharField(max_length=20)),
                ('actualizada', models.DateTimeField(auto_now=True)),
                ('usuario', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='foto_perfil', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]