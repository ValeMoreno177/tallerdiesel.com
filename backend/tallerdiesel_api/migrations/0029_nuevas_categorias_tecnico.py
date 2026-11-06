from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0028_ubicacion_tiempo_real_y_folios_tecnico'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tecnico',
            name='categoria',
            field=models.CharField(choices=[
                ('motor_diesel', 'Motor diesel'), ('electrico', 'Eléctrico'),
                ('frenos_suspension', 'Frenos y suspensión'), ('transmision', 'Transmisión'),
                ('hidraulico', 'Sistema hidráulico'), ('aire', 'Sistema de aire'),
                ('mecanica', 'Mecánica general'), ('soldadura', 'Soldadura'),
                ('talachera', 'Talachera'), ('llantas', 'Llantas'), ('gruas', 'Grúas'),
                ('refaccionaria', 'Refaccionaria'), ('muelles', 'Muelles'),
                ('carroceria', 'Carrocería'), ('muelles_carroceria', 'Muelles y carrocería'),
            ], max_length=50),
        ),
    ]
