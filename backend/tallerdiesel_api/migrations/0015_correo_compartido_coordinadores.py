# Generado a mano (mismo formato que las migraciones anteriores del proyecto)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0014_calificacion_servicio_fecha_finalizacion'),
    ]

    operations = [
        # El correo deja de ser único a secas: solo los coordinadores pueden compartirlo.
        migrations.AlterField(
            model_name='usuario',
            name='email',
            field=models.EmailField(max_length=254),
        ),
        migrations.AddConstraint(
            model_name='usuario',
            constraint=models.UniqueConstraint(
                condition=models.Q(('rol', 'coordinador'), _negated=True),
                fields=('email',), name='usuario_email_unico_salvo_coordinador'),
        ),
    ]