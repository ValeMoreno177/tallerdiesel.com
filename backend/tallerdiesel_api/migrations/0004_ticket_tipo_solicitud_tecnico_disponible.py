from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('tallerdiesel_api', '0003_ticket_puede_editar_coordinador'),
    ]
    operations = [
        migrations.AddField(
            model_name='ticket',
            name='tipo_solicitud',
            field=models.CharField(
                choices=[('coordinador','Coordinador'),('tecnico','Técnico')],
                default='coordinador', max_length=20
            ),
        ),
        migrations.AddField(
            model_name='tecnico',
            name='disponible',
            field=models.BooleanField(default=True),
        ),
    ]
